'use strict';

const {
  buildPublishedSlugSet,
  exclusionReasonForSlug,
  STAGE43_HARD_EXCLUDE,
} = require('./stage43PublishedBaseline');
const { verifyResearchPortSha } = require('../portResearchImport/verifyResearchSha');
const { computePolicyApply } = require('../portResearchImport/applyPortResearch');

const ROOT_CAUSE_LABELS = {
  missing_public_guide_entry: 'import_missing_public_guide_entry',
  identifier_inferred: 'canonical_identity_inferred',
  identifier_unresolved: 'canonical_identity_unresolved',
  research_status_needs_review: 'research_metadata_needs_review',
  qa_blocked: 'research_qa_blocked',
  qa_not_pass: 'research_qa_not_pass',
  missing_app_port_id: 'missing_app_port_id',
  historical_policy_exclusion: 'historical_policy_exclusion',
  research_yaml_parse: 'import_schema_yaml_parse_error',
  policy_apply_failed: 'gateway_terminal_policy_block',
  research_sha_mismatch: 'research_sha_mismatch',
  multi_slug_app_port_id: 'multi_slug_ambiguity',
};

function emptyGuideShell(row) {
  return {
    appPortId: row.app_port_id,
    portName: row.name || row.landing_slug,
    country: row.country || '',
    portInfo: { description: '' },
    thingsToDo: {},
  };
}

function fakeResolvedManifestRow(row) {
  return {
    ...row,
    has_public_port_guide: true,
    identifier_status: 'resolved',
  };
}

function classifyBlockedRootCauses(row, { publishedSet, eligibilityRow }) {
  const causes = [];
  if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) causes.push(ROOT_CAUSE_LABELS.historical_policy_exclusion);
  if (publishedSet.has(row.landing_slug)) causes.push('already_published');
  if (exclusionReasonForSlug(row.landing_slug, publishedSet)) {
    causes.push(exclusionReasonForSlug(row.landing_slug, publishedSet));
  }
  if (row.qa_verdict === 'BLOCKED') causes.push(ROOT_CAUSE_LABELS.qa_blocked);
  else if (row.qa_verdict !== 'PASS') causes.push(ROOT_CAUSE_LABELS.qa_not_pass);
  for (const b of row.import_blockers || []) {
    if (ROOT_CAUSE_LABELS[b]) causes.push(ROOT_CAUSE_LABELS[b]);
    else causes.push(`import_${b}`);
  }
  if (eligibilityRow && !eligibilityRow.research_sha_verified) causes.push(ROOT_CAUSE_LABELS.research_sha_mismatch);
  if (row.multi_slug_app_port_id_peers?.length) causes.push(ROOT_CAUSE_LABELS.multi_slug_app_port_id);
  return [...new Set(causes)];
}

function scoreBootstrapCandidate(row, { policyOk, hasYaml }) {
  let score = 0;
  if (policyOk) score += 12;
  if (row.qa_verdict === 'PASS') score += 5;
  if (row.in_app_cruise_dataset) score += 3;
  if (row.resolution_method === 'slug_to_app_port_id') score += 6;
  else if (row.resolution_method === 'review_key_picker_id') score += 4;
  if (hasYaml) score += 2;
  if (row.research_status === 'needs_review') score += 1;
  if (row.region && /europe|caribbean|mediterranean/i.test(String(row.region))) score += 2;
  return score;
}

/**
 * Inspect BLOCKED unpublished cohort; simulate post-bootstrap policy apply without weakening gates.
 */
function analyzeBlockedCohort({ manifestPorts, eligibilityPorts, researchRoot, landingRepoRoot }) {
  const publishedSet = buildPublishedSlugSet(landingRepoRoot);
  const bySlugElig = new Map((eligibilityPorts || []).map((p) => [p.landing_slug, p]));

  const blockedUnpublished = (eligibilityPorts || []).filter(
    (p) => p.publication_bucket === 'BLOCKED' && !publishedSet.has(p.landing_slug)
  );

  const causeCounts = {};
  const inspected = [];

  for (const elig of blockedUnpublished) {
    const row = (manifestPorts || []).find((p) => p.landing_slug === elig.landing_slug) || elig;
    const causes = classifyBlockedRootCauses(row, { publishedSet, eligibilityRow: elig });
    for (const c of causes) causeCounts[c] = (causeCounts[c] || 0) + 1;
    inspected.push({
      landing_slug: row.landing_slug,
      app_port_id: row.app_port_id,
      qa_verdict: row.qa_verdict,
      research_status: row.research_status,
      causes,
    });
  }

  const bootstrapPool = [];
  for (const row of manifestPorts || []) {
    if (!blockedUnpublished.some((b) => b.landing_slug === row.landing_slug)) continue;
    if (row.qa_verdict !== 'PASS') continue;
    if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) continue;
    if (publishedSet.has(row.landing_slug)) continue;
    if (exclusionReasonForSlug(row.landing_slug, publishedSet)) continue;
    if (row.multi_slug_app_port_id_peers?.length) continue;
  if (!row.app_port_id) continue;

    const sha = verifyResearchPortSha({ researchRoot, landingSlug: row.landing_slug, manifestRow: row });
    if (!sha.ok) continue;

    let policyOk = false;
    let policyBlockers = [];
    let yamlError = null;
    try {
      const r = computePolicyApply({
        researchRoot,
        landingSlug: row.landing_slug,
        manifestRow: fakeResolvedManifestRow(row),
        existingGuide: emptyGuideShell(row),
        existingTerminals: [],
      });
      policyOk = Boolean(r.ok);
      policyBlockers = r.hardBlockers || [];
    } catch (err) {
      yamlError = String(err.message || err).split('\n')[0];
    }

    const elig = bySlugElig.get(row.landing_slug);
    bootstrapPool.push({
      landing_slug: row.landing_slug,
      app_port_id: row.app_port_id,
      name: row.name,
      country: row.country,
      region: row.region,
      research_status: row.research_status,
      research_sha256: row.sha256,
      resolution_method: row.resolution_method,
      policy_ok: policyOk,
      policy_blockers: policyBlockers,
      yaml_parse_error: yamlError,
      thin_score: elig?.thin_score ?? null,
      bootstrap_score: scoreBootstrapCandidate(row, { policyOk, hasYaml: !yamlError }),
    });
  }

  bootstrapPool.sort(
    (a, b) => b.bootstrap_score - a.bootstrap_score || a.landing_slug.localeCompare(b.landing_slug)
  );

  return {
    blocked_unpublished_count: blockedUnpublished.length,
    inspected_count: inspected.length,
    cause_counts: causeCounts,
    inspected_sample: inspected.slice(0, 200),
    bootstrap_pool: bootstrapPool,
    bootstrap_policy_ok_count: bootstrapPool.filter((p) => p.policy_ok).length,
    bootstrap_yaml_fail_count: bootstrapPool.filter((p) => p.yaml_parse_error).length,
  };
}

function selectBootstrapCandidates(bootstrapPool, { limit = 25, oversample = 8 }) {
  const picked = [];
  const skipped = [];
  const target = limit + oversample;
  for (const row of bootstrapPool) {
    if (picked.length >= target) break;
    if (!row.policy_ok) {
      skipped.push({ landing_slug: row.landing_slug, reason: row.yaml_parse_error || 'policy_block' });
      continue;
    }
    picked.push({
      landing_slug: row.landing_slug,
      app_port_id: row.app_port_id,
      name: row.name,
      country: row.country,
      research_sha256: row.research_sha256,
      thin_score: row.thin_score,
      research_status: row.research_status,
      resolution_method: row.resolution_method,
      publication_bucket: 'BLOCKED',
      qa_verdict: 'PASS',
      identifier_status: 'resolved',
      research_sha_verified: true,
      bootstrap_recovery: true,
    });
  }
  return { picked, skipped, eligible_count: bootstrapPool.filter((p) => p.policy_ok).length };
}

function buildBootstrapGuideShell(row) {
  return emptyGuideShell(row);
}

module.exports = {
  ROOT_CAUSE_LABELS,
  analyzeBlockedCohort,
  selectBootstrapCandidates,
  buildBootstrapGuideShell,
  emptyGuideShell,
};

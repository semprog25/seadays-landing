'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./stage65PublicationGuards');
const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize');
const { verifyResearchPortSha } = require('../portResearchImport/verifyResearchSha');
const { resolveCompositeResearchRoot } = require('../portResearchImport/resolveCompositeResearchRoot');
const { loadResearchIndex } = require('../portResearchImport/buildIdentifierManifest');
const { gateManifestForApply } = require('../portResearchImport/applyPortResearch');
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  buildPublishedSlugSet,
  exclusionReasonForSlug,
} = require('./stage43PublishedBaseline');
const { stableStringify } = require('../portResearchImport/jsonDiff');
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('../publicGuideCopySanitize');

function fail(msg) {
  const err = new Error(msg);
  err.code = 'BATCH_PREP_STOP';
  throw err;
}

function hashProposedFile(repoRoot, relPath) {
  const proposed = JSON.parse(fs.readFileSync(path.join(repoRoot, relPath), 'utf8'));
  return {
    proposed,
    hash: crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex'),
  };
}

function prepareOneCandidate({ repoRoot, batchManifest, candidate, policy }) {
  const { landing_slug: landingSlug, app_port_id: appPortId } = candidate;
  if (policy.owner_publication_authorized === true || policy.owner_indexing_authorized === true) {
    fail('owner auth flags must remain false on policy clearance');
  }
  if (policy.owner_conditional_prep_authorized !== true) {
    fail('owner_conditional_prep_authorized must be true');
  }

  const guides = loadPublicPortGuidesFile(repoRoot);
  removeStage65ExcludedGuideEntries(guides);
  const livePe = countPassengerEditorialGuides(guides);
  if (livePe !== batchManifest.baseline_live_passenger_editorial) {
    fail(`live PE ${livePe} !== baseline ${batchManifest.baseline_live_passenger_editorial}`);
  }

  const slot = guides.byAppPortId?.[appPortId];
  if (!slot) fail(`missing guide slot ${appPortId}`);
  if (usesPassengerEditorialLead(slot)) fail(`${landingSlug} already passenger_editorial in production tree`);

  if (!STAGE43_HARD_EXCLUDE_HISTORICAL.has(landingSlug)) {
    fail(`historical ledger missing ${landingSlug}`);
  }
  const publishedSet = buildPublishedSlugSet(repoRoot);
  const prodExclusion = exclusionReasonForSlug(landingSlug, publishedSet);
  if (prodExclusion !== 'stage43_hard_exclude' && prodExclusion !== 'stage89_conditional_candidate_only') {
    fail(`expected stage43 hold for ${landingSlug}, got ${prodExclusion}`);
  }

  if (candidate.prep_source === 'reuse_stage89') {
    const reuseRef = path.join(repoRoot, candidate.reuse_candidate_evidence_ref);
    const prepPath = path.join(reuseRef, 'STAGE89_PREP_MANIFEST.json');
    if (!fs.existsSync(prepPath)) fail(`missing reused prep manifest ${prepPath}`);
    const stage89Prep = JSON.parse(fs.readFileSync(prepPath, 'utf8'));
    return {
      landing_slug: landingSlug,
      app_port_id: appPortId,
      status: 'READY_REUSED_STAGE89',
      prep_manifest_ref: `${candidate.reuse_candidate_evidence_ref}/STAGE89_PREP_MANIFEST.json`,
      reuse_candidate_evidence_ref: candidate.reuse_candidate_evidence_ref,
      research_sha256: stage89Prep.research_sha256,
      proposed_content_hash: stage89Prep.proposed_content_hash,
      qa_verdict: 'PASS',
      field_exclusions: candidate.field_exclusions || [],
    };
  }

  const { proposed, hash } = hashProposedFile(repoRoot, candidate.proposed_guide_ref);
  if (hash !== candidate.proposed_content_hash) {
    fail(`proposed hash mismatch ${landingSlug}: ${hash}`);
  }
  if (proposed.researchImport?.research_sha256 !== candidate.research_sha256) {
    fail(`proposed research_sha256 mismatch ${landingSlug}`);
  }

  const patchPath = path.join(repoRoot, batchManifest.composite_sha_patch_ref);
  if (!fs.existsSync(patchPath)) fail(`missing ${batchManifest.composite_sha_patch_ref}`);
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  if (patch.verified_research_commit !== batchManifest.research_main_pin) {
    fail(`research pin mismatch`);
  }

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: repoRoot, patchPath });
  try {
    const index = loadResearchIndex(compositeRoot);
    const indexRow = index.find((p) => p.slug === landingSlug);
    if (!indexRow) fail(`${landingSlug} missing from PORTS_MASTER_INDEX`);
    if (indexRow.qa_verdict !== 'PASS') fail(`qa_verdict ${indexRow.qa_verdict}`);
    if (indexRow.sha256 !== candidate.research_sha256) {
      fail(`index sha mismatch for ${landingSlug}`);
    }
    const sha = verifyResearchPortSha({
      researchRoot: compositeRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: candidate.research_sha256 },
    });
    if (!sha.ok) fail(`research sha verify ${landingSlug}: ${sha.reason}`);

    const blockers = gateManifestForApply({
      landing_slug: landingSlug,
      app_port_id: appPortId,
      sha256: candidate.research_sha256,
      qa_verdict: 'PASS',
      research_status: indexRow.research_status,
      identifier_status: 'resolved',
      has_public_port_guide: true,
    });
    if (blockers.length) fail(`gateManifestForApply ${landingSlug}: ${blockers.join(',')}`);
  } finally {
    cleanup();
  }

  const leakBlob = collectGuidePassengerLeakBlob(proposed);
  if (containsInternalResearchLeak(leakBlob)) fail(`internal research leak ${landingSlug}`);

  const htmlPath = path.join(repoRoot, 'ports', landingSlug, 'index.html');
  if (!fs.existsSync(htmlPath)) fail(`missing production html ${landingSlug}`);
  const html = fs.readFileSync(htmlPath, 'utf8');
  if (!/noindex/i.test(html)) fail(`expected noindex stub ${landingSlug}`);

  return {
    landing_slug: landingSlug,
    app_port_id: appPortId,
    status: 'READY_FOR_LOCAL_APPLY',
    proposed_guide_ref: candidate.proposed_guide_ref,
    proposed_content_hash: candidate.proposed_content_hash,
    research_sha256: candidate.research_sha256,
    qa_verdict: 'PASS',
    field_exclusions: candidate.field_exclusions || [],
    viator_campaign: candidate.viator_campaign || null,
    historical_stage43_active_exclude: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    production_apply_permitted: false,
    candidate_apply_permitted: true,
  };
}

function prepareBatchFromManifest(repoRoot, manifestRel) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..');
  const manifestPath = path.join(repo, manifestRel || 'qa-evidence/publication-batch-01/BATCH_01_MANIFEST.json');
  const batch = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const policy = JSON.parse(fs.readFileSync(path.join(repo, batch.policy_clearance_ref), 'utf8'));

  let head = '';
  try {
    head = execSync('git rev-parse HEAD', { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    fail('cannot resolve HEAD');
  }
  if (head !== batch.baseline_main) {
    fail(`HEAD ${head} !== baseline ${batch.baseline_main}`);
  }

  const prepRows = [];
  for (const candidate of batch.candidates) {
    prepRows.push(prepareOneCandidate({ repoRoot: repo, batchManifest: batch, candidate, policy }));
  }

  const prepBundle = {
    schema_version: 1,
    batch_id: batch.batch_id,
    status: 'READY_FOR_OWNER_REVIEW',
    baseline_main: batch.baseline_main,
    baseline_live_passenger_editorial: batch.baseline_live_passenger_editorial,
    policy_clearance_ref: batch.policy_clearance_ref,
    candidates: prepRows,
    created_at_utc: new Date().toISOString(),
  };
  const bundleHash = crypto.createHash('sha256').update(JSON.stringify(prepBundle)).digest('hex');
  prepBundle.bundle_idempotency_hash = bundleHash;

  const outDir = path.join(repo, batch.evidence_root);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'PREP_MANIFEST.json'), `${JSON.stringify(prepBundle, null, 2)}\n`, 'utf8');

  return { prepBundle, bundleHash };
}

module.exports = {
  prepareOneCandidate,
  prepareBatchFromManifest,
};

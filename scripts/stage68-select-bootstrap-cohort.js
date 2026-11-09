#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot');
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { analyzeBlockedCohort } = require('./lib/bulkPortPublication/stage65UnpublishedCohort');
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility');
const {
  buildPublishedSlugSet,
  STAGE43_HARD_EXCLUDE,
  exclusionReasonForSlug,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const {
  assertSafePublicPortGuideSlotWrite,
  FALMOUTH_JAMAICA_LANDING_SLUG,
} = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
const { normalizeCountryKey } = require('./lib/publicPortGuideAdapter');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage68-bootstrap-47');
const SUMMARY = path.join(REPO, 'qa-evidence/stage67-yaml-repair-48/RECONCILE_SUMMARY.json');

const STAGE67_OWNER_HOLD = new Set([
  'tokyo-yokohama-japan',
  'kirkenes-norway',
  'ocho-rios-jamaica',
  'glasgow-united-kingdom',
  'rostock-germany',
]);

function identityBlockReason(row, { publishedSet, guides, cohortAppIds }) {
  const slug = row.landing_slug;
  if (slug === FALMOUTH_JAMAICA_LANDING_SLUG) return 'falmouth_homonym_excluded';
  if (STAGE67_OWNER_HOLD.has(slug)) return 'owner_factual_hold';
  if (STAGE43_HARD_EXCLUDE.has(slug)) return 'historical_policy_hold';
  if (publishedSet.has(slug)) return 'already_published_passenger_editorial';
  const ex = exclusionReasonForSlug(slug, publishedSet);
  if (ex) return ex;
  if (!row.app_port_id) return 'missing_app_port_id';
  if (row.identifier_status === 'unresolved') return 'identifier_unresolved';
  if (row.qa_verdict !== 'PASS') return 'research_qa_not_pass';
  const prior = guides.byAppPortId[row.app_port_id];
  if (prior && usesPassengerEditorialLead(prior)) {
    const priorSlug = prior.researchImport?.landing_slug;
    if (priorSlug && priorSlug !== slug) return 'app_port_id_occupied_by_passenger_editorial';
  }
  const cohortPeers = cohortAppIds.get(row.app_port_id) || [];
  if (cohortPeers.length > 1) return 'duplicate_app_port_id_within_cohort';
  if (row.multi_slug_app_port_id_peers?.length) {
    const peerPublished = row.multi_slug_app_port_id_peers.some((s) => publishedSet.has(s));
    if (peerPublished) return 'multi_slug_peer_already_published';
  }
  const researchCountry = normalizeCountryKey(row.country || '');
  const priorCountry = prior ? normalizeCountryKey(prior.country || '') : '';
  if (prior && priorCountry && researchCountry && priorCountry !== researchCountry) {
    return 'cross_country_slot_conflict';
  }
  try {
    assertSafePublicPortGuideSlotWrite({
      landingSlug: slug,
      targetAppPortId: row.app_port_id,
      proposedGuide: {
        appPortId: row.app_port_id,
        country: row.country,
        researchImport: { landing_slug: slug },
      },
      priorGuideAtSlot: prior,
    });
  } catch (err) {
    return String(err.code || err.message);
  }
  return null;
}

function main() {
  if (!process.env.SEADAYS_APP_ROOT) {
    process.env.SEADAYS_APP_ROOT = path.resolve(REPO, '..', '..', '..', 'Seadays-trust-boundary');
  }
  const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'));
  const slugs = summary.bootstrap_apply_ready_slugs || [];
  if (slugs.length !== 47) throw new Error(`expected 47 bootstrap slugs, got ${slugs.length}`);

  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO });
  try {
    const publishedSet = buildPublishedSlugSet(REPO);
    const guides = loadPublicPortGuidesFile(REPO);
    const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot });
    const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot });
    const analysis = analyzeBlockedCohort({
      manifestPorts: manifest.ports,
      eligibilityPorts: report.ports,
      researchRoot: compositeRoot,
      landingRepoRoot: REPO,
    });
    const bootstrapBySlug = new Map(analysis.bootstrap_pool.map((p) => [p.landing_slug, p]));
    const manifestBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]));

    const cohortAppIds = new Map();
    for (const slug of slugs) {
      const row = manifestBySlug.get(slug);
      if (!row?.app_port_id) continue;
      if (!cohortAppIds.has(row.app_port_id)) cohortAppIds.set(row.app_port_id, []);
      cohortAppIds.get(row.app_port_id).push(slug);
    }

    const inspected = [];
    const selected = [];
    const held = [];

    for (const slug of slugs) {
      const row = manifestBySlug.get(slug);
      const bootstrap = bootstrapBySlug.get(slug);
      const patchSha = patchMeta.sha_patch?.[slug];
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug: slug,
        manifestRow: row,
      });
      const block = identityBlockReason(row || { landing_slug: slug }, {
        publishedSet,
        guides,
        cohortAppIds,
      });
      const identitySafe = !block && sha.ok && bootstrap?.policy_ok;
      const record = {
        landing_slug: slug,
        app_port_id: row?.app_port_id || null,
        name: row?.name,
        country: row?.country,
        identifier_status: row?.identifier_status,
        resolution_method: row?.resolution_method,
        research_sha256: patchSha || row?.sha256,
        identity_safe: identitySafe,
        hold_reason: block || (!sha.ok ? 'research_sha_mismatch' : null) || (!bootstrap?.policy_ok ? 'policy_not_ok' : null),
        research_sha_verified: sha.ok,
        policy_ok: Boolean(bootstrap?.policy_ok),
      };
      inspected.push(record);
      if (identitySafe) {
        selected.push({
          landing_slug: slug,
          app_port_id: row.app_port_id,
          name: row.name,
          country: row.country,
          research_sha256: record.research_sha256,
          thin_score: null,
          research_status: row.research_status,
          resolution_method: row.resolution_method,
          publication_bucket: 'BLOCKED',
          qa_verdict: 'PASS',
          identifier_status: row.identifier_status,
          identifier_confidence: row.identifier_status === 'resolved' ? 'verified' : 'inferred_not_canonical',
          research_sha_verified: true,
          bootstrap_recovery: true,
        });
      } else held.push(record);
    }

    fs.mkdirSync(OUT, { recursive: true });
    fs.writeFileSync(
      path.join(OUT, 'IDENTITY_REPORT.json'),
      `${JSON.stringify(
        {
          generated_at_utc: new Date().toISOString(),
          research_commit: summary.verified_research_commit,
          inspected: inspected.length,
          identity_safe: selected.length,
          held: held.length,
          rows: inspected,
        },
        null,
        2
      )}\n`,
      'utf8'
    );
    fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(OUT, 'HELD_CANDIDATES.json'),
      `${JSON.stringify(held, null, 2)}\n`,
      'utf8'
    );

    console.log(
      JSON.stringify(
        {
          inspected: inspected.length,
          identity_safe: selected.length,
          held: held.length,
        },
        null,
        2
      )
    );
    if (selected.length === 0) process.exit(45);
  } finally {
    cleanup();
  }
}

main();

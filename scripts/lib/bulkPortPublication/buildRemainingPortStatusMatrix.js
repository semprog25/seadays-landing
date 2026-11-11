'use strict';

const fs = require('fs');
const path = require('path');
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./stage65PublicationGuards');
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  buildPublishedSlugSet,
  exclusionReasonForSlug,
} = require('./stage43PublishedBaseline');
const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize');

const CATALOGUE_SLOTS = 406;
const REMAINING_62_REF = 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json';

function collectLivePeSlugSet(guides) {
  const slugs = new Set();
  for (const guide of Object.values(guides?.byAppPortId || {})) {
    const slug = guide?.researchImport?.landing_slug;
    if (slug && usesPassengerEditorialLead(guide)) slugs.add(slug);
  }
  return slugs;
}

function loadStage53PortRow(repoRoot, landingSlug) {
  const manifestPath = path.join(repoRoot, 'qa-evidence/stage53-11-port-release/STAGE53_RELEASE_MANIFEST.json');
  if (!fs.existsSync(manifestPath)) return null;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return (manifest.ports || []).find((p) => p.landing_slug === landingSlug) || null;
}

function loadRemaining62Inventory(repoRoot) {
  const p = path.join(repoRoot, REMAINING_62_REF);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function guideForSlug(guides, landingSlug) {
  for (const guide of Object.values(guides?.byAppPortId || {})) {
    if (guide?.researchImport?.landing_slug === landingSlug) return guide;
  }
  return null;
}

function buildRemainingPortStatusMatrix(repoRoot) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..');
  const guides = loadPublicPortGuidesFile(repo);
  removeStage65ExcludedGuideEntries(guides);
  const livePe = countPassengerEditorialGuides(guides);
  const livePeSlugs = collectLivePeSlugSet(guides);
  const publishedSet = buildPublishedSlugSet(repo);

  const inventory62 = loadRemaining62Inventory(repo);
  const remainingSlugs = new Set();
  if (Array.isArray(inventory62)) {
    for (const row of inventory62) {
      const slug = row.landing_slug;
      if (!slug || livePeSlugs.has(slug)) continue;
      remainingSlugs.add(slug);
    }
  }

  const rows = [];
  for (const landingSlug of [...remainingSlugs].sort()) {
    const inv = inventory62.find((r) => r.landing_slug === landingSlug);
    const guide = guideForSlug(guides, landingSlug);
    const stage53 = loadStage53PortRow(repo, landingSlug);
    const historicalHold = STAGE43_HARD_EXCLUDE_HISTORICAL.has(landingSlug);
    const exclusionReason = exclusionReasonForSlug(landingSlug, publishedSet);

    let policyStatus = 'unpublished';
    if (historicalHold) policyStatus = 'historical_stage43_policy_held';
    else if (exclusionReason) policyStatus = exclusionReason;

    rows.push({
      landing_slug: landingSlug,
      app_port_id: inv?.app_port_id || guide?.appPortId || stage53?.app_port_id || null,
      research_sha256:
        guide?.researchImport?.research_sha256 || stage53?.research_sha256 || inv?.research_sha256 || null,
      research_qa_verdict: inv?.qa_verdict || guide?.researchImport?.qa_verdict || stage53?.qa_verdict || null,
      policy_status: policyStatus,
      editorial_readiness: stage53?.publication_gates_pass
        ? 'stage53_proposed_pass'
        : inv?.publication_bucket || guide?.researchImport?.publication_tier || 'needs_review',
      category_stage75: inv?.category || null,
      owner_publication_authorized: guide?.researchImport?.owner_publication_authorized === true,
      owner_indexing_authorized: guide?.researchImport?.owner_indexing_authorized === true,
      field_exclusions: stage53?.field_exclusions || [],
      proposed_content_hash: stage53?.proposed_content_hash || null,
      batch_01_candidate: [
        'bod-norway',
        'mumbai-india',
        'ravenna-italy',
        'mormugao-port-goa-india',
      ].includes(landingSlug),
    });
  }

  const historicalHeld = rows.filter((r) => r.policy_status === 'historical_stage43_policy_held').length;

  return {
    schema_version: 1,
    generated_at_utc: new Date().toISOString(),
    authoritative_inputs: {
      remaining_62_inventory: REMAINING_62_REF,
      stage53_release: 'qa-evidence/stage53-11-port-release/STAGE53_RELEASE_MANIFEST.json',
      stage43_historical_ledger: 'scripts/lib/bulkPortPublication/stage43PublishedBaseline.js',
    },
    baseline: {
      catalogue_passenger_editorial_slots: CATALOGUE_SLOTS,
      live_passenger_editorial: livePe,
      remaining_unpublished: rows.length,
      reconcile: livePe + rows.length === CATALOGUE_SLOTS,
    },
    summary: {
      historical_policy_held: historicalHeld,
      otherwise_blocked_or_unpublished: rows.length - historicalHeld,
      batch_01_in_remaining: rows.filter((r) => r.batch_01_candidate).length,
    },
    rows,
  };
}

function writeRemainingPortStatusMatrix(repoRoot, outRel) {
  const matrix = buildRemainingPortStatusMatrix(repoRoot);
  const outPath = path.join(repoRoot, outRel || 'qa-evidence/publication-batch-01/REMAINING_PORT_STATUS_MATRIX.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
  return { path: outPath, matrix };
}

module.exports = {
  CATALOGUE_SLOTS,
  buildRemainingPortStatusMatrix,
  writeRemainingPortStatusMatrix,
};

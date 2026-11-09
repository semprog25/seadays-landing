#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards');
const path = require('path');
const crypto = require('crypto');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';

const REPO = path.join(__dirname, '..');
const STAGE44 = path.join(REPO, 'qa-evidence', 'stage44-7-port-release');
const STAGE43_DRAFTS = path.join(REPO, 'qa-evidence', 'stage43-next-cohort', 'drafts');
const EXPECTED_STAGE43_BUNDLE = '40be0c1e5d0d3c9b0578b745875ce78375173d25b2af8cfe2300aad4da567b66';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'INTEGRITY_STOP', message: msg }, null, 2));
  process.exit(42);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE44, 'STAGE44_RELEASE_MANIFEST.json'), 'utf8'));

  if (manifest.stage43_source_bundle_hash !== EXPECTED_STAGE43_BUNDLE) {
    fail('stage43 bundle mismatch');
  }
  const slugs = manifest.slugs_locked.slice().sort();
  if (slugs.length !== 7) fail(`expected 7 slugs, got ${slugs.length}`);

  const portsBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]));
  const appIds = new Set();

  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    if (!row?.production_apply_allowed) fail(`not allowed: ${landingSlug}`);
    if (!row.publication_gates_pass) fail(`gates failed: ${landingSlug}`);
    if (appIds.has(row.app_port_id)) fail(`duplicate appPortId: ${row.app_port_id}`);
    appIds.add(row.app_port_id);

    const proposedPath = path.join(REPO, row.proposed_guide_ref);
    if (!fs.existsSync(proposedPath)) fail(`missing proposed: ${landingSlug}`);

    const draftPath = path.join(STAGE43_DRAFTS, `${landingSlug}.json`);
    if (sha256File(draftPath) !== row.draft_file_sha256) fail(`draft sha mismatch ${landingSlug}`);

    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) fail(`research sha mismatch ${landingSlug}`);

    const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));
    const exclusions = (proposed.researchImport?.field_exclusions || []).slice().sort().join(',');
    const manifestEx = (row.field_exclusions || []).slice().sort().join(',');
    if (exclusions !== manifestEx) fail(`field_exclusions mismatch ${landingSlug}`);
  }

  const guides = loadPublicPortGuidesFile(REPO);
  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json');
  const terminalsJsonBefore = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';

  const rollbackDir = path.join(STAGE44, 'rollback-pre-apply');
  if (!dryRun) {
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'));
    if (fs.existsSync(terminalsPath)) {
      fs.copyFileSync(terminalsPath, path.join(rollbackDir, 'public-port-terminals.json'));
    }
    for (const landingSlug of slugs) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) {
        fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true });
        fs.copyFileSync(page, path.join(rollbackDir, 'ports', landingSlug, 'index.html'));
      }
    }
  }

  const nextGuides = JSON.parse(JSON.stringify(guides));
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const proposed = JSON.parse(fs.readFileSync(path.join(REPO, row.proposed_guide_ref), 'utf8'));
    const g = JSON.parse(JSON.stringify(proposed));
    g.researchImport = {
      ...(g.researchImport || {}),
      publication_tier: 'passenger_editorial',
      stage44_release_prep: true,
      owner_publication_authorized: false,
      stage43_source_bundle_hash: EXPECTED_STAGE43_BUNDLE,
      stage44_release_bundle_hash: manifest.bundle_idempotency_hash,
      applied_at_utc: new Date().toISOString(),
      field_exclusions: row.field_exclusions || [],
      stage43_candidate_content_hash: row.stage43_candidate_content_hash,
    };
    assignPublicPortGuideByAppPortId(nextGuides, { landingSlug, appPortId: row.app_port_id, guide: g, priorGuideAtSlot: guides.byAppPortId[row.app_port_id] });
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, slugs }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  if (terminalsJsonBefore && fs.existsSync(terminalsPath)) {
    if (fs.readFileSync(terminalsPath, 'utf8') !== terminalsJsonBefore) {
      fail('terminals json mutated');
    }
  }

  const applyReport = {
    applied_at: new Date().toISOString(),
    stage43_source_bundle_hash: EXPECTED_STAGE43_BUNDLE,
    stage44_release_bundle_hash: manifest.bundle_idempotency_hash,
    slugs,
    app_port_ids: [...appIds].sort(),
    rollback_dir: rollbackDir,
  };
  fs.writeFileSync(path.join(STAGE44, 'STAGE44_APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, applied: slugs.length }, null, 2));
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { DEFAULT_RESEARCH } = require('./lib/bulkPortPublication/eligibility');

const REPO = path.join(__dirname, '..');
const STAGE34 = path.join(REPO, 'qa-evidence', 'stage34-14-port-release');
const EXPECTED_STAGE33_BUNDLE = '2b15a9d47cd2a964ab9fb9a214522b4116ddde4b514b978d8c70e308cbfd80fa';

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
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE34, 'STAGE34_RELEASE_MANIFEST.json'), 'utf8'));

  if (manifest.stage33_source_bundle_hash !== EXPECTED_STAGE33_BUNDLE) {
    fail(`stage33 bundle mismatch`);
  }
  const slugs = manifest.slugs_locked.slice().sort();
  if (slugs.length !== 14) fail(`expected 14 slugs, got ${slugs.length}`);

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

    const draftPath = path.join(REPO, 'qa-evidence/stage28-bulk-candidates/drafts', `${landingSlug}.json`);
    if (sha256File(draftPath) !== row.draft_file_sha256) fail(`draft sha mismatch ${landingSlug}`);
    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) fail(`research sha mismatch ${landingSlug}`);
  }

  const guides = loadPublicPortGuidesFile(REPO);
  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json');
  const terminalsJsonBefore = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';

  const rollbackDir = path.join(STAGE34, 'rollback-pre-apply');
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
      stage34_release_prep: true,
      owner_publication_authorized: false,
      stage33_source_bundle_hash: EXPECTED_STAGE33_BUNDLE,
      stage34_release_bundle_hash: manifest.bundle_idempotency_hash,
      applied_at_utc: new Date().toISOString(),
      field_exclusions: row.field_exclusions || [],
      stage33_candidate_content_hash: row.candidate_content_hash,
    };
    nextGuides.byAppPortId[row.app_port_id] = g;
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
    stage33_source_bundle_hash: EXPECTED_STAGE33_BUNDLE,
    stage34_release_bundle_hash: manifest.bundle_idempotency_hash,
    slugs,
    app_port_ids: [...appIds].sort(),
    rollback_dir: rollbackDir,
  };
  fs.writeFileSync(path.join(STAGE34, 'STAGE34_APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, applied: slugs.length }, null, 2));
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');

const REPO = path.join(__dirname, '..');
const STAGE53 = path.join(REPO, 'qa-evidence', 'stage53-11-port-release');
const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'INTEGRITY_STOP', message: msg }, null, 2));
  process.exit(42);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE53_RELEASE_MANIFEST.json'), 'utf8'));
  const slugs = manifest.slugs_locked.slice().sort();
  const portsBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]));
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;

  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    if (!row?.production_apply_allowed) fail(`not allowed: ${landingSlug}`);
    const proposedPath = path.join(REPO, row.proposed_guide_ref);
    if (!fs.existsSync(proposedPath)) fail(`missing proposed: ${landingSlug}`);
    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) fail(`research sha ${landingSlug}`);
  }

  const guides = loadPublicPortGuidesFile(REPO);
  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const rollbackDir = path.join(STAGE53, 'rollback-pre-apply');

  if (!dryRun) {
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'));
    if (terminalsBefore) fs.copyFileSync(terminalsPath, path.join(rollbackDir, 'public-port-terminals.json'));
    for (const landingSlug of slugs) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) {
        fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true });
        fs.copyFileSync(page, path.join(rollbackDir, 'ports', landingSlug, 'index.html'));
      }
    }
  }

  const nextGuides = JSON.parse(JSON.stringify(guides));
  const appIds = [];
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const proposed = JSON.parse(fs.readFileSync(path.join(REPO, row.proposed_guide_ref), 'utf8'));
    const g = JSON.parse(JSON.stringify(proposed));
    g.researchImport = {
      ...(g.researchImport || {}),
      publication_tier: 'passenger_editorial',
      stage53_release_prep: true,
      owner_publication_authorized: false,
      stage45_rescore_bundle_hash: manifest.stage45_rescore_bundle_hash,
      stage53_release_bundle_hash: manifest.bundle_idempotency_hash,
      applied_at_utc: new Date().toISOString(),
      field_exclusions: row.field_exclusions || [],
    };
    nextGuides.byAppPortId[row.app_port_id] = g;
    appIds.push(row.app_port_id);
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, slugs }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  if (terminalsBefore && fs.existsSync(terminalsPath) && fs.readFileSync(terminalsPath, 'utf8') !== terminalsBefore) {
    fail('terminals json mutated unexpectedly');
  }

  const report = {
    applied_at: new Date().toISOString(),
    stage45_rescore_bundle_hash: manifest.stage45_rescore_bundle_hash,
    stage53_release_bundle_hash: manifest.bundle_idempotency_hash,
    slugs,
    app_port_ids: appIds.sort(),
    rollback_dir: rollbackDir,
    production_baseline_sha: manifest.production_baseline_sha,
  };
  fs.writeFileSync(path.join(STAGE53, 'STAGE53_APPLY_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, slugs: slugs.length, only: slugs.join(',') }, null, 2));
}

main();

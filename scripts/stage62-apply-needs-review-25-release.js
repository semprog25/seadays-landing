#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/needs-review-25-recovery');
const MANIFEST = path.join(EVIDENCE, 'NEEDS_REVIEW_25_MANIFEST.json');
const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE62_APPLY_STOP', message: msg }, null, 2));
  process.exit(42);
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const onlyArg = process.argv.find((a) => a.startsWith('--only='));
  const onlyFilter = onlyArg ? new Set(onlyArg.replace('--only=', '').split(',').map((s) => s.trim())) : null;

  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  let slugs = (manifest.slugs_approved || []).slice().sort();
  if (onlyFilter) slugs = slugs.filter((s) => onlyFilter.has(s));
  if (!slugs.length) fail('no approved slugs to apply');

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
  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply');

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
      needs_review_25_release_prep: true,
      owner_publication_authorized: false,
      needs_review_25_bundle_hash: manifest.bundle_idempotency_hash,
      applied_at_utc: new Date().toISOString(),
      field_exclusions: row.field_exclusions || [],
    };
    assignPublicPortGuideByAppPortId(nextGuides, { landingSlug, appPortId: row.app_port_id, guide: g, priorGuideAtSlot: guides.byAppPortId[row.app_port_id] });
  }

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, slugs }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  const only = slugs.join(',');
  execSync(`node scripts/generateBlogs.js --ports-only --only=${only}`, { cwd: REPO, stdio: 'inherit' });

  const applyReport = {
    applied_at_utc: new Date().toISOString(),
    slugs,
    bundle_hash: manifest.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
  };
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(applyReport, null, 2));
}

main();

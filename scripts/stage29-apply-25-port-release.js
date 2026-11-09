#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards');
const path = require('path');
const crypto = require('crypto');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { DEFAULT_RESEARCH } = require('./lib/bulkPortPublication/eligibility');
const STAGE28_BUNDLE = '50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad';

const REPO = path.join(__dirname, '..');
const STAGE29 = path.join(REPO, 'qa-evidence', 'stage29-25-port-release');

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
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_RELEASE_MANIFEST.json'), 'utf8'));

  if (manifest.stage28_source_bundle_hash !== STAGE28_BUNDLE) {
    fail(`stage28 bundle mismatch: ${manifest.stage28_source_bundle_hash}`);
  }
  const slugs = manifest.slugs_locked.slice().sort();
  const expected = manifest.candidate_count || 25;
  if (slugs.length !== expected) fail(`expected ${expected} slugs, got ${slugs.length}`);

  const portsBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]));
  const appIds = new Set();
  const integrity = [];

  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    if (!row?.production_apply_allowed) fail(`not allowed: ${landingSlug}`);
    if (!row.publication_gates_pass) fail(`gates failed: ${landingSlug}`);
    if (appIds.has(row.app_port_id)) fail(`duplicate appPortId: ${row.app_port_id}`);
    appIds.add(row.app_port_id);

    const proposedPath = path.join(REPO, row.proposed_guide_ref);
    const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));
    if (proposed.researchImport?.field_exclusions) {
      const a = proposed.researchImport.field_exclusions.slice().sort().join(',');
      const b = (row.field_exclusions || []).slice().sort().join(',');
      if (a !== b) fail(`field_exclusions mismatch ${landingSlug}`);
    }

    const draftPath = path.join(REPO, 'qa-evidence/stage28-bulk-candidates/drafts', `${landingSlug}.json`);
   	const draftSha = sha256File(draftPath);
    if (draftSha !== row.draft_file_sha256) fail(`draft sha mismatch ${landingSlug}`);
    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) fail(`research sha mismatch ${landingSlug}`);

    const stage28Hash = crypto
      .createHash('sha256')
      .update(
        stableStringify({
          note: 'proposed_content_hash',
          landing_slug: landingSlug,
          hash: row.proposed_content_hash,
        })
      )
      .digest('hex');
    void stage28Hash;
    if (row.stage28_candidate_content_hash !== row.candidate_content_hash) {
      fail(`manifest hash linkage broken ${landingSlug}`);
    }

    integrity.push({ landing_slug: landingSlug, stage28_hash: row.stage28_candidate_content_hash });
  }

  const guides = loadPublicPortGuidesFile(REPO);
  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json');
  const terminalsJsonBefore = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';

  const rollbackDir = path.join(STAGE29, 'rollback-pre-apply');
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
      stage29_release_prep: true,
      owner_publication_authorized: false,
      stage28_source_bundle_hash: STAGE28_BUNDLE,
      stage29_release_bundle_hash: manifest.bundle_idempotency_hash,
      applied_at_utc: new Date().toISOString(),
      field_exclusions: row.field_exclusions || [],
      stage28_candidate_content_hash: row.stage28_candidate_content_hash,
    };
    assignPublicPortGuideByAppPortId(nextGuides, { landingSlug, appPortId: row.app_port_id, guide: g, priorGuideAtSlot: guides.byAppPortId[row.app_port_id] });
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, dry_run: true, slugs, integrity_count: integrity.length }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  if (terminalsJsonBefore && fs.existsSync(terminalsPath)) {
    if (fs.readFileSync(terminalsPath, 'utf8') !== terminalsJsonBefore) {
      fail('public-port-terminals.json mutated during guide apply');
    }
  }

  const applyReport = {
    applied_at: new Date().toISOString(),
    stage28_source_bundle_hash: STAGE28_BUNDLE,
    stage29_release_bundle_hash: manifest.bundle_idempotency_hash,
    slugs,
    app_port_ids: [...appIds],
    integrity,
    rollback_dir: rollbackDir,
  };
  fs.writeFileSync(path.join(STAGE29, 'STAGE29_APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: true, applied: slugs.length, rollbackDir }, null, 2));
}

main();

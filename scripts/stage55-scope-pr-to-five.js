#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const { writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');

const REPO = path.join(__dirname, '..');
const STAGE53 = path.join(REPO, 'qa-evidence', 'stage53-11-port-release');
const ROLLBACK = path.join(STAGE53, 'rollback-pre-apply');
const EXPECTED_BUNDLE = '6d6e0088ab641179e0f3fc95d6279ac99bd533094bdd86921df06d1f60b6ad3f';

const APPROVED = [
  'almeria-spain',
  'harstad-norway',
  'montego-bay-jamaica',
  'roseau-dominica',
  'la-romana-dominican-republic',
].sort();

const HELD = [
  'bod-norway',
  'eilat-israel',
  'ravenna-italy',
  'trieste-italy',
  'mormugao-port-goa-india',
  'mumbai-india',
].sort();

const HELD_APP_IDS = {
  'bod-norway': 'bodo',
  'eilat-israel': 'eilat',
  'ravenna-italy': 'ravenna',
  'trieste-italy': 'trieste',
  'mormugao-port-goa-india': 'mormugao',
  'mumbai-india': 'mumbai',
};

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE55_STOP', message: msg }, null, 2));
  process.exit(41);
}

function main() {
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(ROLLBACK, 'public-port-guides.json'), 'utf8'));

  for (const slug of HELD) {
    const id = HELD_APP_IDS[slug];
    if (!rollbackGuides.byAppPortId[id]) fail(`rollback missing guide ${slug}`);
    guides.byAppPortId[id] = JSON.parse(JSON.stringify(rollbackGuides.byAppPortId[id]));
    const htmlRollback = path.join(ROLLBACK, 'ports', slug, 'index.html');
    const htmlLive = path.join(REPO, 'ports', slug, 'index.html');
    if (!fs.existsSync(htmlRollback)) fail(`rollback html missing ${slug}`);
    fs.copyFileSync(htmlRollback, htmlLive);
  }

  writePublicPortGuidesFile(REPO, guides);

  const oldManifest = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE53_RELEASE_MANIFEST.json'), 'utf8'));
  const ports = oldManifest.ports.filter((p) => APPROVED.includes(p.landing_slug));
  if (ports.length !== 5) fail(`expected 5 manifest ports, got ${ports.length}`);

  const bundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        ports.map((p) => ({
          landing_slug: p.landing_slug,
          proposed_content_hash: p.proposed_content_hash,
          draft_file_sha256: p.draft_file_sha256,
          research_sha256: p.research_sha256,
        }))
      )
    )
    .digest('hex');

  if (bundleHash !== EXPECTED_BUNDLE) {
    fail(`bundle hash mismatch: got ${bundleHash}, expected ${EXPECTED_BUNDLE}`);
  }

  const stage55Manifest = {
    ...oldManifest,
    lock_version: 'stage55-5-port-release-v1',
    schema_note: 'Scoped from stage53-11-port-release per STAGE54_RELEASE_DECISION.md',
    stage53_parent_bundle_hash: oldManifest.bundle_idempotency_hash,
    bundle_idempotency_hash: bundleHash,
    candidate_count: 5,
    passing_all_gates: 5,
    slugs_locked: APPROVED,
    slugs_excluded_stage54_hold: HELD,
    app_port_ids: ports.map((p) => p.app_port_id).sort(),
    ports,
  };

  fs.writeFileSync(path.join(STAGE53, 'STAGE55_RELEASE_MANIFEST.json'), `${JSON.stringify(stage55Manifest, null, 2)}\n`, 'utf8');

  const apply = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE53_APPLY_REPORT.json'), 'utf8'));
  const stage55Apply = {
    ...apply,
    scoped_at: new Date().toISOString(),
    stage53_release_bundle_hash: apply.stage53_release_bundle_hash,
    stage55_release_bundle_hash: bundleHash,
    slugs: APPROVED,
    app_port_ids: stage55Manifest.app_port_ids,
    slugs_excluded: HELD,
  };
  fs.writeFileSync(path.join(STAGE53, 'STAGE55_APPLY_REPORT.json'), `${JSON.stringify(stage55Apply, null, 2)}\n`, 'utf8');

  // Keep stage53 apply report for audit; validation uses STAGE55_APPLY_REPORT
  fs.writeFileSync(path.join(REPO, 'STAGE55_5_PORT_RELEASE_PROPOSAL.json'), `${JSON.stringify(stage55Manifest, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({ ok: true, bundle: bundleHash, approved: APPROVED, held_restored: HELD }, null, 2));
}

main();

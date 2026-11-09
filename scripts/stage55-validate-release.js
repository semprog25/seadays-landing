#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const STAGE53 = path.join(REPO, 'qa-evidence', 'stage53-11-port-release');
const EXPECTED_BUNDLE = '6d6e0088ab641179e0f3fc95d6279ac99bd533094bdd86921df06d1f60b6ad3f';

const HELD = [
  'bod-norway',
  'eilat-israel',
  'ravenna-italy',
  'trieste-italy',
  'mormugao-port-goa-india',
  'mumbai-india',
];

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE55_RELEASE_MANIFEST.json'), 'utf8'));
  const apply = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE55_APPLY_REPORT.json'), 'utf8'));
  if (apply.stage55_release_bundle_hash !== EXPECTED_BUNDLE) throw new Error('bundle mismatch');
  if (manifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) throw new Error('manifest bundle mismatch');

  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(STAGE53, 'rollback-pre-apply/public-port-guides.json'), 'utf8'));
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));

  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBeforePath = path.join(STAGE53, 'rollback-pre-apply/public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : '';
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  for (const slug of HELD) {
    const row = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE53_RELEASE_MANIFEST.json'), 'utf8')).ports.find(
      (p) => p.landing_slug === slug
    );
    if (!row) throw new Error(`held row missing ${slug}`);
    const id = row.app_port_id;
    if (sha(rollbackGuides.byAppPortId[id]) !== sha(guides.byAppPortId[id])) {
      throw new Error(`held guide still mutated: ${slug}`);
    }
    const rollbackHtml = fs.readFileSync(path.join(STAGE53, 'rollback-pre-apply/ports', slug, 'index.html'), 'utf8');
    const liveHtml = fs.readFileSync(path.join(REPO, 'ports', slug, 'index.html'), 'utf8');
    if (rollbackHtml !== liveHtml) throw new Error(`held html still mutated: ${slug}`);
  }

  const slugs = apply.slugs.slice().sort();
  if (slugs.length !== 5) throw new Error(`expected 5 slugs, got ${slugs.length}`);

  const htmlResults = [];
  for (const landingSlug of slugs) {
    const row = manifest.ports.find((p) => p.landing_slug === landingSlug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId[id];
    const after = guides.byAppPortId[id];
    if (sha(before) === sha(after)) throw new Error(`guide unchanged for approved ${landingSlug}`);
    if (after.researchImport?.publication_tier !== 'passenger_editorial') {
      throw new Error(`missing passenger tier: ${landingSlug}`);
    }

    const htmlPath = path.join(REPO, 'ports', landingSlug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${landingSlug}`);
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${landingSlug}`);
    if (/\[S\d+\]/.test(html)) throw new Error(`research marker in html: ${landingSlug}`);

    const v = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: false });
    htmlResults.push({ landing_slug: landingSlug, ok: v.ok, issues: v.issues });
    if (!v.ok) throw new Error(`html validation ${landingSlug}: ${v.issues.join(';')}`);
  }

  const out = {
    ok: true,
    stage55_release_bundle_hash: EXPECTED_BUNDLE,
    slug_count: 5,
    held_ports_unchanged: HELD,
    terminals_unchanged: true,
    html_results: htmlResults,
  };
  fs.writeFileSync(path.join(STAGE53, 'STAGE55_VALIDATION_REPORT.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

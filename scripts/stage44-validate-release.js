#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const STAGE44 = path.join(REPO, 'qa-evidence', 'stage44-7-port-release');
const EXPECTED_STAGE43_BUNDLE = '40be0c1e5d0d3c9b0578b745875ce78375173d25b2af8cfe2300aad4da567b66';

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(STAGE44, 'STAGE44_APPLY_REPORT.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE44, 'STAGE44_RELEASE_MANIFEST.json'), 'utf8'));
  if (manifest.stage43_source_bundle_hash !== EXPECTED_STAGE43_BUNDLE) throw new Error('stage43 bundle mismatch');
  if (apply.stage44_release_bundle_hash !== manifest.bundle_idempotency_hash) {
    throw new Error('stage44 release bundle mismatch');
  }

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(STAGE44, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  );
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBeforePath = path.join(STAGE44, 'rollback-pre-apply/public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : '';
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  const hamburgBefore = sha(rollbackGuides.byAppPortId.hamburg);
  const hamburgAfter = sha(guides.byAppPortId.hamburg);
  if (hamburgBefore !== hamburgAfter) throw new Error('hamburg guide mutated');

  const singaporeBefore = sha(rollbackGuides.byAppPortId.singapore);
  const singaporeAfter = sha(guides.byAppPortId.singapore);
  if (singaporeBefore !== singaporeAfter) throw new Error('singapore guide mutated');

  if (sha(rollbackGuides.byAppPortId.eilat) !== sha(guides.byAppPortId.eilat)) {
    throw new Error('eilat guide must remain unchanged');
  }

  const htmlResults = [];
  const changedAppIds = [];

  for (const slug of apply.slugs) {
    const row = manifest.ports.find((p) => p.landing_slug === slug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId[id];
    const after = guides.byAppPortId[id];
    if (sha(before) === sha(after)) throw new Error(`guide unchanged for ${slug}`);

    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    if (!fs.existsSync(htmlPath)) throw new Error(`missing html: ${slug}`);
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${slug}`);
    if (!/id="getting-there"|id='getting-there'/.test(html)) throw new Error(`missing getting there: ${slug}`);
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${slug}`);

    const rollbackHtmlPath = path.join(STAGE44, 'rollback-pre-apply/ports', slug, 'index.html');
    const rollbackHtml = fs.existsSync(rollbackHtmlPath) ? fs.readFileSync(rollbackHtmlPath, 'utf8') : '';
    const hadMap = rollbackHtml && /id="port-terminal-map"/.test(rollbackHtml);
    const hasMap = /id="port-terminal-map"/.test(html);
    if (hasMap && !hadMap) throw new Error(`terminal map introduced: ${slug}`);

    const leakBlob = JSON.stringify({
      portInfo: after.portInfo,
      gettingThere: after.gettingThere,
      thingsToDo: after.thingsToDo,
    });
    if (containsInternalResearchLeak(leakBlob)) throw new Error(`json leak: ${slug}`);

    const v = validateGeneratedPortHtml(html, { slug, previewFragment: false });
    const rb = rollbackHtml
      ? validateGeneratedPortHtml(rollbackHtml, { slug, previewFragment: false })
      : { issues: [] };
    const regressions = v.issues.filter((i) => !rb.issues.includes(i));
    if (regressions.length) throw new Error(`html regression ${slug}: ${regressions.join(';')}`);

    htmlResults.push({ landing_slug: slug, ok: true, issues: v.issues });
    changedAppIds.push(id);
  }

  if (changedAppIds.length !== 7) throw new Error(`expected 7 guide mutations, got ${changedAppIds.length}`);

  const out = {
    ok: true,
    stage43_source_bundle_hash: EXPECTED_STAGE43_BUNDLE,
    stage44_release_bundle_hash: manifest.bundle_idempotency_hash,
    changed_app_port_ids: changedAppIds.sort(),
    hamburg_unchanged: true,
    singapore_unchanged: true,
    terminals_unchanged: true,
    html_results: htmlResults,
  };
  fs.writeFileSync(path.join(STAGE44, 'STAGE44_VALIDATION_REPORT.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const STAGE34 = path.join(REPO, 'qa-evidence', 'stage34-14-port-release');
const EXPECTED_STAGE33_BUNDLE = '2b15a9d47cd2a964ab9fb9a214522b4116ddde4b514b978d8c70e308cbfd80fa';

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(STAGE34, 'STAGE34_APPLY_REPORT.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE34, 'STAGE34_RELEASE_MANIFEST.json'), 'utf8'));
  if (manifest.stage33_source_bundle_hash !== EXPECTED_STAGE33_BUNDLE) throw new Error('stage33 bundle mismatch');
  if (apply.stage34_release_bundle_hash !== manifest.bundle_idempotency_hash) {
    throw new Error('release bundle mismatch');
  }

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(STAGE34, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  );
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBefore = fs.readFileSync(
    path.join(STAGE34, 'rollback-pre-apply/public-port-terminals.json'),
    'utf8'
  );
  if (terminalsNow !== terminalsBefore) throw new Error('terminals changed');

  if (sha(rollbackGuides.byAppPortId.hamburg) !== sha(guides.byAppPortId.hamburg)) {
    throw new Error('hamburg mutated');
  }
  if (sha(rollbackGuides.byAppPortId.aalborg) !== sha(guides.byAppPortId.aalborg)) {
    throw new Error('aalborg mutated');
  }

  const htmlResults = [];
  const changedAppIds = [];

  for (const slug of apply.slugs) {
    const row = manifest.ports.find((p) => p.landing_slug === slug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId[id];
    const after = guides.byAppPortId[id];
    if (sha(before) === sha(after)) throw new Error(`guide unchanged ${slug}`);

    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('pg-call-plan-card')) throw new Error(`missing cards ${slug}`);
    if (!/id="getting-there"|id='getting-there'/.test(html)) throw new Error(`missing getting there ${slug}`);
    if (containsInternalResearchLeak(html)) throw new Error(`html leak ${slug}`);

    const rbHtml = path.join(STAGE34, 'rollback-pre-apply/ports', slug, 'index.html');
    const hadMap = fs.existsSync(rbHtml) && /id="port-terminal-map"/.test(fs.readFileSync(rbHtml, 'utf8'));
    const hasMap = /id="port-terminal-map"/.test(html);
    if (hasMap && !hadMap) throw new Error(`terminal map introduced ${slug}`);

    const v = validateGeneratedPortHtml(html, { slug, previewFragment: false });
    const rollbackHtml = fs.existsSync(rbHtml) ? fs.readFileSync(rbHtml, 'utf8') : '';
    const rb = rollbackHtml ? validateGeneratedPortHtml(rollbackHtml, { slug, previewFragment: false }) : { issues: [] };
    const regressions = v.issues.filter((i) => !rb.issues.includes(i));
    if (regressions.length) throw new Error(`regression ${slug}: ${regressions.join(';')}`);

    const leakBlob = JSON.stringify({
      portInfo: after.portInfo,
      gettingThere: after.gettingThere,
      thingsToDo: after.thingsToDo,
    });
    if (containsInternalResearchLeak(leakBlob)) throw new Error(`json leak ${slug}`);

    htmlResults.push({ landing_slug: slug, ok: true, issues: v.issues });
    changedAppIds.push(id);
  }

  if (changedAppIds.length !== 14) throw new Error(`expected 14 mutations got ${changedAppIds.length}`);

  const out = {
    ok: true,
    stage33_source_bundle_hash: EXPECTED_STAGE33_BUNDLE,
    stage34_release_bundle_hash: manifest.bundle_idempotency_hash,
    changed_app_port_ids: changedAppIds.sort(),
    html_results: htmlResults,
  };
  fs.writeFileSync(path.join(STAGE34, 'STAGE34_VALIDATION_REPORT.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

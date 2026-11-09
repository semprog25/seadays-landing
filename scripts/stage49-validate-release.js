#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const STAGE49 = path.join(REPO, 'qa-evidence', 'stage49-33-port-release');

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE49, 'STAGE49_RELEASE_MANIFEST.json'), 'utf8'));
  const apply = JSON.parse(fs.readFileSync(path.join(STAGE49, 'STAGE49_APPLY_REPORT.json'), 'utf8'));
  if (apply.stage49_release_bundle_hash !== manifest.bundle_idempotency_hash) {
    throw new Error('stage49 release bundle mismatch');
  }

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(STAGE49, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  );
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBeforePath = path.join(STAGE49, 'rollback-pre-apply/public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : '';
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  const unchangedIds = ['hamburg', 'singapore', 'eilat'];
  for (const id of unchangedIds) {
    if (rollbackGuides.byAppPortId[id] && guides.byAppPortId[id]) {
      if (sha(rollbackGuides.byAppPortId[id]) !== sha(guides.byAppPortId[id])) {
        throw new Error(`${id} guide mutated unexpectedly`);
      }
    }
  }

  const htmlResults = [];
  const slugs = apply.slugs.slice().sort();
  for (const landingSlug of slugs) {
    const row = manifest.ports.find((p) => p.landing_slug === landingSlug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId[id];
    const after = guides.byAppPortId[id];
    if (sha(before) === sha(after)) throw new Error(`guide unchanged for ${landingSlug}`);

    const htmlPath = path.join(REPO, 'ports', landingSlug, 'index.html');
    if (!fs.existsSync(htmlPath)) throw new Error(`missing html: ${landingSlug}`);
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${landingSlug}`);
    if (!/id="getting-there"|id='getting-there'/.test(html)) throw new Error(`missing getting there: ${landingSlug}`);
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${landingSlug}`);
    if (/\[S\d+\]/.test(html)) throw new Error(`research marker in html: ${landingSlug}`);

    const rollbackHtmlPath = path.join(STAGE49, 'rollback-pre-apply/ports', landingSlug, 'index.html');
    const rollbackHtml = fs.existsSync(rollbackHtmlPath) ? fs.readFileSync(rollbackHtmlPath, 'utf8') : '';
    const hadMap = rollbackHtml && /id="port-terminal-map"/.test(rollbackHtml);
    const hasMap = /id="port-terminal-map"/.test(html);
    if (hasMap && !hadMap) throw new Error(`terminal map introduced: ${landingSlug}`);

    const leakBlob = JSON.stringify({
      portInfo: after.portInfo,
      gettingThere: after.gettingThere,
      thingsToDo: after.thingsToDo,
    });
    if (containsInternalResearchLeak(leakBlob)) throw new Error(`json leak: ${landingSlug}`);

    const v = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: false });
    htmlResults.push({ landing_slug: landingSlug, ok: v.ok, issues: v.issues });
    if (!v.ok) throw new Error(`html validation ${landingSlug}: ${v.issues.join(';')}`);
  }

  const out = {
    ok: true,
    stage49_release_bundle_hash: manifest.bundle_idempotency_hash,
    slug_count: slugs.length,
    terminals_unchanged: true,
    html_results: htmlResults,
  };
  fs.writeFileSync(path.join(STAGE49, 'STAGE49_VALIDATION_REPORT.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

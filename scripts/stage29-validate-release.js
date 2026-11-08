#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const STAGE28_BUNDLE = '50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad';

const REPO = path.join(__dirname, '..');
const STAGE29 = path.join(REPO, 'qa-evidence', 'stage29-25-port-release');

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_APPLY_REPORT.json'), 'utf8'));
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE29, 'STAGE29_RELEASE_MANIFEST.json'), 'utf8'));
  if (manifest.stage28_source_bundle_hash !== STAGE28_BUNDLE) throw new Error('stage28 bundle mismatch');
  if (apply.stage29_release_bundle_hash !== manifest.bundle_idempotency_hash) {
    throw new Error('stage29 release bundle mismatch');
  }

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(STAGE29, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  );
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBeforePath = path.join(STAGE29, 'rollback-pre-apply/public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : '';
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  const hamburgBefore = sha(rollbackGuides.byAppPortId.hamburg);
  const hamburgAfter = sha(guides.byAppPortId.hamburg);
  if (hamburgBefore !== hamburgAfter) throw new Error('hamburg guide mutated');

  const aalborgBefore = sha(rollbackGuides.byAppPortId.aalborg);
  const aalborgAfter = sha(guides.byAppPortId.aalborg);
  if (aalborgBefore !== aalborgAfter) throw new Error('aalborg guide mutated');

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
    if (html.includes('research_markdown') || html.includes('NEEDS_FACT_CHECK')) {
      throw new Error(`research leak in html: ${slug}`);
    }
    if (/id="port-terminal-map"/.test(html)) {
      const rollbackHtml = path.join(STAGE29, 'rollback-pre-apply/ports', slug, 'index.html');
      if (fs.existsSync(rollbackHtml)) {
        const hadMap = /id="port-terminal-map"/.test(fs.readFileSync(rollbackHtml, 'utf8'));
        if (!hadMap) throw new Error(`terminal map introduced: ${slug}`);
      }
    }

    const leakBlob = JSON.stringify({
      portInfo: after.portInfo,
      gettingThere: after.gettingThere,
      thingsToDo: after.thingsToDo,
    });
    if (containsInternalResearchLeak(leakBlob)) throw new Error(`passenger leak in guide json: ${slug}`);

    const rollbackHtmlPath = path.join(STAGE29, 'rollback-pre-apply/ports', slug, 'index.html');
    const rollbackHtml = fs.existsSync(rollbackHtmlPath) ? fs.readFileSync(rollbackHtmlPath, 'utf8') : '';
    const v = validateGeneratedPortHtml(html, { slug, previewFragment: false });
    const rb = rollbackHtml
      ? validateGeneratedPortHtml(rollbackHtml, { slug, previewFragment: false })
      : { issues: [] };
    const regressions = v.issues.filter((i) => !rb.issues.includes(i));
    htmlResults.push({ landing_slug: slug, ok: regressions.length === 0, regressions, issues: v.issues });
    if (regressions.length) throw new Error(`html regression ${slug}: ${regressions.join(';')}`);
    changedAppIds.push(id);
  }

  if (changedAppIds.length !== 25) throw new Error(`expected 25 guide mutations, got ${changedAppIds.length}`);

  const out = {
    ok: true,
    stage28_source_bundle_hash: STAGE28_BUNDLE,
    stage29_release_bundle_hash: manifest.bundle_idempotency_hash,
    changed_app_port_ids: changedAppIds.sort(),
    hamburg_unchanged: true,
    aalborg_unchanged: true,
    terminals_unchanged: true,
    html_results: htmlResults,
  };
  fs.writeFileSync(path.join(STAGE29, 'STAGE29_VALIDATION_REPORT.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

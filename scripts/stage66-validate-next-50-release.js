#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage66-next-50-recovery');

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE66_NEXT_50_MANIFEST.json'), 'utf8'));
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  if (manifest.bundle_idempotency_hash !== apply.bundle_hash) throw new Error('bundle mismatch');

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  );
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json');
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : '';
  const terminalsBeforePath = path.join(EVIDENCE, 'rollback-pre-apply/public-port-terminals.json');
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : '';
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  const slugs = apply.slugs.slice().sort();
  const htmlResults = [];
  for (const landingSlug of slugs) {
    const row = manifest.ports.find((p) => p.landing_slug === landingSlug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId[id];
    const after = guides.byAppPortId[id];
    if (!after) throw new Error(`guide missing after apply: ${landingSlug}`);
    if (before && sha(before) === sha(after)) throw new Error(`guide unchanged: ${landingSlug}`);
    if (after.researchImport?.publication_tier !== 'passenger_editorial') {
      throw new Error(`missing passenger tier: ${landingSlug}`);
    }
    const htmlPath = path.join(REPO, 'ports', landingSlug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${landingSlug}`);
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${landingSlug}`);
    if (/\[S\d+\]/.test(html)) throw new Error(`research marker in html: ${landingSlug}`);
    const v = validateGeneratedPortHtml(html, {
      slug: landingSlug,
      previewFragment: false,
      expectTerminalMap: /id="port-terminal-map"/.test(html),
    });
    htmlResults.push({ landing_slug: landingSlug, ok: v.ok, issues: v.issues });
    if (!v.ok) throw new Error(`html validation ${landingSlug}: ${v.issues.join(';')}`);
  }

  const out = {
    validated_at_utc: new Date().toISOString(),
    slugs,
    bundle_hash: apply.bundle_hash,
    html_results: htmlResults,
    ok: true,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
}

main();

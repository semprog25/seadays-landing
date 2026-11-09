#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-held-recovery-6');

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  const slugs = apply.slugs.slice().sort();
  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'rollback-pre-apply/public-port-guides.json'), 'utf8'));
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const terminalsNow = fs.readFileSync(path.join(REPO, 'data/public-port-terminals.json'), 'utf8');
  const terminalsBefore = fs.readFileSync(path.join(EVIDENCE, 'rollback-pre-apply/public-port-terminals.json'), 'utf8');
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed');

  const cococayPath = path.join(REPO, 'ports/perfect-day-at-cococay-bahamas/index.html');
  const cococayRollback = path.join(EVIDENCE, 'rollback-pre-apply/ports/perfect-day-at-cococay-bahamas/index.html');
  if (fs.existsSync(cococayPath) && fs.existsSync(cococayRollback)) {
    if (fs.readFileSync(cococayPath, 'utf8') !== fs.readFileSync(cococayRollback, 'utf8')) {
      throw new Error('CocoCay HTML changed');
    }
    const cards = (fs.readFileSync(cococayPath, 'utf8').match(/pg-call-plan-card/g) || []).length;
    if (cards < 3) throw new Error(`CocoCay cards ${cards}`);
  }

  const parent = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'PARENT_STAGE68_MANIFEST.json'), 'utf8'));
  const portsBySlug = new Map(parent.ports.map((p) => [p.landing_slug, p]));
  const htmlResults = [];

  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const id = row.app_port_id;
    const before = rollbackGuides.byAppPortId?.[id];
    const after = guides.byAppPortId?.[id];
    if (!after) throw new Error(`missing guide: ${landingSlug}`);
    if (before && sha(before) === sha(after)) throw new Error(`guide unchanged: ${landingSlug}`);
    if (after.researchImport?.publication_tier !== 'passenger_editorial') throw new Error(`tier: ${landingSlug}`);
    const html = fs.readFileSync(path.join(REPO, 'ports', landingSlug, 'index.html'), 'utf8');
    const val = validateGeneratedPortHtml(html, { slug: landingSlug });
    const issues = [...val.issues];
    if (containsInternalResearchLeak(collectGuidePassengerLeakBlob(after))) issues.push('research_leak_json');
    if (containsInternalResearchLeak(html)) issues.push('research_leak_html');
    if (landingSlug === 'kefalonia-greece' && /id="port-terminal-map"/.test(html)) {
      issues.push('unexpected_terminal_map');
    }
    htmlResults.push({ landing_slug: landingSlug, ok: issues.length === 0, issues });
  }

  const falmouth = fs.readFileSync(path.join(REPO, 'ports/falmouth-jamaica/index.html'), 'utf8');
  if (!/noindex/i.test(falmouth)) throw new Error('falmouth-jamaica guard missing');

  const payload = {
    validated_at_utc: new Date().toISOString(),
    slugs,
    recovery_bundle_hash: apply.recovery_bundle_hash,
    preparation_bundle_hash: apply.preparation_bundle_hash,
    html_results: htmlResults,
    html_pass_count: htmlResults.filter((r) => r.ok).length,
    ok: htmlResults.every((r) => r.ok),
  };
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify(payload, null, 2));
  if (!payload.ok) process.exit(47);
}

main();

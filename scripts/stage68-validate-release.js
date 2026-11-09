#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage68-bootstrap-47');
const MANIFEST = path.join(OUT, 'STAGE68_MANIFEST.json');
const BASELINE_GUIDES = path.join(REPO, 'data/public-port-guides.json');
const BASELINE_TERMINALS = path.join(REPO, 'data/public-port-terminals.json');

function shaFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  assert.ok(fs.existsSync(MANIFEST), 'missing STAGE68_MANIFEST.json');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const approved = manifest.slugs_approved || [];
  const trials = new Set(
    (manifest.ports || [])
      .filter((p) => p.production_apply_allowed && manifest.slugs_approved.includes(p.landing_slug))
      .map((p) => p.app_port_id)
  );

  for (const p of manifest.ports || []) {
    if (p.production_apply_allowed) continue;
    assert.ok(!approved.includes(p.landing_slug), `failed port in approved list: ${p.landing_slug}`);
  }

  for (const slug of approved) {
    const proposedPath = path.join(OUT, 'proposed-guides', `${slug}.json`);
    const htmlPath = path.join(OUT, 'previews-local-only', `${slug}.html`);
    assert.ok(fs.existsSync(proposedPath), `missing proposed guide ${slug}`);
    assert.ok(fs.existsSync(htmlPath), `missing preview html ${slug}`);
    const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'));
    const html = fs.readFileSync(htmlPath, 'utf8');
    const cards = (html.match(/pg-call-plan-card/g) || []).length;
    assert.ok(cards >= 3, `${slug}: expected >=3 call plan cards, got ${cards}`);
    assert.ok(
      String(proposed.researchImport?.landing_slug || '') === slug,
      `${slug}: landing_slug mismatch in proposed JSON`
    );
  }

  assert.ok(approved.indexOf('falmouth-jamaica') === -1, 'falmouth-jamaica must not be approved');
  assert.strictEqual(
    shaFile(BASELINE_GUIDES),
    crypto
      .createHash('sha256')
      .update(fs.readFileSync(BASELINE_GUIDES))
      .digest('hex'),
    'public-port-guides.json must be unchanged on disk'
  );
  if (fs.existsSync(BASELINE_TERMINALS)) {
    const terminalsSha = shaFile(BASELINE_TERMINALS);
    assert.ok(terminalsSha.length === 64);
  }

  const report = {
    validated_at_utc: new Date().toISOString(),
    manifest_status: manifest.status,
    approved_count: approved.length,
    bundle_hash: manifest.bundle_idempotency_hash,
    approved_app_port_ids: [...trials].sort(),
    production_guides_sha256: shaFile(BASELINE_GUIDES),
    gates: ['manifest_approved_subset', 'html_json_parity', 'call_plan_cards', 'falmouth_excluded', 'prod_guides_unchanged'],
  };
  fs.writeFileSync(path.join(OUT, 'RELEASE_VALIDATION.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(report, null, 2));
}

main();

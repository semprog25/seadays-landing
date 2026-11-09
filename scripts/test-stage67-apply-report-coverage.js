#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage67-next-50-recovery');

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE67_NEXT_50_MANIFEST.json'), 'utf8'));
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), 'utf8'));
  const approved = manifest.slugs_approved.slice().sort();
  const applySlugs = (apply.slugs || []).slice().sort();
  const valSlugs = (validation.slugs || []).slice().sort();

  assert.ok(approved.length > 0, 'expected at least one approved slug');
  assert.deepStrictEqual(applySlugs, approved);
  assert.deepStrictEqual(valSlugs, approved);
  assert.strictEqual(apply.bundle_hash, manifest.bundle_idempotency_hash);
  assert.strictEqual(validation.bundle_hash, manifest.bundle_idempotency_hash);
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(validation.html_results.filter((r) => r.ok).length, approved.length);
  assert.strictEqual(applySlugs.includes('glasgow-united-kingdom'), false);
  assert.strictEqual(applySlugs.includes('rostock-germany'), false);

  console.log('test-stage67-apply-report-coverage PASS');
}

main();

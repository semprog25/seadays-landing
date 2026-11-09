#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { execSync } = require('child_process');
const { removeStage65ExcludedGuideEntries, countPassengerEditorialGuides } = require('./lib/bulkPortPublication/stage65PublicationGuards');

const REPO = path.join(__dirname, '..');
const PREP = path.join(REPO, 'qa-evidence/stage68-bootstrap-47');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-publication-41');
const BUNDLE = 'd5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583';

function main() {
  const prepManifest = JSON.parse(fs.readFileSync(path.join(PREP, 'STAGE68_MANIFEST.json'), 'utf8'));
  const pubManifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE68_PUBLICATION_MANIFEST.json'), 'utf8'));
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  const validation = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), 'utf8'));
  const browser = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'BROWSER_QA.json'), 'utf8'));
  const catalogue = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'CATALOGUE_REGEN_QA.json'), 'utf8'));

  const approved = prepManifest.slugs_approved.slice().sort();
  assert.strictEqual(approved.length, 41);
  assert.deepStrictEqual(apply.slugs.slice().sort(), approved);
  assert.deepStrictEqual(pubManifest.slugs_approved.slice().sort(), approved);
  assert.deepStrictEqual(validation.slugs.slice().sort(), approved);
  assert.strictEqual(apply.bundle_hash, BUNDLE);
  assert.strictEqual(prepManifest.bundle_idempotency_hash, BUNDLE);
  assert.strictEqual(validation.ok, true);
  assert.strictEqual(validation.html_pass_count, 41);
  assert.strictEqual(browser.ok, true);
  assert.strictEqual(browser.passing, 41);
  assert.strictEqual(catalogue.ok, true);

  assert.strictEqual(approved.includes('falmouth-jamaica'), false);
  const guidesLive = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  assert.strictEqual(
    Boolean(guidesLive.byAppPortId?.falmouth?.researchImport?.landing_slug === 'falmouth-jamaica'),
    false,
    'falmouth-jamaica must not be published'
  );

  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  removeStage65ExcludedGuideEntries(guides);
  const count = countPassengerEditorialGuides(guides);
  assert.strictEqual(count, 313, `expected 313 passenger_editorial guides, got ${count}`);

  console.log('test-stage68-publication-41-release PASS');
}

main();

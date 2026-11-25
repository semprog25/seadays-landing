#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadReleaseGuard, evaluatePushReleaseGuard } = require('./lib/ciGenerationReleaseGuard');
const { resolveGenerationPlan } = require('./lib/ciClassifyGeneration');

const REPO = path.join(__dirname, '..');

function main() {
  const guard = loadReleaseGuard(REPO);
  assert.strictEqual(guard.profile, 'ship-detail-verified-hero-20261125');
  const manifest = guard.exactPaths.slice().sort();
  const verdict = evaluatePushReleaseGuard(manifest, { repoRoot: REPO });
  assert.strictEqual(verdict.action, 'suppress');
  const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: manifest });
  assert.strictEqual(plan.skip, true);
  assert.strictEqual(plan.channel, 'skip');
  assert.ok(manifest.includes('scripts/test-ship-detail-verified-hero-bindings.js'));
  const aidaManifest = JSON.parse(
    fs.readFileSync(path.join(REPO, 'data/aida-ship-directory-thumbnails-20261113.json'), 'utf8')
  );
  for (const row of aidaManifest.ships) {
    assert.ok(manifest.includes(`ships/${row.slug}/index.html`), `guard lists ${row.slug}`);
  }
  console.log('test-ship-detail-verified-hero-release PASS', { exactPaths: manifest.length });
}

main();
#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { execSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const REPO = path.join(__dirname, '..');

function main() {
  const shorthand = JSON.parse(
    execSync('node scripts/audit-passenger-visible-research-shorthand.js', {
      cwd: REPO,
      encoding: 'utf8',
    })
  );
  assert.strictEqual(shorthand.passengerVisibleNotVerified, 0);
  assert.strictEqual(shorthand.passengerVisibleRemainNull, 0);

  const leak = JSON.parse(
    execSync('node scripts/audit-published-port-html-research-leak.js', {
      cwd: REPO,
      encoding: 'utf8',
    })
  );
  assert.strictEqual(leak.publishedPortPagesWithLeaks, 0);

  const nordkapp = fs.readFileSync(path.join(REPO, 'ports/nordkapp-norway/index.html'), 'utf8');
  const rugen = fs.readFileSync(path.join(REPO, 'ports/rugen-germany/index.html'), 'utf8');
  assert.ok(!/\bnot verified\b/i.test(nordkapp), 'nordkapp alias landing clean');
  assert.ok(!/\bnot verified\b/i.test(rugen), 'rugen alias landing clean');

  const { getAliasRedirectTarget } = require('./lib/portSeoRedirects');
  const regenSrc = fs.readFileSync(path.join(REPO, 'scripts/regenerate-port-pages.js'), 'utf8');
  assert.strictEqual(getAliasRedirectTarget('nordkapp-norway'), 'honningsvag-norway');
  assert.strictEqual(getAliasRedirectTarget('rugen-germany'), 'sassnitz-mukran-germany');
  assert.ok(
    /portSlugFilter\s*&&\s*portSlugFilter\.has\(port\.slug\)/.test(regenSrc),
    'alias pages regenerate only when explicitly listed in SEADAYS_REGEN_PORT_SLUGS'
  );

  const { loadReleaseGuard, evaluatePushReleaseGuard } = require('./lib/ciGenerationReleaseGuard');
  const guard = loadReleaseGuard(REPO);
  assert.strictEqual(guard.profile, 'port-content-not-verified-backlog-53');
  const manifest = guard.exactPaths.slice().sort();
  const verdict = evaluatePushReleaseGuard(manifest, { repoRoot: REPO });
  assert.strictEqual(verdict.action, 'suppress');
  const { resolveGenerationPlan } = require('./lib/ciClassifyGeneration');
  const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: manifest });
  assert.strictEqual(plan.skip, true);
  assert.strictEqual(plan.channel, 'skip');

  console.log('test-port-content-backlog-53-release PASS', {
    catalogueNotVerified: 0,
    researchLeakPages: 0,
  });
}

main();
#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { execSync } = require('node:child_process');
const path = require('node:path');
const { INTERNAL_RESEARCH_LEAK_RE } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');

function main() {
  assert.ok(INTERNAL_RESEARCH_LEAK_RE.length >= 49, 'extended internal research leak patterns');
  const out = execSync('node scripts/audit-published-port-html-research-leak.js', {
    cwd: REPO,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const summary = JSON.parse(out);
  assert.strictEqual(
    summary.publishedPortPagesWithLeaks,
    0,
    `published port HTML leaks: ${summary.slugs?.slice(0, 8).join(', ')}`
  );
  console.log('test-published-port-html-research-leak PASS', {
    patternCount: summary.patternCount,
    pages: 'clean',
  });
}

main();

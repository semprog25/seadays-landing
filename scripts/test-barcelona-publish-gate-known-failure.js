#!/usr/bin/env node
'use strict';

/**
 * Records the pre-existing Barcelona publish-gate regression separately from batch 01 success.
 * Full test:publish-gate still fails on barcelona-spain terminal distance when Phase 1 markup is present.
 * Do not modify barcelona-spain — this test documents EXPECTED_FAIL for CI gap tracking.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { evaluatePublishGate } = require('./lib/publishGate');

const root = path.join(__dirname, '..');
const BARCELONA = 'barcelona-spain';

function main() {
  const htmlPath = path.join(root, 'ports', BARCELONA, 'index.html');
  assert.ok(fs.existsSync(htmlPath), 'barcelona page missing');
  const html = fs.readFileSync(htmlPath, 'utf8');
  const hasPhase1 = html.includes('<details class="pg-terminal-card"');
  if (!hasPhase1) {
    console.log('test-barcelona-publish-gate-known-failure SKIP (no Phase 1 terminal markup on baseline)');
    return;
  }

  const row = evaluatePublishGate([{ file: htmlPath, slug: BARCELONA, kind: 'port', html }])[0];
  const distanceIssue = (row.issues || []).some((i) => /distance|terminal|4\.5\s*km/i.test(i));
  const contentMismatch =
    html.includes('4.5 km') ||
    (!html.includes('0.4 km from city center') && html.includes('Terminal E'));

  assert.ok(
    row.issues.length > 0 || distanceIssue || contentMismatch,
    'EXPECTED_FAIL: barcelona should still fail publish-gate assertions on unchanged main'
  );

  const fixturePath = path.join(root, 'qa-evidence/publication-batch-01/BARCELONA_PUBLISH_GATE_KNOWN_FAILURE.json');
  fs.mkdirSync(path.dirname(fixturePath), { recursive: true });
  fs.writeFileSync(
    fixturePath,
    `${JSON.stringify(
      {
        schema_version: 1,
        slug: BARCELONA,
        status: 'EXPECTED_FAIL',
        gate_issues: row.issues,
        note: 'Tracked separately; full test:publish-gate not claimed green while this persists',
        recorded_at_utc: new Date().toISOString(),
      },
      null,
      2
    )}\n`,
    'utf8'
  );

  console.log('test-barcelona-publish-gate-known-failure PASS (documented EXPECTED_FAIL)', {
    issues: row.issues.slice(0, 4),
  });
}

main();

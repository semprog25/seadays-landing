#!/usr/bin/env node
'use strict';

/**
 * Fail-closed gate for GitHub Pages direct deploy (Channel A).
 * Clears local candidate-only env flags so historical policy cannot be bypassed at deploy time.
 */

const path = require('path');
const { assertHistoricalPolicyPublicationGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate');

const CANDIDATE_ENV_KEYS = [
  'SEADAYS_STAGE89_BODO_CANDIDATE',
  'SEADAYS_PUBLICATION_BATCH_01_CANDIDATE',
];

function main() {
  for (const key of CANDIDATE_ENV_KEYS) {
    if (process.env[key]) {
      delete process.env[key];
    }
  }

  const repoRoot = path.join(__dirname, '..');
  assertHistoricalPolicyPublicationGate(repoRoot);
  console.log('assert-pages-deploy-publication-gate PASS (candidate env cleared, historical policy gate ok)');
}

try {
  main();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

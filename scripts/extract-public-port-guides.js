#!/usr/bin/env node
'use strict';

/**
 * Extract public Port Guide fields from the SeaDays app port-details modules
 * into data/public-port-guides.json (website adapter — not a second database).
 *
 * Usage (from seadays-landing):
 *   node scripts/extract-public-port-guides.js
 *   SEADAYS_APP_ROOT=/path/to/Seadays-main node scripts/extract-public-port-guides.js
 */

const path = require('path');
const {
  resolveAppRepoRoot,
  extractAllPublicPortGuides,
  writePublicPortGuidesFile,
} = require('./lib/publicPortGuideAdapter');

function main() {
  const repoRoot = path.join(__dirname, '..');
  const appRoot = resolveAppRepoRoot(__dirname);
  console.log(`[extract-public-port-guides] app root: ${appRoot}`);
  const payload = extractAllPublicPortGuides(appRoot);
  const outPath = writePublicPortGuidesFile(repoRoot, payload);
  console.log(
    `[extract-public-port-guides] wrote ${payload.meta.count} guides → ${path.relative(repoRoot, outPath)}`
  );
  if (!payload.meta.count) {
    console.warn('[extract-public-port-guides] WARNING: zero guides extracted — check SEADAYS_APP_ROOT');
    process.exitCode = 1;
  }
}

main();

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { assertPassengerReadyGuideFields, containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const repoRoot = path.join(__dirname, '..');

function main() {
  const guides = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8')
  );
  const guide = guides.byAppPortId.aalborg;
  assertPassengerReadyGuideFields(guide, 'aalborg');

  const page = fs.readFileSync(path.join(repoRoot, 'ports', 'aalborg-denmark', 'index.html'), 'utf8');
  assert.ok(!page.includes('**'), 'no raw markdown bold in HTML');
  assert.ok(!page.includes('null/unverified'), 'no internal QA in HTML');
  assert.ok(!/\d+\+\d+\+\d+=/.test(page), 'no arithmetic itinerary in HTML');
  assert.ok(!page.includes('confirm the pier, shuttle'), 'no generic getting-there stub');
  assert.ok(page.includes('pg-cruise-tip'), 'practical tip styled');
  assert.ok(/\.pg-call-plan-card\s*\{/.test(page), 'inline css includes call-plan card rules');
  assert.ok(/\.pg-cruise-tip\s*\{/.test(page), 'inline css includes cruise tip rules');
  assert.ok(!page.includes('Eurostat'), 'no wikipedia population overview');
  assert.ok(!page.includes('For Aalborg, Entry and visa'), 'no generic entry accordion boilerplate');
  assert.ok(page.includes('um.dk/en/travel-and-residence'), 'denmark entry official link');

  const mainBlock = page.match(/<main\b[\s\S]*?<\/main>/i);
  assert.ok(mainBlock, 'main');
  const html = mainBlock[0];
  assert.ok(!containsInternalResearchLeak(html), 'no research leaks in main');

  console.log('test-port-guide-aalborg-content-quality PASS');
}

main();

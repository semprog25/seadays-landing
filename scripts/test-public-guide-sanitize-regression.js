#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { preparePassengerGuideText, containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { buildPhase1GuideHtml } = require('./lib/portGuideSections');

const repoRoot = path.join(__dirname, '..');

function main() {
  const guides = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8')
  );
  const hamburg = guides.byAppPortId.hamburg;
  assert.ok(hamburg, 'hamburg guide');

  const hamburgSample = hamburg.thingsToDo.standardCall;
  const prepared = preparePassengerGuideText(hamburgSample);
  assert.strictEqual(prepared, hamburgSample, 'hamburg prose unchanged by sanitizer');
  assert.ok(!containsInternalResearchLeak(hamburgSample), 'hamburg not flagged as research leak');

  const warning =
    'Keep a buffer for Elbe traffic and terminal security when returning to the ship.';
  assert.strictEqual(preparePassengerGuideText(warning), warning, 'legitimate warning preserved');

  const leak = 'Coordinates remain null/unverified until research pass completes.';
  assert.strictEqual(preparePassengerGuideText(leak), '', 'internal leak stripped');

  const hamburgHtml = buildPhase1GuideHtml({
    port: {
      name: 'Hamburg',
      slug: 'hamburg-germany',
      appPortId: 'hamburg',
      country: 'Germany',
      overviewText: 'Dataset overview should not disappear.',
    },
    guide: hamburg,
    terminals: [{ name: 'Test', slug: 't', latitude: 53.54, longitude: 9.99, terminal_type: 'transit' }],
    affiliate: { show: false },
  });
  assert.ok(hamburgHtml.includes('pg-call-plan-card'), 'hamburg call cards');
  assert.ok(hamburgHtml.includes('Miniatur Wunderland'), 'hamburg itinerary copy intact');

  const aalborg = guides.byAppPortId.aalborg;
  const aalborgHtml = buildPhase1GuideHtml({
    port: {
      name: 'Aalborg',
      slug: 'aalborg-denmark',
      appPortId: 'aalborg',
      country: 'Denmark',
      overviewText: "Aalborg population 119,862 Eurostat OECD",
    },
    guide: aalborg,
    terminals: [],
    affiliate: { show: false },
  });
  assert.ok(!aalborgHtml.includes('Eurostat'), 'aalborg wiki overview omitted when editorial lead present');
  assert.ok(!aalborgHtml.includes('wiki-attribution'), 'no wiki attribution without wiki body');
  assert.ok(aalborgHtml.includes('pg-editorial-link'), 'aalborg entry uses editorial links');

  console.log('test-public-guide-sanitize-regression PASS');
}

main();

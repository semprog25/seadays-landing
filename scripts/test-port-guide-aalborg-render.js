#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const { buildPhase1GuideHtml, hasRichThingsToDo } = require('./lib/portGuideSections');

function main() {
  const guides = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8')
  );
  const guide = guides.byAppPortId.aalborg;
  assert.ok(guide, 'aalborg guide');
  assert.ok(hasRichThingsToDo(guide), 'aalborg rich thingsToDo');

  const html = buildPhase1GuideHtml({
    port: { name: 'Aalborg', slug: 'aalborg-denmark', appPortId: 'aalborg', country: 'Denmark' },
    guide,
    terminals: [],
    affiliate: { show: false },
  });

  assert.ok(html.includes('pg-call-plan-card--longer'), 'longer call card');
  assert.ok(html.includes('pg-call-plan-card--short'), 'short call card');
  assert.ok(html.includes('pg-call-plan-card--standard'), 'standard call card');
  assert.ok(html.includes('From the terminal'), 'terminal arrival dl row');
  assert.ok(/id="getting-there"[\s\S]*?Royal Cruise Berth/.test(html), 'berth in getting-there');
  assert.ok(/id="getting-there"[\s\S]*?Public transport/.test(html), 'public transport row');
  assert.ok(!html.includes('port-terminal-map'), 'no terminal map');

  const hamburg = guides.byAppPortId.hamburg;
  assert.ok(hamburg, 'hamburg guide for regression');
  const hamburgHtml = buildPhase1GuideHtml({
    port: { name: 'Hamburg', slug: 'hamburg-germany', appPortId: 'hamburg', country: 'Germany' },
    guide: hamburg,
    terminals: [{ name: 'HafenCity', slug: 'test', latitude: 53.54, longitude: 9.99, terminal_type: 'transit' }],
    affiliate: { show: false },
  });
  assert.ok(hamburgHtml.includes('pg-call-plan-card') || hamburgHtml.includes('Standard call'));
  assert.ok(!hamburgHtml.includes('From the terminal</dt><dd></dd>'), 'hamburg empty terminal row');

  console.log('test-port-guide-aalborg-render PASS');
}

main();

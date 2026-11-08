#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const GUIDES_PATH = path.join(__dirname, '..', 'data', 'public-port-guides.json');
const {
  listPassengerTextFields,
  containsResearchSourceMarker,
  RESEARCH_SOURCE_MARKER_RE,
} = require('./lib/publicPortGuidePassengerTextFields');

function main() {
  const payload = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
  const by = payload.byAppPortId;
  assert.ok(by && typeof by === 'object', 'byAppPortId missing');

  const violations = [];
  for (const [portId, guide] of Object.entries(by)) {
    for (const slot of listPassengerTextFields(guide)) {
      const text = slot.holder[slot.key];
      if (!containsResearchSourceMarker(text)) continue;
      const markers = text.match(/\[S\d+(?:\s+[^\]]*)?\]/gi) || [];
      violations.push({ portId, field: inferFieldPath(guide, slot), markers });
    }
  }

  assert.strictEqual(
    violations.length,
    0,
    `research source markers in passenger JSON: ${JSON.stringify(violations.slice(0, 5), null, 2)}`
  );
  assert.ok(
    !RESEARCH_SOURCE_MARKER_RE.test('See [section 2] in the manual.'),
    'field list must not false-positive on non-research brackets'
  );
  console.log('test-public-port-guides-no-research-markers PASS');
}

function inferFieldPath(guide, slot) {
  if (slot.holder === guide.portInfo) return `portInfo.${slot.key}`;
  if (slot.holder === guide.gettingThere) return `gettingThere.${slot.key}`;
  if (slot.holder === guide.thingsToDo) return `thingsToDo.${slot.key}`;
  if (slot.holder === guide.thingsToDo?.topThings) return `thingsToDo.topThings.${slot.key}`;
  return String(slot.key);
}

main();

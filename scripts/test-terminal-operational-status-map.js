#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  normalizeTerminalStatus,
  isTerminalStatusActive,
  filterActiveTerminalsForDisplay,
  collectTransitioningVisitorNotices,
} = require('./lib/terminalOperationalStatus');
const { buildOsmTerminalMap, buildTerminalsSection } = require('./lib/portGuideSections');

const root = path.join(__dirname, '..');
const terminalsPath = path.join(root, 'data', 'public-port-terminals.json');
const { byPortId } = JSON.parse(fs.readFileSync(terminalsPath, 'utf8'));

assert.strictEqual(normalizeTerminalStatus(undefined), 'active');
assert.strictEqual(normalizeTerminalStatus(''), 'active');
assert.strictEqual(normalizeTerminalStatus('active'), 'active');
assert.strictEqual(normalizeTerminalStatus('closed'), 'closed');
assert.strictEqual(normalizeTerminalStatus(null), 'active');
assert.strictEqual(normalizeTerminalStatus('demolished'), null);
assert.strictEqual(isTerminalStatusActive('closed'), false);
assert.strictEqual(isTerminalStatusActive('planned'), false);
assert.strictEqual(isTerminalStatusActive('transitioning'), false);
assert.strictEqual(isTerminalStatusActive('active'), true);
assert.strictEqual(isTerminalStatusActive(undefined), true);

const mixed = [
  { name: 'Open', terminal_status: 'active', latitude: 1, longitude: 2, description: 'Open pier.' },
  { name: 'Shut', terminal_status: 'closed', latitude: 3, longitude: 4, description: 'Closed.' },
  { name: 'Soon', terminal_status: 'planned', latitude: 5, longitude: 6, description: 'Planned.' },
  {
    name: 'Wind-down',
    terminal_status: 'transitioning',
    visitor_notice: 'Notice text.',
    latitude: 7,
    longitude: 8,
    description: 'Transitioning pier.',
  },
  { name: 'Legacy no status', latitude: 9, longitude: 10, description: 'Legacy active.' },
  { name: 'Bad status', terminal_status: 'unknown-value', latitude: 11, longitude: 12, description: 'Bad.' },
];
assert.strictEqual(filterActiveTerminalsForDisplay(mixed).length, 2);
assert.deepStrictEqual(collectTransitioningVisitorNotices(mixed), ['Notice text.']);

const mapHtml = buildOsmTerminalMap(mixed);
assert.strictEqual((mapHtml.match(/"lat":/g) || []).length, 2, 'map pins for active only');

const sectionHtml = buildTerminalsSection(mixed);
assert.ok(sectionHtml.includes('pg-terminal-transition-notice'));
assert.ok(sectionHtml.includes('Notice text.'));
assert.ok(!sectionHtml.includes('>Shut<'), 'closed terminal name not in section cards');
assert.strictEqual((sectionHtml.match(/class="pg-terminal-card"/g) || []).length, 2);

const barcelona = byPortId.barcelona || [];
const barcelonaActive = filterActiveTerminalsForDisplay(barcelona);
assert.strictEqual(barcelonaActive.length, 4, 'Barcelona active terminals');
assert.ok(
  barcelona.some((t) => t.slug === 'adossat-terminal-c' && t.terminal_status === 'closed'),
  'legacy C retained'
);
assert.ok(
  !barcelonaActive.some((t) => t.slug === 'adossat-terminal-c'),
  'legacy C not active'
);
assert.ok(
  barcelona.some((t) => t.slug === 'world-trade-center-pier' && t.terminal_status === 'transitioning'),
  'WTC transitioning'
);
const barcelonaMap = buildOsmTerminalMap(barcelona);
assert.strictEqual((barcelonaMap.match(/"lat":/g) || []).length, 4, 'Barcelona map pins');

const miami = byPortId.miami || [];
const miamiActive = filterActiveTerminalsForDisplay(miami);
assert.strictEqual(miamiActive.length, 7, 'Miami active terminals');
const miamiMap = buildOsmTerminalMap(miami);
assert.strictEqual((miamiMap.match(/"lat":/g) || []).length, 7, 'Miami map pins');
const miamiPins = JSON.parse(miamiMap.match(/var pins=(\[[\s\S]*?\]);/)[1]);
const aa = miamiPins.find((p) => p.label.includes('Terminal AA'));
const a = miamiPins.find((p) => p.label.includes('Terminal A') && !p.label.includes('AA'));
assert.ok(aa && a, 'Miami A and AA pins');
assert.notStrictEqual(aa.lat, a.lat);
assert.notStrictEqual(aa.lon, a.lon);

const hamburg = byPortId.hamburg || [];
assert.strictEqual(filterActiveTerminalsForDisplay(hamburg).length, 4, 'Hamburg regression active count');

console.log('test-terminal-operational-status-map ok');

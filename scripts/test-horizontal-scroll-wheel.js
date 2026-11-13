#!/usr/bin/env node
'use strict';

const { buildHorizontalScrollWheelHelperSource } = require('./lib/horizontalScrollWheel');
const portsClient = require('./lib/portsDirectoryIndex.client.js')();
const shipsClient = require('./lib/shipsDirectoryClient.js')();

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const helper = buildHorizontalScrollWheelHelperSource();
assert(helper.includes('bindHorizontalWheelScroll'), 'helper exports carousel binder');
assert(helper.includes('Intentionally empty'), 'native scroll; vertical wheel not hijacked');

assert(portsClient.includes('bindHorizontalWheelScroll(regionBrowse'), 'ports region carousel wired');
assert(portsClient.includes('is-expanded'), 'ports wheel disabled when region grid expanded');

assert(shipsClient.includes('bindHorizontalWheelScroll(popularLinePills)'), 'ships line carousel wired');

console.log('OK test-horizontal-scroll-wheel');

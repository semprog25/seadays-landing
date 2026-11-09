#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const STAGE68_MISSED_LEAKS = [
  'Without published LOA/depth tables on the captured English page, berth metrics stay null beyond the named terminals.',
  'Door GPS remains unpublished on the extract — pins stay null despite the strong berth narrative.',
  'Passenger door WGS84 pins are not published as entrance surveys — pins stay null.',
  'Quay LOA/door coordinates are not published as WGS84 on the page used — keep pins null.',
  'Subway/bus walk minutes from Columbus Circle Not verified on the NYCEDC operations page.',
];

const CLEAN_ALTERNATIVES = [
  'Confirm which quay your sailing uses on the daily programme.',
  'Cape Liberty in Bayonne is a separate embarkation facility; do not confuse it with NYC terminals.',
  'Manhattan (MCT): 711 12th Avenue at West 55th Street — subway and bus via Columbus Circle; allow walk time in traffic.',
];

function main() {
  for (const sample of STAGE68_MISSED_LEAKS) {
    assert.ok(containsInternalResearchLeak(sample), `expected leak flag: ${sample.slice(0, 48)}…`);
  }
  for (const sample of CLEAN_ALTERNATIVES) {
    assert.ok(!containsInternalResearchLeak(sample), `expected clean: ${sample.slice(0, 48)}…`);
  }
  console.log('test-stage68-held-recovery-leak-regression PASS');
}

main();

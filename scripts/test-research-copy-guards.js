#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { isTruncatedResearchCopy, assertResearchCopyNotTruncated } = require('./lib/researchCopyGuards');
const { extractCruiseTerminalArrival } = require('./lib/portResearchImport/extractMarkdownSections');

const aalborgSection = `## Cruise terminals

| Official terminal / tender landing | Type | Source | Access / transport caveat |
| --- | --- | --- | --- |
| Aalborg Royal Cruise Berth / Honnørkajen waterfront | port_area_approximate | S1 S6 | Aalborg waterfront cruise berth (verify quay on sailing docs; Port of Aalborg cr |

Coordinates and definitive quay number remain null/unverified until sailing-specific or clearer primary quay geometry is captured. [S1]
`;

function main() {
  assert.ok(isTruncatedResearchCopy('verify quay on sailing docs; Port of Aalborg cr'), 'detects clipped table cell');
  assert.ok(!isTruncatedResearchCopy('verify quay on sailing docs; Port of Aalborg cruise calendar.'), 'complete sentence ok');

  const arrival = extractCruiseTerminalArrival(aalborgSection);
  assertResearchCopyNotTruncated(arrival, 'fixture extractCruiseTerminalArrival');
  assert.ok(arrival.includes('Honnørkajen'), 'fixture keeps berth name');
  assert.ok(arrival.includes('null/unverified'), 'fixture uses post-table prose');

  console.log('test-research-copy-guards PASS');
}

main();

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  buildSlugToAppPortIdMap,
  loadPublicPortGuidesFile,
} = require('./lib/publicPortGuideAdapter');

const REPO = path.join(__dirname, '..');

const cococaySeo = [
  {
    slug: 'perfect-day-at-cococay-bahamas',
    name: 'Perfect Day at CocoCay, Bahamas',
    country: 'Bahamas',
  },
];
const live = loadPublicPortGuidesFile(REPO);
const cococayMap = buildSlugToAppPortIdMap(cococaySeo, null, live.byAppPortId);
assert.strictEqual(
  cococayMap['perfect-day-at-cococay-bahamas'],
  'coco-cay',
  'CocoCay landing_slug wires when catalogue slug exists'
);

const overwriteGuides = {
  wired: {
    portName: 'Wired',
    country: 'Testland',
    researchImport: { landing_slug: 'wired-port' },
  },
};
const reviewMap = { 'wired-port': 'other-guide' };
const overwriteMap = buildSlugToAppPortIdMap(
  [{ slug: 'wired-port', name: 'Wired', country: 'Testland' }],
  reviewMap,
  { ...overwriteGuides, 'other-guide': { portName: 'Other', country: 'Testland' } }
);
assert.strictEqual(
  overwriteMap['wired-port'],
  'other-guide',
  'landing_slug must not overwrite an existing slug resolution'
);

const orphanGuides = {
  orphan: {
    portName: 'Orphan',
    country: 'Nowhere',
    researchImport: { landing_slug: 'not-in-catalogue' },
  },
};
const orphanMap = buildSlugToAppPortIdMap(
  [{ slug: 'other-port', name: 'Other', country: 'Nowhere' }],
  null,
  orphanGuides
);
assert.strictEqual(
  orphanMap['not-in-catalogue'] || '',
  '',
  'landing_slug ignored when slug absent from seoPorts'
);

const conflictGuides = {
  guideA: {
    portName: 'A',
    country: 'Testland',
    researchImport: { landing_slug: 'shared-landing' },
  },
  guideB: {
    portName: 'B',
    country: 'Testland',
    researchImport: { landing_slug: 'shared-landing' },
  },
};
const conflictMap = buildSlugToAppPortIdMap(
  [{ slug: 'shared-landing', name: 'Shared', country: 'Testland' }],
  null,
  conflictGuides
);
assert.strictEqual(
  conflictMap['shared-landing'] || '',
  '',
  'duplicate landing_slug claims must not wire silently'
);

const mismatchedCountry = {
  guide: {
    portName: 'Skagen',
    country: 'UK',
    researchImport: { landing_slug: 'skagen-denmark' },
  },
};
const skagenMap = buildSlugToAppPortIdMap(
  [{ slug: 'skagen-denmark', name: 'Skagen', country: 'Denmark' }],
  null,
  mismatchedCountry
);
assert.strictEqual(
  skagenMap['skagen-denmark'] || '',
  '',
  'landing_slug respects country guard vs catalogue port'
);

console.log('test-landing-slug-slug-map: PASS');

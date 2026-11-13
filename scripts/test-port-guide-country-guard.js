'use strict';

const assert = require('assert');
const {
  buildSlugToAppPortIdMap,
  countriesCompatible,
  normalizeCountryKey,
} = require('./lib/publicPortGuideAdapter');

assert.strictEqual(normalizeCountryKey('UK'), 'united kingdom');
assert.strictEqual(normalizeCountryKey('United Kingdom'), 'united kingdom');
assert.strictEqual(countriesCompatible('Jamaica', 'UK'), false);
assert.strictEqual(countriesCompatible('United Kingdom', 'UK'), true);
assert.strictEqual(countriesCompatible('United States', 'USA'), true);

const guidesById = {
  falmouth: {
    portName: 'Falmouth',
    country: 'UK',
    portInfo: { description: 'A charming Cornish port town' },
  },
};

const map = buildSlugToAppPortIdMap(
  [
    { slug: 'falmouth-jamaica', name: 'Falmouth, Jamaica', country: 'Jamaica' },
    { slug: 'falmouth-united-kingdom', name: 'Falmouth, United Kingdom', country: 'United Kingdom' },
  ],
  null,
  guidesById
);

assert.strictEqual(
  map['falmouth-jamaica'] || '',
  '',
  'Jamaica must not attach Cornish falmouth guide'
);
assert.strictEqual(map['falmouth-united-kingdom'], 'falmouth');

const islandGuides = {
  marigot: { portName: 'Marigot', country: 'Saint-Martin', portInfo: { description: 'French side' } },
  'st-maarten': { portName: 'St Maarten', country: 'Sint Maarten', portInfo: { description: 'Dutch side' } },
};
const islandMap = buildSlugToAppPortIdMap(
  [{ slug: 'marigot-st-maarten', name: 'Marigot', country: 'Saint-Martin' }],
  null,
  islandGuides
);
assert.strictEqual(islandMap['marigot-st-maarten'], 'marigot', 'Marigot slug must not attach Dutch st-maarten guide');

const caribGuides = {
  basseterre: {
    portName: 'St. Kitts (Basseterre), St. Kitts',
    country: 'Saint Kitts and Nevis',
    researchImport: { landing_slug: 'st-kitts-basseterre-st-kitts' },
    portInfo: { description: 'Port Zante serves Basseterre cruise calls.' },
  },
  frederiksted: {
    portName: 'St. Croix (Frederiksted)',
    country: 'United States Virgin Islands',
    researchImport: { landing_slug: 'st-croix-frederiksted-us-virgin-islands' },
    portInfo: { description: 'Frederiksted cruise pier.' },
  },
  cornwall_falmouth: {
    portName: 'Falmouth',
    country: 'UK',
    portInfo: { description: 'A charming Cornish port town' },
  },
};

const caribMap = buildSlugToAppPortIdMap(
  [
    { slug: 'st-kitts-basseterre-st-kitts', name: 'St. Kitts (Basseterre)', country: 'St. Kitts' },
    { slug: 'st-croix-frederiksted-us-virgin-islands', name: 'St. Croix (Frederiksted)', country: 'US Virgin Islands' },
    { slug: 'falmouth-jamaica', name: 'Falmouth, Jamaica', country: 'Jamaica' },
  ],
  null,
  caribGuides
);

assert.strictEqual(caribMap['st-kitts-basseterre-st-kitts'], 'basseterre');
assert.strictEqual(caribMap['st-croix-frederiksted-us-virgin-islands'], 'frederiksted');
assert.ok(!caribMap['falmouth-jamaica'], 'Jamaica must not attach UK Falmouth guide');

assert.strictEqual(normalizeCountryKey('St. Kitts'), 'saint kitts and nevis');
assert.strictEqual(normalizeCountryKey('US Virgin Islands'), 'united states virgin islands');
assert.strictEqual(countriesCompatible('St. Kitts', 'Saint Kitts and Nevis'), true);
assert.strictEqual(countriesCompatible('US Virgin Islands', 'United States Virgin Islands'), true);

console.log('test-port-guide-country-guard: PASS');

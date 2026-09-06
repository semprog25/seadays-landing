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

console.log('test-port-guide-country-guard: PASS');

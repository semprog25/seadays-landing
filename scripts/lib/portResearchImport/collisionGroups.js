'use strict';

/** QA duplicate / gateway pairs — informational only; no auto-merge. */
const DUPLICATE_GATEWAY_PAIRS = [
  { id: 'goa-mormugao', slugs: ['goa-india', 'mormugao-port-goa-india'], note: 'Same harbour; redirect goa → mormugao' },
  { id: 'jeddah-islamic', slugs: ['jeddah-saudi-arabia', 'jeddah-islamic-port-saudi-arabia'], note: 'City vs Islamic Port facility' },
  { id: 'manama-mina-salman', slugs: ['manama-bahrain', 'mina-salman-manama-bahrain'], note: 'Destination vs facility' },
  { id: 'muscat-psq', slugs: ['muscat-oman', 'port-sultan-qaboos-muscat-oman'], note: 'City vs Port Sultan Qaboos' },
  { id: 'aqaba-facility', slugs: ['aqaba-jordan', 'port-of-aqaba-jordan'], note: 'City vs Port of Aqaba' },
  { id: 'haifa-facility', slugs: ['haifa-israel', 'port-of-haifa-israel'], note: 'Same Haifa Port Company terminal' },
  { id: 'gran-canaria-las-palmas', slugs: ['gran-canaria-spain', 'las-palmas-spain'], note: 'Island vs Las Palmas port' },
  { id: 'san-antonio-valparaiso', slugs: ['santiago-san-antonio-chile', 'valparaiso-chile'], note: 'Distinct harbours, Santiago market' },
  { id: 'cape-liberty-nyc', slugs: ['cape-liberty-bayonne-nj-united-states', 'new-york-ny-united-states'], note: 'Bayonne vs NYC piers' },
  { id: 'marigot-philipsburg', slugs: ['marigot-st-maarten', 'philipsburg-st-maarten'], note: 'French vs Dutch sides' },
];

/** AppPortIds referenced by more than one landing slug (from QA + redirects). */
const KNOWN_MULTI_SLUG_APP_IDS = [
  'abu-dhabi',
  'aqaba',
  'ashdod',
  'doha',
  'dubai',
  'haifa',
  'muscat',
  'nice',
];

function collisionGroupForSlug(slug) {
  const s = String(slug || '').trim();
  for (const g of DUPLICATE_GATEWAY_PAIRS) {
    if (g.slugs.includes(s)) return g.id;
  }
  return null;
}

module.exports = {
  DUPLICATE_GATEWAY_PAIRS,
  KNOWN_MULTI_SLUG_APP_IDS,
  collisionGroupForSlug,
};

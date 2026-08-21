#!/usr/bin/env node
'use strict';

/**
 * Strip generic/fabricated-looking Port Guide filler from data/public-port-guides.json.
 * Does NOT invent replacement facts. Verified Kiel enrichment is applied in-place.
 *
 * Usage: node scripts/strip-port-guide-boilerplate.js
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');
const TERMINALS_PATH = path.join(REPO, 'data', 'public-port-terminals.json');
const REPORT_PATH = path.join(REPO, 'data', 'reports', 'port-guide-boilerplate-strip-report.json');

const EXACT_BOILERPLATE = new Set(
  [
    'Established as a port in historical times',
    'An important maritime destination',
    'Handles cruise passengers and cargo vessels',
    'Handles cruise passengers and yachts',
    'Handles cruise passengers',
    'Welcomes cruise passengers throughout the year',
    'Welcomes cruise passengers during summer months',
    'Growing cruise destination',
    'Varies by location',
    'Major metropolitan city',
    'Major city',
    'Medium-sized city',
    'Medium-sized town',
    'Small town',
    'Capital city',
    'Cruise terminal provides access to the local area',
    'Varies by terminal location',
    '10-30 minutes depending on terminal',
    'Taxis available at terminal',
    'Local transport options available',
    'Historic port area',
    'Local cultural attractions',
    'Scenic waterfront',
    'Rich local heritage',
    'Traditional architecture',
    'Cultural landmarks',
    'Walking (if nearby)',
    'Local transport',
  ].map((s) => s.toLowerCase())
);

const PREFIX_BOILERPLATE = [/^located in /i, /^handles cruise passengers/i];

function isBoilerplate(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  if (EXACT_BOILERPLATE.has(s.toLowerCase())) return true;
  return PREFIX_BOILERPLATE.some((re) => re.test(s));
}

function scrubString(obj, key, stats) {
  if (!obj || typeof obj !== 'object') return;
  const cur = obj[key];
  if (typeof cur !== 'string') return;
  if (!isBoilerplate(cur)) return;
  obj[key] = '';
  stats.fieldsCleared += 1;
}

function scrubList(obj, key, stats) {
  if (!obj || typeof obj !== 'object') return;
  if (!Array.isArray(obj[key])) return;
  const before = obj[key].length;
  obj[key] = obj[key].filter((x) => typeof x === 'string' && x.trim() && !isBoilerplate(x));
  stats.listItemsRemoved += before - obj[key].length;
}

function scrubGuide(guide, stats) {
  if (!guide || typeof guide !== 'object') return;
  scrubString(guide.portInfo, 'location', stats);
  scrubString(guide.facts, 'established', stats);
  scrubString(guide.facts, 'significance', stats);
  scrubList(guide.facts, 'notableFeatures', stats);
  scrubList(guide.facts, 'culturalHighlights', stats);
  scrubString(guide.size, 'portCapacity', stats);
  scrubString(guide.size, 'annualVisitors', stats);
  scrubString(guide.size, 'citySize', stats);
  // Unverified numeric stubs that commonly accompany boilerplate packs
  if (
    guide.size &&
    isBoilerplate(guide.size.portCapacity || '') &&
    typeof guide.size.terminalCount === 'number' &&
    typeof guide.size.berthCount === 'number' &&
    guide.size.terminalCount === 1 &&
    guide.size.berthCount === 2
  ) {
    // Keep counts only when other size facts are specific; otherwise leave as-is
    // (renderer still shows numbers). Do not invent replacements.
  }
  scrubString(guide.gettingThere, 'fromTerminal', stats);
  scrubString(guide.gettingThere, 'distanceToCity', stats);
  scrubString(guide.gettingThere, 'walkingTime', stats);
  scrubString(guide.gettingThere, 'taxiInfo', stats);
  scrubString(guide.gettingThere, 'publicTransport', stats);
  scrubList(guide.gettingThere, 'transportation', stats);
}

/** Verified against PORT OF KIEL official terminal pages (portofkiel.com). */
const KIEL_GUIDE_PATCH = {
  portInfo: {
    description:
      'Baltic Sea port city at the western end of the Kiel Canal (Nord-Ostsee-Kanal), with city-centre cruise terminals on the Kiel Fjord and a larger Ostuferhafen berth farther from downtown.',
    location: 'Kiel, Schleswig-Holstein, Germany (Kiel Fjord / Baltic Sea)',
    timezone: 'CET (UTC+1) / CEST (UTC+2)',
    language: 'German',
    currency: 'Euro (EUR)',
    population: 'State capital of Schleswig-Holstein; municipal population on the order of ~250,000 (confirm current census figures from official city statistics)',
  },
  facts: {
    established:
      'Long-standing Baltic harbour city; the Kiel Canal (Nord-Ostsee-Kanal) opened in 1895 and remains a defining maritime landmark.',
    significance:
      'Major German Baltic cruise and ferry port; city-centre Ostseekai cruise terminals and Ostuferhafen berth serve cruise traffic, while Scandinavian ferry links also shape the harbour.',
    notableFeatures: [
      'Ostseekai cruise terminals (berths 27 and 28) in the city centre',
      'Ostuferhafen cruise berth no. 1 (~8 km from city centre per PORT OF KIEL)',
      'Kiel Canal (Nord-Ostsee-Kanal)',
      'Kiel Fjord waterfront and Kiel Week sailing events',
    ],
    culturalHighlights: [
      'City-centre waterfront within walking distance of Ostseekai/Norwegenkai',
      'Maritime heritage tied to the Kiel Canal and Baltic ferry links',
    ],
  },
  size: {
    portCapacity:
      'Ostseekai cruise terminals handle up to 11,000 passengers per day; PORT OF KIEL reports nearly 1 million cruise passengers begin or end sailings there annually (portofkiel.com).',
    terminalCount: 3,
    berthCount: 4,
    annualVisitors:
      'Nearly 1 million cruise passengers begin or end sailings at Ostseekai annually (PORT OF KIEL public terminal pages; confirm current-year totals with the port authority).',
    citySize:
      'State capital of Schleswig-Holstein on the Kiel Fjord; municipal population on the order of ~250,000 (confirm current official statistics).',
  },
  gettingThere: {
    fromTerminal:
      'Ostseekai and Norwegenkai sit about 300 m from the city centre per PORT OF KIEL; Ostuferhafen berth no. 1 is about 8 km from the city centre and typically needs a shuttle, taxi, or public transport.',
    transportation: ['Walking (Ostseekai / Norwegenkai)', 'Taxi', 'Local bus', 'Cruise shuttle (especially Ostuferhafen)', 'Train station near city-centre terminals'],
    distanceToCity: 'Ostseekai / Norwegenkai ~300 m; Ostuferhafen ~8 km (PORT OF KIEL)',
    walkingTime: 'City-centre terminals: short walk to downtown and Hauptbahnhof; Ostuferhafen is not a practical walk to the centre',
    taxiInfo: 'Taxis are available at the cruise terminals; allow extra time from Ostuferhafen',
    publicTransport: 'City buses and the main railway station are convenient from Ostseekai/Norwegenkai; plan a transfer if assigned to Ostuferhafen',
  },
};

const KIEL_TERMINALS = [
  {
    name: 'Ostseekai Terminal 27',
    slug: 'ostseekai-terminal-27',
    description:
      'City-centre cruise terminal building at Ostseekai berth 27. PORT OF KIEL lists ~300 m to the city centre, shore power, and a cruise passenger capacity of 6,500 for this berth facility.',
    terminal_type: 'both',
    terminal_status: 'active',
    facilities: ['check-in', 'waiting areas', 'luggage handling', 'shore power', 'boarding bridge'],
    distance_to_city_center_km: 0.3,
    transport_options: ['walking', 'taxi', 'local bus', 'Hauptbahnhof nearby'],
    is_primary: true,
    sort_order: 10,
    country_id: 'germany',
  },
  {
    name: 'Ostseekai Terminal 28',
    slug: 'ostseekai-terminal-28',
    description:
      'Second city-centre Ostseekai cruise terminal at berth 28 (paired with Terminal 27). PORT OF KIEL lists cruise passenger capacity of 4,500 for this facility and quay length of 285 m.',
    terminal_type: 'both',
    terminal_status: 'active',
    facilities: ['check-in', 'waiting areas', 'luggage handling', 'shore power', 'boarding bridge'],
    distance_to_city_center_km: 0.3,
    transport_options: ['walking', 'taxi', 'local bus', 'Hauptbahnhof nearby'],
    is_primary: false,
    sort_order: 20,
    country_id: 'germany',
  },
  {
    name: 'Ostuferhafen Berth No. 1',
    slug: 'ostuferhafen-berth-1',
    description:
      'Cruise berth on the east bank designed for large ships. PORT OF KIEL lists ~8 km to the city centre, 395 m quay length, and capacity of 6,000 passengers—plan transport into town.',
    terminal_type: 'both',
    terminal_status: 'active',
    facilities: ['passenger terminal', 'baggage drop-off', 'mobile gangway', 'shore power'],
    distance_to_city_center_km: 8,
    transport_options: ['cruise shuttle', 'taxi', 'public transport'],
    is_primary: false,
    sort_order: 30,
    country_id: 'germany',
  },
  {
    name: 'Norwegenkai (berth 22)',
    slug: 'norwegenkai-berth-22',
    description:
      'City-centre terminal (~300 m to downtown per PORT OF KIEL) primarily known for Color Line Kiel–Oslo ferry service; also listed in the port’s cruise-terminal overview with berth 22.',
    terminal_type: 'both',
    terminal_status: 'active',
    facilities: ['passenger facilities', 'boarding bridge'],
    distance_to_city_center_km: 0.3,
    transport_options: ['walking', 'taxi', 'local bus'],
    is_primary: false,
    sort_order: 40,
    country_id: 'germany',
  },
];

function main() {
  const guidesDoc = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
  const terminalsDoc = JSON.parse(fs.readFileSync(TERMINALS_PATH, 'utf8'));
  const guides = guidesDoc.byAppPortId || {};
  const stats = {
    portsAudited: Object.keys(guides).length,
    fieldsCleared: 0,
    listItemsRemoved: 0,
    kielEnriched: false,
    kielTerminalsAdded: false,
  };

  for (const guide of Object.values(guides)) scrubGuide(guide, stats);

  if (guides.kiel) {
    const g = guides.kiel;
    g.portInfo = { ...(g.portInfo || {}), ...KIEL_GUIDE_PATCH.portInfo };
    g.facts = { ...(g.facts || {}), ...KIEL_GUIDE_PATCH.facts };
    g.size = { ...(g.size || {}), ...KIEL_GUIDE_PATCH.size };
    g.gettingThere = { ...(g.gettingThere || {}), ...KIEL_GUIDE_PATCH.gettingThere };
    stats.kielEnriched = true;
  }

  terminalsDoc.byPortId = terminalsDoc.byPortId || {};
  terminalsDoc.byPortId.kiel = KIEL_TERMINALS;
  terminalsDoc.meta = {
    ...(terminalsDoc.meta || {}),
    kielEnrichmentAt: new Date().toISOString(),
    kielSource: 'PORT OF KIEL official terminal pages (portofkiel.com)',
  };
  stats.kielTerminalsAdded = true;

  guidesDoc.meta = {
    ...(guidesDoc.meta || {}),
    boilerplateStripAt: new Date().toISOString(),
    kielEnrichmentSource: 'PORT OF KIEL official terminal pages (portofkiel.com)',
  };

  fs.writeFileSync(GUIDES_PATH, JSON.stringify(guidesDoc, null, 2) + '\n');
  fs.writeFileSync(TERMINALS_PATH, JSON.stringify(terminalsDoc, null, 2) + '\n');
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(stats, null, 2) + '\n');
  console.log(JSON.stringify(stats, null, 2));
}

main();

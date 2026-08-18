'use strict';

/**
 * Deterministic ship ↔ port relevance for related links.
 * Never random-hash unrelated destinations (e.g. AIDAcosma → Tampa).
 *
 * Priority:
 * 1. cruise-line home market / typical deployment regions
 * 2. matching port.region
 * 3. matching country
 * 4. destination-family overlap (Mediterranean, Baltic, Caribbean, …)
 * 5. stable slug tie-break
 */

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Region tokens that belong to the same cruising family. */
const REGION_FAMILIES = {
  europe_north: [
    'baltic',
    'northern europe',
    'scandinavia',
    'norway',
    'nordic',
    'north sea',
    'british isles',
    'uk',
    'scotland',
    'ireland',
    'iceland',
    'germany',
    'netherlands',
  ],
  europe_med: [
    'mediterranean',
    'greek isles',
    'aegean',
    'adriatic',
    'tyrrhenian',
    'canary',
    'canary islands',
    'iberia',
    'spain',
    'italy',
    'france',
    'croatia',
    'greece',
    'turkey',
    'portugal',
  ],
  caribbean: ['caribbean', 'bahamas', 'bermuda', 'mexico', 'florida', 'gulf'],
  alaska: ['alaska', 'pacific northwest', 'inside passage'],
  hawaii: ['hawaii', 'south pacific', 'tahiti', 'french polynesia'],
  asia: ['asia', 'japan', 'china', 'southeast asia', 'india'],
  australia: ['australia', 'new zealand', 'oceania'],
  middle_east: ['middle east', 'arabia', 'red sea', 'emirates'],
  transatlantic: ['transatlantic', 'azores'],
};

const LINE_PROFILES = {
  aida: {
    families: ['europe_north', 'europe_med'],
    countries: [
      'germany',
      'denmark',
      'sweden',
      'norway',
      'finland',
      'estonia',
      'spain',
      'italy',
      'greece',
      'france',
      'netherlands',
      'united kingdom',
      'portugal',
      'croatia',
    ],
  },
  tui: { families: ['europe_north', 'europe_med'], countries: ['germany', 'spain', 'norway', 'italy', 'greece'] },
  hapag: { families: ['europe_north', 'europe_med', 'alaska', 'asia'], countries: ['germany', 'norway'] },
  phoenix: { families: ['europe_north', 'europe_med'], countries: ['germany'] },
  nicko: { families: ['europe_north', 'europe_med'], countries: ['germany'] },
  plantours: { families: ['europe_north', 'europe_med'], countries: ['germany'] },
  arosa: { families: ['europe_north', 'europe_med'], countries: ['germany'] },
  seacloud: { families: ['europe_med', 'europe_north', 'caribbean'], countries: ['germany', 'spain', 'italy'] },
  carnival: {
    families: ['caribbean', 'alaska', 'australia'],
    countries: ['united states', 'mexico', 'bahamas', 'jamaica', 'canada'],
  },
  royal: {
    families: ['caribbean', 'europe_med', 'alaska', 'australia', 'asia'],
    countries: ['united states', 'mexico', 'bahamas', 'spain', 'italy'],
  },
  norwegian: {
    families: ['caribbean', 'europe_med', 'alaska', 'europe_north'],
    countries: ['united states', 'mexico', 'bahamas', 'norway'],
  },
  princess: {
    families: ['alaska', 'caribbean', 'europe_med', 'australia', 'asia'],
    countries: ['united states', 'canada', 'australia', 'mexico'],
  },
  celebrity: {
    families: ['caribbean', 'europe_med', 'alaska', 'australia'],
    countries: ['united states', 'spain', 'italy', 'mexico'],
  },
  disney: { families: ['caribbean', 'europe_med'], countries: ['united states', 'bahamas', 'mexico'] },
  virgin: { families: ['caribbean', 'europe_med'], countries: ['united states', 'spain', 'italy'] },
  hollandamerica: {
    families: ['alaska', 'caribbean', 'europe_med', 'europe_north', 'australia'],
    countries: ['united states', 'canada', 'netherlands'],
  },
  cunard: {
    families: ['transatlantic', 'europe_north', 'europe_med', 'caribbean'],
    countries: ['united kingdom', 'united states', 'spain'],
  },
  po: { families: ['europe_med', 'europe_north', 'caribbean'], countries: ['united kingdom', 'spain', 'italy'] },
  saga: { families: ['europe_med', 'europe_north'], countries: ['united kingdom'] },
  marella: { families: ['europe_med', 'caribbean'], countries: ['united kingdom', 'spain'] },
  fred: { families: ['europe_north', 'europe_med'], countries: ['united kingdom', 'norway'] },
  costa: { families: ['europe_med', 'caribbean', 'europe_north'], countries: ['italy', 'spain', 'france', 'greece'] },
  msc: {
    families: ['europe_med', 'caribbean', 'europe_north'],
    countries: ['italy', 'spain', 'france', 'united states', 'brazil'],
  },
  explora: { families: ['europe_med', 'caribbean'], countries: ['italy', 'spain', 'france'] },
  silversea: { families: ['europe_med', 'alaska', 'asia', 'australia'], countries: ['italy', 'united states'] },
  hurtigruten: { families: ['europe_north', 'alaska'], countries: ['norway', 'iceland', 'united kingdom'] },
  havila: { families: ['europe_north'], countries: ['norway'] },
  viking: { families: ['europe_med', 'europe_north', 'caribbean', 'asia'], countries: ['norway', 'italy', 'spain'] },
  ponant: { families: ['europe_med', 'alaska', 'asia', 'australia'], countries: ['france'] },
  celestyal: { families: ['europe_med'], countries: ['greece', 'turkey', 'cyprus'] },
  pullmantur: { families: ['europe_med', 'caribbean'], countries: ['spain'] },
};

const LINE_NAME_ALIASES = [
  [/aida/, 'aida'],
  [/tui/, 'tui'],
  [/hapag/, 'hapag'],
  [/phoenix/, 'phoenix'],
  [/carnival/, 'carnival'],
  [/royal caribbean/, 'royal'],
  [/norwegian/, 'norwegian'],
  [/princess/, 'princess'],
  [/celebrity/, 'celebrity'],
  [/disney/, 'disney'],
  [/virgin/, 'virgin'],
  [/holland america/, 'hollandamerica'],
  [/cunard/, 'cunard'],
  [/p\s*&\s*o/, 'po'],
  [/saga/, 'saga'],
  [/marella/, 'marella'],
  [/fred/, 'fred'],
  [/costa/, 'costa'],
  [/msc/, 'msc'],
  [/explora/, 'explora'],
  [/silversea/, 'silversea'],
  [/hurtigruten/, 'hurtigruten'],
  [/havila/, 'havila'],
  [/viking/, 'viking'],
  [/ponant/, 'ponant'],
  [/celestyal/, 'celestyal'],
];

function resolveLineId(ship) {
  const explicit = norm(ship.lineId || ship.line_id || '');
  if (explicit && LINE_PROFILES[explicit]) return explicit;
  const name = norm(ship.cruise_line || ship.cruiseLine || '');
  for (const [re, id] of LINE_NAME_ALIASES) {
    if (re.test(name)) return id;
  }
  return explicit || '';
}

function familyTokens(familyId) {
  return REGION_FAMILIES[familyId] || [];
}

function portBlob(port) {
  return norm([port.region, port.country, port.name, port.slug].filter(Boolean).join(' '));
}

function scorePortForShip(port, ship) {
  const lineId = resolveLineId(ship);
  const profile = LINE_PROFILES[lineId] || { families: [], countries: [] };
  const blob = portBlob(port);
  const region = norm(port.region);
  const country = norm(port.country);
  let score = 0;

  for (const familyId of profile.families) {
    for (const token of familyTokens(familyId)) {
      if (region === token) score += 120;
      else if (region.includes(token) || blob.includes(token)) score += 70;
    }
  }
  for (const c of profile.countries) {
    if (country === c) score += 50;
    else if (blob.includes(c)) score += 20;
  }

  // Strong negative for clearly mismatched home-market pairs.
  const isEuropeanLine = (profile.families || []).some((f) => f === 'europe_north' || f === 'europe_med');
  const isCaribbeanFamily = (profile.families || []).includes('caribbean');
  if (isEuropeanLine && !isCaribbeanFamily) {
    if (/\b(florida|texas|bahamas|jamaica|cozumel|tampa|miami|galveston)\b/.test(blob)) score -= 80;
  }

  return score;
}

function rankByScore(items, scoreFn) {
  return items
    .map((item) => ({ item, score: scoreFn(item) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const as = String(a.item.slug || '');
      const bs = String(b.item.slug || '');
      return as.localeCompare(bs);
    })
    .map((x) => x.item);
}

function pickPortsForShipPage(allPorts, ship, max = 5) {
  const others = (allPorts || []).filter((p) => p && p.slug);
  if (!others.length) return [];
  const ranked = rankByScore(others, (p) => scorePortForShip(p, ship));
  const positive = ranked.filter((p) => scorePortForShip(p, ship) > 0);
  const pool = positive.length >= Math.min(2, max) ? positive : ranked;
  return pool.slice(0, max);
}

function scoreShipForPort(ship, port) {
  return scorePortForShip(port, ship);
}

function pickShipsForPortPage(allShips, port, max = 4) {
  const others = (allShips || []).filter((s) => s && s.slug);
  if (!others.length) return [];
  const ranked = rankByScore(others, (s) => scoreShipForPort(s, port));
  const positive = ranked.filter((s) => scoreShipForPort(s, port) > 0);
  const pool = positive.length >= Math.min(2, max) ? positive : ranked;
  return pool.slice(0, max);
}

function pickRelatedShips(all, current, max = 6) {
  const others = (all || []).filter((s) => s && s.slug && s.slug !== current.slug);
  const line = norm(current.cruise_line || current.cruiseLine);
  const lineId = resolveLineId(current);
  const sameLine = others.filter((s) => {
    if (lineId && resolveLineId(s) === lineId) return true;
    return norm(s.cruise_line || s.cruiseLine) === line && line;
  });
  const sameClass = others.filter(
    (s) =>
      !sameLine.includes(s) &&
      current.shipClass &&
      norm(s.shipClass) === norm(current.shipClass)
  );
  const rest = others.filter((s) => !sameLine.includes(s) && !sameClass.includes(s));
  return [...sameLine, ...sameClass, ...rest].slice(0, max);
}

function pickRelatedPorts(all, current, max = 5) {
  const others = (all || []).filter((p) => p && p.slug && p.slug !== current.slug);
  const region = norm(current.region);
  const country = norm(current.country);
  return rankByScore(others, (p) => {
    let score = 0;
    if (region && norm(p.region) === region) score += 100;
    else if (region && norm(p.region).includes(region)) score += 40;
    if (country && norm(p.country) === country) score += 60;
    return score;
  }).slice(0, max);
}

module.exports = {
  resolveLineId,
  scorePortForShip,
  pickPortsForShipPage,
  pickShipsForPortPage,
  pickRelatedShips,
  pickRelatedPorts,
};

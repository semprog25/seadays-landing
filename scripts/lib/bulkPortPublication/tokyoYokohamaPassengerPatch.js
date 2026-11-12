'use strict'

const TOKYO_PASSENGER_LEAD =
  'Cruise itineraries labelled Tokyo often berth at Yokohama (Osanbashi) or at Tokyo Port facilities. Tokyo International Cruise Terminal (TICT) at Aomi and Harumi Passenger Terminal are different facilities—match the terminal name on your sailing documents. The City of Yokohama publishes Osanbashi berth dimensions and approach limits including Yokohama Bay Bridge air draft. Tokyo Port Terminal Corporation notes that Harumi remains in use alongside TICT—do not assume they are the same pier.'

const TOKYO_GETTING_THERE = {
  fromTerminal:
    'Confirm on sailing documents: Osanbashi International Passenger Terminal (Yokohama) or Tokyo International Cruise Terminal / Harumi Passenger Terminal (Tokyo). These are not interchangeable.',
  transportation: ['Train and metro links', 'Local buses', 'Taxis'],
  distanceAnswer:
    'Walking and transfer times depend on which terminal you use. Osanbashi is within Yokohama waterfront; Tokyo terminals require confirmed rail or shuttle plans—verify with your cruise line before planning.',
  taxiInfo: 'Taxis are generally available when cruise ships are in port; confirm pickup areas with terminal staff.',
  publicTransport:
    'From Osanbashi, Nihon-odori Station on the Minatomirai Line is a short walk per city port information. From TICT or Harumi, use Yurikamome or other Tokyo transit—confirm routes for your sailing date.',
}

const TOKYO_POLITICS = {
  governmentType: 'Unitary parliamentary constitutional monarchy',
  stability: 'Highly stable',
  visaRequirements:
    'Japan sets its own entry and visa rules. Requirements vary by nationality and trip purpose. Confirm with official government sources and your cruise line before travel—not legal advice.',
  entryRequirements:
    'Carry a valid passport. Cruise transit formalities can differ from airport entry—follow your ship’s document checklist and terminal instructions.',
}

function patchTokyoYokohamaDraft(draft) {
  const next = JSON.parse(JSON.stringify(draft))
  next.portName = 'Tokyo / Yokohama'
  next.portInfo = {
    ...(next.portInfo || {}),
    description: TOKYO_PASSENGER_LEAD,
    timezone: 'JST (UTC+9)',
    language: 'Japanese',
    currency: 'Japanese Yen (JPY)',
    population: '',
    location: '',
  }
  next.gettingThere = { ...TOKYO_GETTING_THERE }
  next.politics = { ...TOKYO_POLITICS }
  next.passengerSurfaceClear = ['size', 'climate', 'facts', 'hero', 'terminals', 'reviews', 'experiences']
  next.thingsToDo = {
    ...(next.thingsToDo || {}),
    practicalTip:
      'Read the exact terminal name on sailing documents—TICT, Harumi, and Osanbashi are different facilities.',
    topThings: [
      'Minato Mirai / Chinatown (Yokohama)—plan only when Osanbashi is your terminal.',
      'Tokyo neighbourhood day—from TICT or Harumi with confirmed rail transfers.',
      'Kamakura or Hakone coaches—full-day only with confirmed operators and generous return buffer.',
    ],
  }
  next.researchImport = {
    ...(next.researchImport || {}),
    unresolved_claims: [
      'tict_harumi_quay_loa_unverified',
      'terminal_door_gps_null',
      'japan_immigration_primary_not_captured',
      'daikoku_cruise_use_unverified',
    ],
  }
  return next
}

module.exports = {
  TOKYO_PASSENGER_LEAD,
  TOKYO_GETTING_THERE,
  TOKYO_POLITICS,
  patchTokyoYokohamaDraft,
}

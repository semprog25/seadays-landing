#!/usr/bin/env node
'use strict';

/**
 * Phase 1 quality correction pass (landing repo only).
 * - Palma enrichment → palma-de-mallorca
 * - Visa boilerplate cleanup
 * - berthCount contradictions
 * - Soften/verify statistics
 * - Terminal accuracy for flagged ports
 * - Light passenger-usefulness upgrades for Phase 1 ports
 *
 * Does NOT expand the catalogue. Does NOT touch Viator builder / .env / mobile app.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');
const TERMINALS_PATH = path.join(REPO, 'data', 'public-port-terminals.json');
const OVERRIDES_PATH = path.join(REPO, 'data', 'landing-cruise-content-overrides.json');

const VISA_BOILER_RE =
  /Visa-free for EU,?\s*US,?\s*Canada,?\s*Australia(?:,?\s*and many others)?(?:\s*\(90 days\))?\.?\s*(?:Schengen Area member\.?)?/i;

const SAFE_SCHENGEN_VISA =
  'Entry and visa rules depend on nationality. Many visitors use Schengen short-stay rules, but requirements change—confirm with official government sources and your cruise line before travel.';

const SAFE_ENTRY =
  'Carry a valid passport (or a national ID where your cruise line and destination authorities accept it). Cruise transit formalities can differ from a normal airport entry—follow your ship’s document list.';

const SAFE_GENERIC_VISA =
  'Entry and visa rules depend on nationality and itinerary. Confirm requirements with official government sources and your cruise line before travel; rules can change.';

const PHASE1 = [
  'barcelona',
  'vigo',
  'miami',
  'civitavecchia',
  'southampton',
  'dubrovnik',
  'marseille',
  'genua',
  'piraeus',
  'copenhagen',
  'amsterdam',
  'naples',
  'palma-de-mallorca',
  'valencia',
  'malaga',
  'cozumel',
  'nassau',
  'santorini',
  'bergen',
  'stockholm',
];

function deepClone(x) {
  return JSON.parse(JSON.stringify(x));
}

function isSchengenCountry(country) {
  const c = String(country || '').toLowerCase();
  return [
    'spain',
    'italy',
    'france',
    'germany',
    'greece',
    'croatia',
    'denmark',
    'netherlands',
    'sweden',
    'norway',
    'finland',
    'portugal',
    'belgium',
    'austria',
    'malta',
    'iceland',
    'estonia',
    'latvia',
    'lithuania',
    'poland',
    'czech',
    'slovakia',
    'slovenia',
    'hungary',
    'luxembourg',
    'switzerland',
  ].some((x) => c.includes(x));
}

function mergeGuidePreferringRich(target, source) {
  const out = deepClone(target || {});
  if (!source) return out;
  out.portName = source.portName || out.portName;
  out.country = source.country || out.country;
  for (const section of ['portInfo', 'facts', 'size', 'climate', 'politics', 'gettingThere']) {
    if (!source[section]) continue;
    out[section] = out[section] || {};
    for (const [k, v] of Object.entries(source[section])) {
      if (v == null || v === '') continue;
      if (Array.isArray(v)) {
        if (v.length && (!Array.isArray(out[section][k]) || out[section][k].length < v.length)) {
          out[section][k] = v;
        }
        continue;
      }
      if (typeof v === 'number') {
        out[section][k] = v;
        continue;
      }
      if (typeof v === 'string') {
        const cur = String(out[section][k] || '');
        const boiler =
          /Handles cruise passengers|Welcomes cruise passengers throughout the year|Varies by location|Cruise terminal provides access/i.test(
            cur
          );
        if (!cur || boiler || v.length >= cur.length) out[section][k] = v;
      }
    }
  }
  return out;
}

function fixVisa(guide) {
  if (!guide.politics) guide.politics = {};
  const visa = String(guide.politics.visaRequirements || '');
  const entry = String(guide.politics.entryRequirements || '');
  let changed = false;
  if (VISA_BOILER_RE.test(visa) || /visa-free for eu/i.test(visa)) {
    guide.politics.visaRequirements = isSchengenCountry(guide.country)
      ? SAFE_SCHENGEN_VISA
      : SAFE_GENERIC_VISA;
    changed = true;
  }
  // Overly definitive EU-ID-only claims
  if (/EU citizens need ID card only/i.test(entry) || VISA_BOILER_RE.test(entry)) {
    guide.politics.entryRequirements = SAFE_ENTRY;
    changed = true;
  } else if (!entry.trim()) {
    guide.politics.entryRequirements = SAFE_ENTRY;
    changed = true;
  } else if (/valid passport or permitted national id/i.test(entry) && entry.length < 80) {
    // Expand thin leftover lines on Phase 1 ports later; keep generic thin lines as SAFE_ENTRY when clearly stubby
    if (entry.trim().split(/\s+/).length <= 12) {
      guide.politics.entryRequirements = SAFE_ENTRY;
      changed = true;
    }
  }
  return changed;
}

function fixBerthContradiction(guide) {
  const size = guide.size || {};
  const t = size.terminalCount;
  const b = size.berthCount;
  if (typeof t === 'number' && typeof b === 'number' && t > 0 && b > 0 && b < t) {
    // Field means berthing positions; a lower count than terminal buildings is usually a stale leftover.
    guide.size.berthCount = null;
    return true;
  }
  return false;
}

function applyStatsAndTerminals(guides, terminals) {
  const notes = [];

  // Barcelona — verified Port de Barcelona 2025 pleasure-cruise passengers: 3,999,258
  if (guides.barcelona) {
    guides.barcelona.size.annualVisitors =
      'About 4.0 million pleasure-cruise passenger movements in 2025 (Port de Barcelona official traffic statistics; includes transit plus embark/disembark movements)';
    guides.barcelona.size.berthCount = null;
    notes.push('barcelona: verified ~4.0M 2025 pleasure-cruise passenger movements; berthCount nulled');
  }

  // Miami — verified PortMiami FY2025
  if (guides.miami) {
    guides.miami.size.annualVisitors =
      '8,564,151 cruise passengers in FY2025 (Miami-Dade PortMiami official historical snapshot; fiscal year Oct–Sep)';
    guides.miami.size.berthCount = null;
    notes.push('miami: kept verified FY2025 total; berthCount nulled');
  }

  // Vigo — keep approximate, already cautious
  if (guides.vigo) {
    guides.vigo.size.annualVisitors =
      'Port of Vigo materials describe on the order of 200,000+ cruise visitors in recent seasons (confirm current-year totals on apvigo.es; not a single audited census figure in this dataset)';
    // berthCount 8 with terminalCount 3 is plausible (berths > terminals) — leave
    notes.push('vigo: softened annual visitors wording');
  }

  // Valencia — cannot confidently verify 500k+ here → soften
  if (guides.valencia) {
    guides.valencia.size.annualVisitors =
      'A significant Mediterranean cruise call for Spain (exact annual passenger totals vary by year—check Valenciaport publications for the current season)';
    notes.push('valencia: removed unverified 500,000+ figure');
  }

  // Santorini — soften 1M+
  if (guides.santorini) {
    guides.santorini.size.annualVisitors =
      'A very high-volume Aegean tender call in peak season (published annual cruise totals vary by source and year—treat “million+” claims cautiously and check current island/port reports)';
    notes.push('santorini: softened unverified 1M+ claim');
  }

  // Genoa terminals — Ponte dei Mille + Ponte Andrea Doria (Stazioni Marittime)
  terminals.genua = [
    {
      name: 'Ponte dei Mille Cruise Terminal',
      slug: 'ponte-dei-mille',
      description:
        'Primary Genoa cruise terminal managed by Stazioni Marittime; large multi-level passenger facility beside the historic waterfront. Exact berth assignment depends on ship and date.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['check-in halls', 'security', 'escalators/lifts', 'taxi access', 'nearby retail'],
      distance_to_city_center_km: 0.8,
      transport_options: ['walking to Porto Antico', 'taxi', 'bus', 'rail via Piazza Principe (~500 m area)'],
      is_primary: true,
      sort_order: 10,
      country_id: 'italy',
    },
    {
      name: 'Ponte Andrea Doria Cruise Terminal',
      slug: 'ponte-andrea-doria',
      description:
        'Second major Stazioni Marittime cruise terminal in Genoa’s passenger port area. Confirm whether your sailing uses Ponte dei Mille or Ponte Andrea Doria on cruise documents.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger halls', 'baggage/customs flows', 'taxi', 'coach access'],
      distance_to_city_center_km: 1.0,
      transport_options: ['taxi', 'walking toward Porto Antico', 'bus'],
      is_primary: false,
      sort_order: 20,
      country_id: 'italy',
    },
  ];
  if (guides.genua) {
    guides.genua.portName = 'Genoa';
    guides.genua.size.terminalCount = 2;
    guides.genua.size.berthCount = null;
    guides.genua.size.portCapacity =
      'Stazioni Marittime passenger complex with two main cruise terminals (Ponte dei Mille and Ponte Andrea Doria) among a larger ferry/cruise berth set';
    guides.genua.gettingThere.fromTerminal =
      'Most cruise calls use Stazioni Marittime facilities at Ponte dei Mille or Ponte Andrea Doria—check your cruise documents for the assigned terminal';
    guides.genua.gettingThere.distanceToCity =
      'Passenger terminals sit beside Porto Antico; historic center is typically within about 0.5–1.5 km depending on berth and route';
    guides.genua.facts.notableFeatures = [
      'Ponte dei Mille cruise terminal',
      'Ponte Andrea Doria cruise terminal',
      'Porto Antico waterfront and Aquarium of Genoa',
      'Via Garibaldi UNESCO palace street',
    ];
    notes.push('genua: terminals updated to Ponte dei Mille + Ponte Andrea Doria');
  }

  // Piraeus — keep Miaoulis Terminal A naming; clarify shuttle
  if (guides.piraeus) {
    guides.piraeus.gettingThere.walkingTime =
      'Metro stations are a meaningful walk from cruise gates (often ~20 minutes from the main terminal area, longer from outer berths)—many guests use taxi or an organized transfer when time is tight';
    guides.piraeus.gettingThere.publicTransport =
      'Free internal port shuttles often link outer berths to the main terminal area. From outside the port, Athens metro/bus options reach the center; buy validated tickets and allow generous return buffers';
  }
  if (terminals.piraeus) {
    terminals.piraeus = terminals.piraeus.map((t) => {
      if (/terminal a|miaoulis/i.test(t.name + t.slug)) {
        return {
          ...t,
          name: 'Piraeus Cruise Terminal A (Miaoulis)',
          description:
            'Main Piraeus cruise passenger terminal (commonly called Miaoulis / Terminal A) with check-in, border-control support, and coach parking. Outer berths may require an internal port shuttle to reach this hall.',
        };
      }
      if (/terminal b|outer/i.test(t.name + t.slug)) {
        return {
          ...t,
          name: 'Piraeus outer cruise berths (often linked as Terminal B area)',
          description:
            'Additional cruise berths within the passenger port. Guests are commonly directed to use free internal shuttles toward the main Terminal A / Miaoulis hall before leaving the port zone—follow day-of port signage.',
        };
      }
      return t;
    });
    notes.push('piraeus: clarified Terminal A/B wording');
  }

  // Cozumel — keep Puerta Maya / International Pier with approximate language
  if (terminals.cozumel) {
    terminals.cozumel = terminals.cozumel.map((t) => {
      if (/puerta maya/i.test(t.name)) {
        return {
          ...t,
          description:
            'Major Cozumel cruise pier complex commonly listed as Puerta Maya, with passenger facilities and taxi/tour access toward San Miguel and beach clubs. Confirm your ship’s assigned pier on the daily program.',
        };
      }
      if (/international/i.test(t.name)) {
        return {
          ...t,
          description:
            'Additional Cozumel cruise pier often labeled International Pier on multi-ship days. Pier names and assignments can vary by call—follow ship and port instructions.',
        };
      }
      return t;
    });
    notes.push('cozumel: pier naming kept with assignment caveat');
  }

  // Marseille — pin ~8 km language; clarify shuttle
  if (guides.marseille) {
    guides.marseille.gettingThere.distanceToCity =
      'MPCT is about 8 km from the Vieux-Port by road (commonly cited ~7–10 km depending on routing); Joliette berths are much closer (~1–2 km)';
    guides.marseille.gettingThere.publicTransport =
      'From MPCT, use the port/city shuttle toward the Joliette / Terrasses du Port area (do not walk through the industrial port), then continue by metro, tram, walking, or taxi to the Vieux-Port. Exact shuttle branding/stops can vary—follow port signage on the day';
    notes.push('marseille: clarified MPCT ~8 km + shuttle caveats');
  }

  // Bergen — avoid single-berth implication
  if (guides.bergen) {
    guides.bergen.gettingThere.fromTerminal =
      'Most ships berth in the downtown harbor area often described around Skolten / central quays; exact quay depends on ship and date';
    guides.bergen.size.portCapacity =
      'Multiple downtown/near-downtown cruise berths (often referred to around the Skolten / central harbor area rather than a single named building)';
  }
  if (terminals.bergen && terminals.bergen[0]) {
    terminals.bergen[0] = {
      ...terminals.bergen[0],
      name: 'Bergen downtown cruise quays (Skolten / central harbor area)',
      description:
        'Cruise ships typically use downtown Bergen quays in the Skolten / central harbor area within walking distance of Bryggen. There is not always a single exclusive terminal building—follow your ship’s gangway directions and day-of port signage.',
    };
    notes.push('bergen: clarified multi-quay downtown wording');
  }

  // Null remaining contradictory berths
  for (const id of Object.keys(guides)) {
    if (fixBerthContradiction(guides[id])) {
      notes.push(`${id}: nulled berthCount < terminalCount contradiction`);
    }
  }

  return notes;
}

function improvePassengerUsefulness(guides) {
  const tips = {
    barcelona: {
      overviewExtra: null,
      gettingNote:
        'Ship-to-terminal assignment (Adossat A–D vs WTC) depends on your sailing—check the daily program. For a 6–8 hour call, prioritize one cluster (Gothic Quarter/Ramblas or a pre-booked Gaudí timed ticket) and return with shuttle/taxi buffer.',
    },
    miami: {
      gettingNote:
        'Confirm your lettered terminal before rideshare drop-off. Weekend turnarounds are slow—leave generous airport→port buffer. PortMiami is primarily an embarkation hub rather than a long shore-day destination.',
    },
    civitavecchia: {
      gettingNote:
        'Rome needs a realistic all-aboard buffer (train + station/port transfer + security). If your call is under ~8–9 hours, consider a tighter Rome plan or stay nearer the coast rather than overpacking sights.',
    },
    southampton: {
      gettingNote:
        'Eastern Docks (Gate 4: Ocean/QEII) and Western Docks (Gate 10: City/Horizon/Mayflower) are different approaches—use the gate on your cruise documents. Arrive only in the embarkation window your line provides.',
    },
    santorini: {
      gettingNote:
        'Tender + cable-car queues are the main timing risk. On multi-ship days, prioritize Fira first and leave extra time to descend before tender cutoff.',
    },
    dubrovnik: {
      gettingNote:
        'Gruž is ~3 km from Pile Gate. In summer heat, bus/shuttle beats the 30–40 minute walk. City Walls tickets and early starts reduce peak crowding.',
    },
  };

  for (const [id, pack] of Object.entries(tips)) {
    const g = guides[id];
    if (!g || !g.gettingThere) continue;
    if (pack.gettingNote && !(g.gettingThere.publicTransport || '').includes('all-aboard') && !(g.gettingThere.fromTerminal || '').includes('6–8')) {
      const base = g.gettingThere.publicTransport || '';
      if (!base.includes(pack.gettingNote.slice(0, 40))) {
        g.gettingThere.publicTransport = base ? `${base} ${pack.gettingNote}` : pack.gettingNote;
      }
    }
  }
}

function updateHighlights(overrides) {
  const map = {
    'barcelona-spain': [
      'BEST FOR A SHORT PORT CALL: Gothic Quarter + waterfront return buffer',
      'Sagrada Família only with a pre-booked timed ticket',
      'Park Güell viewpoints when transport time allows',
      'Barceloneta promenade for a simpler beach/port day',
      'Boqueria Market / Las Ramblas cluster',
      'Montjuïc on longer calls only',
    ],
    'palma-de-mallorca-spain': [
      'BEST FOR A SHORT PORT CALL: Cathedral (La Seu) + old town lanes',
      'Passeig del Born cafés',
      'Bellver Castle if hills/time allow',
      'Waterfront promenade near the port shuttle drop-off',
      'Local tapas / ensaimada stop',
      'Island interior tours only on long calls',
    ],
    'genoa-italy': [
      'BEST FOR A SHORT PORT CALL: Porto Antico + Aquarium area',
      'Centro storico caruggi walk',
      'Via Garibaldi palace street',
      'Castelletto viewpoint if mobility allows',
      'Focaccia tasting near the waterfront',
      'Cinque Terre only with reliable timing and transfers',
    ],
  };
  for (const [slug, highlights] of Object.entries(map)) {
    overrides.ports = overrides.ports || {};
    const cur = overrides.ports[slug] || {};
    overrides.ports[slug] = {
      ...cur,
      highlights,
      rewrittenAt: new Date().toISOString(),
      model: 'phase1-quality-correction',
      confidenceScore: 0.88,
      sourcesUsed: [...new Set([...(cur.sourcesUsed || []), 'phase1-correction-2026'])],
    };
  }
}

function main() {
  const guidesFile = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
  const terminalsFile = JSON.parse(fs.readFileSync(TERMINALS_PATH, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
  const guides = guidesFile.byAppPortId;
  const terminals = terminalsFile.byPortId || (terminalsFile.byPortId = {});

  const report = {
    generatedAt: new Date().toISOString(),
    amsterdamDecision:
      'NOT published. Amsterdam exists in guide/affiliate data (amsterdam, amsterdam-ijmuiden) but is absent from the 323-port SEO cruise dataset (scripts/lib/appCruiseDataset.js) that drives /ports/ page generation. No Amsterdam SEO page should be invented outside that dataset. Enrichment under amsterdam remains available for a future dataset inclusion; it is not passenger-facing today.',
    actions: [],
  };

  // --- Palma merge ---
  if (guides.palma && guides['palma-de-mallorca']) {
    const enriched = deepClone(guides.palma);
    enriched.appPortId = 'palma-de-mallorca';
    enriched.portName = 'Palma de Mallorca';
    guides['palma-de-mallorca'] = mergeGuidePreferringRich(guides['palma-de-mallorca'], enriched);
    guides['palma-de-mallorca'].appPortId = 'palma-de-mallorca';
    // Restore thinner separate `palma` stub? Keep pre-enrichment-like minimal to avoid two rich Mallorca records.
    // Revert `palma` to non-competing thin record pointing editors to palma-de-mallorca via softer content
    // Actually: leave `palma` as a short distinct key if it existed historically, but strip the Mallorca-specific rich enrichment
    // to avoid duplicate rich records. Use the OLD thinner description pattern from palma-de-mallorca before merge? 
    // Simplest safe approach: copy palma-de-mallorca was thin; palma had enrichment. After merge into palma-de-mallorca,
    // reset `palma` to a short generic placeholder WITHOUT pretending it is Mallorca-complete.
    guides.palma = {
      ...guides.palma,
      portName: 'Palma',
      country: guides.palma.country || 'Spain',
      portInfo: {
        ...guides.palma.portInfo,
        description:
          'See Palma de Mallorca for the primary Balearic cruise-port guide used by SeaDays website pages. This legacy key is retained for app-id compatibility.',
      },
    };
    if (terminals.palma && terminals.palma.length) {
      terminals['palma-de-mallorca'] = deepClone(terminals.palma);
      delete terminals.palma;
    }
    // Fix override slug content from palma-spain mistakes already cleaned earlier
    if (overrides.ports['palma-de-mallorca-spain'] && guides['palma-de-mallorca'].portInfo) {
      overrides.ports['palma-de-mallorca-spain'].description =
        guides['palma-de-mallorca'].portInfo.description;
    }
    report.actions.push('Merged palma enrichment into palma-de-mallorca; moved terminals key');
  }

  // Genoa display name
  if (guides.genua) {
    guides.genua.portName = 'Genoa';
    guides.genua.country = guides.genua.country || 'Italy';
  }

  // Visa cleanup across ALL guides
  let visaFixed = 0;
  for (const id of Object.keys(guides)) {
    if (fixVisa(guides[id])) visaFixed += 1;
  }
  report.actions.push(`Replaced definitive visa boilerplate / thin entry stubs on ${visaFixed} guides`);

  // Stats + terminals + berth fixes
  report.actions.push(...applyStatsAndTerminals(guides, terminals));

  // Light usefulness
  improvePassengerUsefulness(guides);
  updateHighlights(overrides);

  // Ensure Phase 1 politics are safe even if not matched by regex
  for (const id of ['genua', 'naples', 'palma-de-mallorca', 'valencia', 'malaga', 'santorini']) {
    const g = guides[id];
    if (!g) continue;
    g.politics = g.politics || {};
    if (VISA_BOILER_RE.test(g.politics.visaRequirements || '') || /visa-free for eu/i.test(g.politics.visaRequirements || '')) {
      g.politics.visaRequirements = SAFE_SCHENGEN_VISA;
    }
    if (/EU citizens need ID card only/i.test(g.politics.entryRequirements || '')) {
      g.politics.entryRequirements = SAFE_ENTRY;
    }
  }

  guidesFile.meta = {
    ...(guidesFile.meta || {}),
    lastCorrectedAt: new Date().toISOString(),
    lastCorrection: 'phase1-quality-correction',
    count: Object.keys(guides).length,
  };
  terminalsFile.meta = {
    ...(terminalsFile.meta || {}),
    generatedAt: new Date().toISOString(),
    count: Object.values(terminals).reduce((n, arr) => n + (arr?.length || 0), 0),
    portCount: Object.keys(terminals).length,
    source: (terminalsFile.meta && terminalsFile.meta.source) || 'public.port_terminals + phase1 corrections',
  };
  overrides.updatedAt = new Date().toISOString();

  fs.writeFileSync(GUIDES_PATH, JSON.stringify(guidesFile, null, 2) + '\n');
  fs.writeFileSync(TERMINALS_PATH, JSON.stringify(terminalsFile, null, 2) + '\n');
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n');
  fs.writeFileSync(
    path.join(REPO, 'data', 'reports', 'phase1-quality-correction-actions.json'),
    JSON.stringify(report, null, 2) + '\n'
  );
  console.log(JSON.stringify(report, null, 2));
}

main();

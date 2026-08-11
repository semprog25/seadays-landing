#!/usr/bin/env node
'use strict';

/**
 * Phase 2: Enrich highest-priority public Port Guide records in the landing repo.
 * Does NOT modify the mobile app. Does NOT invent community reviews/Q&A.
 * Merge-only: never replace richer non-boilerplate content with shorter text.
 *
 * Usage (from seadays-landing):
 *   node scripts/enrich-priority-port-guides.js
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');
const TERMINALS_PATH = path.join(REPO, 'data', 'public-port-terminals.json');
const OVERRIDES_PATH = path.join(REPO, 'data', 'landing-cruise-content-overrides.json');
const REPORT_PATH = path.join(REPO, 'data', 'reports', 'phase1-port-guide-enrichment-report.json');

const BOILERPLATE = [
  /^Handles cruise passengers/i,
  /^Welcomes cruise passengers throughout the year$/i,
  /^Welcomes cruise passengers during summer months$/i,
  /^Growing cruise destination$/i,
  /^Varies by location$/i,
  /^Major metropolitan city$/i,
  /^Major city$/i,
  /^Medium-sized (city|town)$/i,
  /^Small town$/i,
  /^Capital city$/i,
  /^Typical (tropical|mediterranean|oceanic)/i,
  /^Oceanic climate with mild temperatures$/i,
  /^Oceanic climate with mild temperatures year-round$/i,
  /^Located in /i,
];

function isBoilerplate(value) {
  const s = String(value || '').trim();
  if (!s) return true;
  return BOILERPLATE.some((re) => re.test(s));
}

function preferText(existing, next, minLen = 1) {
  const a = typeof existing === 'string' ? existing.trim() : '';
  const b = typeof next === 'string' ? next.trim() : '';
  if (!b) return a;
  if (!a || isBoilerplate(a)) return b;
  if (isBoilerplate(b) && !isBoilerplate(a)) return a;
  // Keep longer destination-specific content
  if (b.length >= a.length || (a.length < minLen && b.length >= minLen)) return b;
  return a;
}

function preferList(existing, next, minItems = 1) {
  const a = Array.isArray(existing) ? existing.filter((x) => String(x || '').trim()) : [];
  const b = Array.isArray(next) ? next.filter((x) => String(x || '').trim()) : [];
  if (!b.length) return a;
  if (b.length >= Math.max(minItems, a.length)) return b;
  if (!a.length) return b;
  return a;
}

function preferNumber(existing, next) {
  if (typeof next === 'number' && Number.isFinite(next) && next > 0) return next;
  if (typeof existing === 'number' && Number.isFinite(existing)) return existing;
  return next == null ? existing ?? null : next;
}

function mergeGuide(existing, patch) {
  const out = JSON.parse(JSON.stringify(existing || {}));
  const sectionsAdded = [];
  const sectionsImproved = [];

  function track(section, before, after) {
    const b = JSON.stringify(before);
    const a = JSON.stringify(after);
    if (b === a) return;
    if (!before || isBoilerplate(typeof before === 'string' ? before : JSON.stringify(before))) {
      sectionsAdded.push(section);
    } else {
      sectionsImproved.push(section);
    }
  }

  if (patch.portInfo) {
    const before = { ...out.portInfo };
    out.portInfo = out.portInfo || {};
    for (const [k, v] of Object.entries(patch.portInfo)) {
      if (typeof v === 'string') out.portInfo[k] = preferText(out.portInfo[k], v, 20);
      else if (v != null) out.portInfo[k] = v;
    }
    track('portInfo', before, out.portInfo);
  }
  if (patch.facts) {
    const before = { ...out.facts };
    out.facts = out.facts || {};
    out.facts.established = preferText(out.facts.established, patch.facts.established, 20);
    out.facts.significance = preferText(out.facts.significance, patch.facts.significance, 20);
    out.facts.notableFeatures = preferList(out.facts.notableFeatures, patch.facts.notableFeatures, 3);
    out.facts.culturalHighlights = preferList(
      out.facts.culturalHighlights,
      patch.facts.culturalHighlights,
      3
    );
    track('facts', before, out.facts);
  }
  if (patch.size) {
    const before = { ...out.size };
    out.size = out.size || {};
    out.size.portCapacity = preferText(out.size.portCapacity, patch.size.portCapacity, 20);
    out.size.annualVisitors = preferText(out.size.annualVisitors, patch.size.annualVisitors, 20);
    out.size.citySize = preferText(out.size.citySize, patch.size.citySize, 15);
    out.size.terminalCount = preferNumber(out.size.terminalCount, patch.size.terminalCount);
    out.size.berthCount = preferNumber(out.size.berthCount, patch.size.berthCount);
    track('size', before, out.size);
  }
  if (patch.climate) {
    const before = { ...out.climate };
    out.climate = out.climate || {};
    for (const k of ['type', 'averageTemp', 'rainySeason', 'humidity', 'description']) {
      if (patch.climate[k] != null) out.climate[k] = preferText(out.climate[k], patch.climate[k], 12);
    }
    out.climate.bestMonths = preferList(out.climate.bestMonths, patch.climate.bestMonths, 3);
    track('climate', before, out.climate);
  }
  if (patch.politics) {
    const before = { ...out.politics };
    out.politics = out.politics || {};
    for (const k of ['governmentType', 'stability', 'visaRequirements', 'entryRequirements']) {
      if (patch.politics[k] != null) out.politics[k] = preferText(out.politics[k], patch.politics[k], 20);
    }
    track('politics', before, out.politics);
  }
  if (patch.gettingThere) {
    const before = { ...out.gettingThere };
    out.gettingThere = out.gettingThere || {};
    for (const k of ['fromTerminal', 'distanceToCity', 'walkingTime', 'taxiInfo', 'publicTransport']) {
      if (patch.gettingThere[k] != null) {
        out.gettingThere[k] = preferText(out.gettingThere[k], patch.gettingThere[k], 20);
      }
    }
    out.gettingThere.transportation = preferList(
      out.gettingThere.transportation,
      patch.gettingThere.transportation,
      3
    );
    track('gettingThere', before, out.gettingThere);
  }
  if (patch.portName) out.portName = preferText(out.portName, patch.portName, 2);
  if (patch.country) out.country = preferText(out.country, patch.country, 2);

  return {
    guide: out,
    sectionsAdded: [...new Set(sectionsAdded)],
    sectionsImproved: [...new Set(sectionsImproved)],
  };
}

function mergeTerminals(existingList, nextList) {
  const existing = Array.isArray(existingList) ? existingList.slice() : [];
  if (!Array.isArray(nextList) || !nextList.length) {
    return { terminals: existing, added: 0, improved: 0 };
  }
  if (!existing.length) return { terminals: nextList, added: nextList.length, improved: 0 };

  const bySlug = new Map(existing.map((t) => [String(t.slug || t.name || '').toLowerCase(), t]));
  let added = 0;
  let improved = 0;
  for (const t of nextList) {
    const key = String(t.slug || t.name || '').toLowerCase();
    if (!bySlug.has(key)) {
      existing.push(t);
      bySlug.set(key, t);
      added += 1;
      continue;
    }
    const cur = bySlug.get(key);
    const merged = { ...cur };
    merged.description = preferText(cur.description, t.description, 30);
    merged.name = preferText(cur.name, t.name, 3);
    merged.facilities = preferList(cur.facilities, t.facilities, 2);
    merged.transport_options = preferList(cur.transport_options, t.transport_options, 2);
    if (t.distance_to_city_center_km != null && cur.distance_to_city_center_km == null) {
      merged.distance_to_city_center_km = t.distance_to_city_center_km;
    }
    if (JSON.stringify(merged) !== JSON.stringify(cur)) {
      improved += 1;
      Object.assign(cur, merged);
    }
  }
  return { terminals: existing, added, improved };
}

/** Destination-specific enrichment patches (sources listed in report). */
const ENRICHMENTS = {
  barcelona: {
    sources: [
      'Port de Barcelona traffic statistics (portdebarcelona.cat) — ~4M cruise passengers in 2025',
      'Port de Barcelona / Moll Adossat cruise pier layout (existing terminal records retained)',
      'Schengen / EU entry general public guidance (conservative wording)',
      'AEMET / Mediterranean climate norms (approximate)',
    ],
    guide: {
      portInfo: {
        description:
          'Barcelona is one of Europe’s busiest cruise homeports and a major Western Mediterranean turnaround city. Most large ships berth on Moll Adossat (Terminals A–D), with a shorter walk from the World Trade Center pier at Port Vell. Shore days typically combine Gothic Quarter lanes, Gaudí landmarks, and the beachfront before returning via the Blue Port shuttle or taxi.',
        location: 'Northeast Spain on the Mediterranean (Catalonia); cruise piers at Port Vell / Moll Adossat',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Spanish and Catalan; English widely used in tourist areas',
        currency: 'Euro (EUR)',
        population: 'City population approximately 1.6 million (municipality)',
      },
      facts: {
        established: 'Roman colony origins; modern commercial port expanded through the 19th–20th centuries',
        significance: 'Leading Western Mediterranean cruise homeport and Catalonia’s principal seaport',
        notableFeatures: [
          'Moll Adossat cruise pier (Terminals A–D)',
          'World Trade Center pier at Port Vell',
          'Gothic Quarter and Las Ramblas within transfer range',
          'Sagrada Família and Gaudí landmarks as common shore excursions',
        ],
        culturalHighlights: [
          'Catalan cuisine and tapas culture',
          'Modernisme architecture (Gaudí)',
          'Beachfront Barceloneta for short port days',
          'Museums and waterfront promenades near Port Vell',
        ],
      },
      size: {
        portCapacity: 'Major Mediterranean cruise homeport with multiple Adossat berths plus Port Vell pier',
        terminalCount: 5,
        berthCount: null,
        annualVisitors: 'Approximately 4 million cruise passengers in 2025 (Port de Barcelona pleasure-cruise statistics)',
        citySize: 'Barcelona municipality ≈ 1.6 million residents; metro area several million',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Roughly 16–18°C (61–64°F) annual average; summers commonly mid-20s °C',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Wettest months typically autumn and winter; summers usually drier',
        humidity: 'Moderate; can feel humid near the waterfront in summer',
        description:
          'Mediterranean climate with warm, relatively dry summers and mild winters. Peak cruise season aligns with spring and early autumn when heat and crowds are usually more manageable than midsummer.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Spain); Catalonia autonomous community',
        stability: 'Generally stable; follow local guidance during any demonstrations',
        visaRequirements:
          'Spain is in the Schengen Area. Many nationalities may enter visa-free for short stays; others need a Schengen visa. Requirements vary by passport—check official Spanish / EU guidance before travel.',
        entryRequirements:
          'Cruise passengers normally clear entry formalities according to their itinerary and nationality. Carry a valid passport (or national ID where accepted for EU/Schengen citizens). Rules can change—verify with official sources and your cruise line.',
      },
      gettingThere: {
        fromTerminal:
          'Large ships usually use Moll Adossat (A–D); some calls use the World Trade Center pier closer to Port Vell',
        transportation: ['Blue Port shuttle', 'Taxi', 'City bus connections', 'Walking from WTC pier'],
        distanceToCity: 'Moll Adossat roughly 3–5 km from central Ramblas / Gothic Quarter; WTC pier under 1 km',
        walkingTime: 'WTC pier: often 10–20 minutes toward Drassanes/Ramblas. Adossat: walking is long—use shuttle/taxi',
        taxiInfo: 'Taxi ranks operate at the cruise piers; confirm fare estimate or meter use before departure',
        publicTransport:
          'Port shuttle links Adossat with the city-side bus hub; metro and buses serve central districts once you leave the pier zone',
      },
    },
    terminals: null, // already rich
    highlights: [
      'Gothic Quarter and Barcelona Cathedral',
      'Sagrada Família (book timed tickets ahead)',
      'Park Güell viewpoints',
      'Barceloneta beach promenade',
      'Boqueria Market and Las Ramblas',
      'Montjuïc cable car / viewpoints on longer calls',
    ],
    overrideSlug: 'barcelona-spain',
  },

  vigo: {
    sources: [
      'Autoridad Portuaria de Vigo (apvigo.es) — Trasatlánticos / Comercio cruise facilities',
      'APVIGO cruise brochure facts (berthing line, maritime station Alberto Durán)',
      'Schengen entry general guidance',
    ],
    guide: {
      portInfo: {
        description:
          'Vigo is Galicia’s principal Atlantic cruise call, with ships docking on the city waterfront at Muelle de Trasatlánticos and, on multi-ship days, Muelle de Comercio. The historic Alberto Durán Maritime Station anchors the main terminals within a short walk of Casco Vello (old town), oyster bars, and the waterfront promenade.',
        location: 'Northwest Spain (Galicia) on the Ría de Vigo',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Spanish and Galician; some English in tourist services',
        currency: 'Euro (EUR)',
        population: 'Municipality roughly 290,000–300,000 residents',
      },
      facts: {
        established: 'Historic Atlantic port; Alberto Durán Maritime Station completed in 1958 and later modernized for cruise operations',
        significance: 'Major Galician cruise gateway and one of Spain’s key Atlantic fishing/commercial ports',
        notableFeatures: [
          'Muelle de Trasatlánticos with Alberto Durán Maritime Station',
          'Cable Gardens (Jardines del Cable) waterfront park',
          'Secondary cruise facility at Muelle de Comercio (El Tinglado)',
          'Walkable access to Casco Vello and A Laxe area',
        ],
        culturalHighlights: [
          'Fresh seafood and oyster street culture',
          'Castro de Vigo viewpoints',
          'Day trips toward Cíes Islands (when ferry schedules allow)',
          'Santiago de Compostela as a longer shore excursion',
        ],
      },
      size: {
        portCapacity:
          'City-center cruise area: Trasatlánticos quay (~60,000 m², ~750 m berthing line per port authority) plus Comercio quay secondary terminal',
        terminalCount: 3,
        berthCount: null,
        annualVisitors: 'Port authority materials cite more than 200,000 cruise visitors annually (verify latest season totals on apvigo.es)',
        citySize: 'Largest city in Galicia; municipality approaching 300,000 residents',
      },
      climate: {
        type: 'Oceanic (Atlantic)',
        averageTemp: 'Mild year-round; summers often mid-teens to low-20s °C, winters cool and damp',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Rain possible year-round; autumn and winter typically wetter',
        humidity: 'Often moderate to high due to Atlantic exposure',
        description:
          'Atlantic oceanic climate—pack layers even in summer. Cruise season is busiest late spring through early autumn when daylight and outdoor dining are most pleasant.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Spain); Galicia autonomous community',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area rules apply. Visa needs depend on nationality—confirm with official Spanish / EU sources before travel.',
        entryRequirements:
          'Valid passport required for most non-EU travelers; EU/EEA/Swiss citizens may use a national ID card where accepted. Always follow your cruise line’s embarkation document list.',
      },
      gettingThere: {
        fromTerminal:
          'Primary calls use Muelle de Trasatlánticos / Alberto Durán Maritime Station; overflow or multi-ship days may use Muelle de Comercio (El Tinglado)',
        transportation: ['Walking', 'Taxi', 'City bus', 'Train station ~15 min walk (per port authority)'],
        distanceToCity: 'Waterfront terminals sit beside the historic center—typically a few hundred meters to Casco Vello',
        walkingTime: 'Often 5–15 minutes uphill into the old town and commercial streets',
        taxiInfo: 'Taxis available at the maritime station area for Cíes ferry connections, Samil, or longer trips',
        publicTransport:
          'City buses serve the waterfront; Vigo-Urzáiz train station is about a 15-minute walk according to the port authority; airport roughly 15 minutes by car',
      },
    },
    terminals: [
      {
        name: 'Vigo Cruise Terminal (Trasatlánticos / Alberto Durán)',
        slug: 'vigo-cruise-terminal-trasatlanticos',
        description:
          'Main cruise facilities inside the historic Alberto Durán Maritime Station on Muelle de Trasatlánticos; city-center waterfront with tourist information and passenger services.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: [
          'check-in / passenger processing',
          'immigration & customs support',
          'tourist information',
          'Wi-Fi',
          'retail / catering nearby (A Laxe)',
        ],
        distance_to_city_center_km: 0.4,
        transport_options: ['walking to Casco Vello', 'taxi', 'city bus', 'train station ~15 min walk'],
        is_primary: true,
        sort_order: 10,
        country_id: 'spain',
      },
      {
        name: 'Atlantic Vigo Cruise Terminal',
        slug: 'atlantic-vigo-cruise-terminal',
        description:
          'Concessioned cruise terminal at the Trasatlánticos complex, operating alongside Vigo Cruise Terminal for embarkation, transit, and turnaround calls.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger processing', 'security screening', 'baggage handling'],
        distance_to_city_center_km: 0.4,
        transport_options: ['walking', 'taxi', 'city bus'],
        is_primary: false,
        sort_order: 20,
        country_id: 'spain',
      },
      {
        name: 'El Tinglado del Puerto (Muelle de Comercio)',
        slug: 'el-tinglado-muelle-comercio',
        description:
          'Secondary cruise terminal on Comercio Quay used especially on multi-ship days; modern open passenger hall near Plaza de Compostela park.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger hall', 'direct ship access', 'security'],
        distance_to_city_center_km: 0.6,
        transport_options: ['walking', 'taxi', 'city bus'],
        is_primary: false,
        sort_order: 30,
        country_id: 'spain',
      },
    ],
    highlights: [
      'Casco Vello (old town) streets and viewpoints',
      'Oyster bars and Galician seafood',
      'Castro de Vigo hill fortress views',
      'Cíes Islands ferry day trip (schedule-dependent)',
      'Santiago de Compostela excursion on longer calls',
      'Waterfront Cable Gardens and A Laxe area',
    ],
    overrideSlug: 'vigo-spain',
  },

  miami: {
    sources: [
      'Miami-Dade PortMiami official cruise pages (miamidade.gov/portmiami)',
      'PortMiami FY2025 passenger total 8,564,151 / 8,564,225 (county releases)',
      'PortMiami cruise terminal directory (Terminals AA, A–F)',
    ],
    guide: {
      portInfo: {
        description:
          'PortMiami brands itself the Cruise Capital of the World® and is the primary U.S. embarkation hub for Caribbean and Bahamas itineraries. Multiple modern terminals line Dodge Island, connected to mainland Miami via the PortMiami Tunnel and MacArthur Causeway. Expect airline-style check-in halls, on-port parking, and heavy turnaround traffic on weekends.',
        location: 'Dodge Island, Biscayne Bay, Miami, Florida, USA',
        timezone: 'Eastern Time (UTC−5 / UTC−4 DST)',
        language: 'English; Spanish widely spoken',
        currency: 'US Dollar (USD)',
        population: 'City of Miami roughly 450,000; metro area several million',
      },
      facts: {
        established: 'Modern cruise complex on Dodge Island expanded through late 20th and early 21st centuries',
        significance: 'World’s busiest cruise embarkation port by passenger volume in recent fiscal years',
        notableFeatures: [
          'Multiple dedicated cruise terminals (including AA, A, B, C, D–F)',
          'PortMiami Tunnel road access',
          'On-port parking at terminal garages',
          'Close to Miami International Airport (MIA) and downtown hotels',
        ],
        culturalHighlights: [
          'Downtown Miami / Brickell pre-cruise stays',
          'South Beach Art Deco District',
          'Wynwood and Design District on longer layovers',
          'Biscayne Bay waterfront dining',
        ],
      },
      size: {
        portCapacity: 'Multi-terminal homeport complex on Dodge Island serving the world’s largest cruise brands',
        terminalCount: 7,
        berthCount: null,
        annualVisitors: '8,564,151 cruise passengers in FY2025 (Miami-Dade PortMiami official historical snapshot)',
        citySize: 'City of Miami ~0.45 million; Miami metro multi-million',
      },
      climate: {
        type: 'Tropical monsoon / tropical savanna edge',
        averageTemp: 'Warm year-round; winter highs often low-to-mid 20s °C (70s °F), summers hotter and humid',
        bestMonths: ['November', 'December', 'January', 'February', 'March', 'April'],
        rainySeason: 'Wet season roughly May–October with afternoon storms; Atlantic hurricane season June–November',
        humidity: 'High, especially in summer',
        description:
          'Year-round cruise climate. Winter and early spring are usually the most comfortable for embarkation days; summer brings heat, humidity, and storm risk—monitor National Hurricane Center guidance in season.',
      },
      politics: {
        governmentType: 'Federal presidential republic (United States); State of Florida',
        stability: 'Stable',
        visaRequirements:
          'Entry to the United States depends on nationality (ESTA/VWP, visa, or other status). Confirm with official U.S. CBP / State Department guidance and your cruise line—do not rely on informal summaries.',
        entryRequirements:
          'For U.S. closed-loop Caribbean cruises, document rules can differ from international fly-cruise itineraries. Bring the exact ID/passport documents your cruise line lists for your sailing.',
      },
      gettingThere: {
        fromTerminal:
          'Ships are assigned a lettered PortMiami terminal (e.g., AA, A, B, C, D–F)—confirm your terminal on cruise documents before driving or rideshare drop-off',
        transportation: ['Taxi / rideshare', 'Hotel shuttle', 'Rental car', 'Limited public transit + transfer'],
        distanceToCity: 'Roughly 3–5 km to downtown Miami / Brickell depending on terminal and route',
        walkingTime: 'Not practical between mainland hotels and terminals—use vehicle access',
        taxiInfo: 'Rideshare and taxi drop-off zones serve each terminal; allow extra time on weekend turnarounds',
        publicTransport:
          'Most guests use private transfer, taxi, or hotel shuttle from MIA or downtown; plan buffer for tunnel/causeway traffic',
      },
    },
    terminals: [
      {
        name: 'PortMiami Cruise Terminal AA',
        slug: 'portmiami-terminal-aa',
        description:
          'MSC Cruises’ Terminal AA (opened 2025): large multi-level facility designed to handle very high passenger volumes, including multi-ship operations.',
        terminal_type: 'homeport',
        terminal_status: 'active',
        facilities: ['large check-in halls', 'security screening', 'seating', 'baggage handling'],
        distance_to_city_center_km: 4.5,
        transport_options: ['taxi / rideshare', 'on-port parking', 'hotel shuttle'],
        is_primary: false,
        sort_order: 5,
        country_id: 'united-states',
      },
      {
        name: 'PortMiami Cruise Terminal E',
        slug: 'portmiami-terminal-e',
        description:
          'Carnival Cruise Line terminal complex (with D and F) on PortMiami; expanded to handle larger ships.',
        terminal_type: 'homeport',
        terminal_status: 'active',
        facilities: ['check-in', 'security', 'baggage', 'seating'],
        distance_to_city_center_km: 4.2,
        transport_options: ['taxi / rideshare', 'on-port parking'],
        is_primary: false,
        sort_order: 45,
        country_id: 'united-states',
      },
    ],
    highlights: [
      'South Beach and Ocean Drive (pre/post cruise)',
      'Brickell / downtown waterfront dining',
      'Wynwood street art on longer layovers',
      'Bayside Marketplace area',
      'Everglades or Key Biscayne excursions when time allows',
      'Miami International Airport (MIA) connections for fly-cruises',
    ],
    overrideSlug: 'miami-fl-united-states',
  },

  civitavecchia: {
    sources: [
      'Port Mobility Civitavecchia / Roma Cruise Terminal (civitavecchia.portmobility.it)',
      'Roma Cruise Terminal public passenger guidance',
      'Trenitalia regional services Rome–Civitavecchia (general)',
    ],
    guide: {
      portInfo: {
        description:
          'Civitavecchia is Rome’s principal cruise gateway. Roma Cruise Terminal manages multiple passenger facilities (including Amerigo Vespucci and Donato Bramante). Free port shuttles typically link piers with the Largo della Pace service area; Rome itself is about an hour away by regional train plus local transfer.',
        location: 'Lazio coast, about 70 km northwest of central Rome, Italy',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Italian; English common at terminals and tourist services',
        currency: 'Euro (EUR)',
        population: 'Civitavecchia town roughly 50,000; Rome metro destination for most guests',
      },
      facts: {
        established: 'Ancient Roman port roots; modern cruise terminals developed under Roma Cruise Terminal concession',
        significance: 'Italy’s busiest cruise port and the primary sea gateway for Rome itineraries',
        notableFeatures: [
          'Amerigo Vespucci Terminal (~12,500 m²)',
          'Donato Bramante Terminal (Pier 12)',
          'Largo della Pace passenger service hub',
          'Free pier shuttle network inside the port',
        ],
        culturalHighlights: [
          'Rome day trips (Colosseum, Vatican, historic center)',
          'Civitavecchia old fortress and waterfront if remaining in town',
          'Coastal Lazio excursions on longer calls',
        ],
      },
      size: {
        portCapacity: 'Multi-terminal Roma Cruise Terminal complex with several dedicated cruise piers',
        terminalCount: 5,
        berthCount: null,
        annualVisitors: 'Hundreds of cruise calls per year (exact passenger totals vary by season—check port/RCT publications)',
        citySize: 'Gateway town ~50,000; most shore time spent in Rome (~2.8M city)',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; summer highs often upper 20s–low 30s °C in Rome/coastal Lazio',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'More rain in autumn/winter; summers usually drier',
        humidity: 'Moderate; summer heat can be intense inland in Rome',
        description:
          'Mediterranean pattern. Spring and early autumn are popular for Rome shore excursions; midsummer heat and queues at major sights require earlier starts and hydration.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Italy)',
        stability: 'Generally stable',
        visaRequirements:
          'Italy is in the Schengen Area. Visa requirements depend on nationality—verify via official Italian / EU channels.',
        entryRequirements:
          'Valid passport (or permitted national ID for eligible EU citizens). Cruise excursions to Rome do not change passport rules—carry required ID ashore.',
      },
      gettingThere: {
        fromTerminal:
          'Ships berth at RCT piers; free shuttle buses commonly run between docks and Largo della Pace. Confirm your terminal (e.g., Vespucci, Bramante) on arrival day signage.',
        transportation: [
          'Free port shuttle',
          'Regional train to Rome',
          'Taxi',
          'CSP / local bus station–port links',
          'Cruise shore excursions',
        ],
        distanceToCity:
          'Civitavecchia center is near the port; central Rome is roughly 70 km / about 60–90 minutes by train plus local transfer',
        walkingTime:
          'Train station is about 1–1.5 km from port approaches—many guests use bus/taxi rather than walking with luggage',
        taxiInfo: 'Taxis available for station or Rome transfers; agree approach/fare expectations for longer Rome trips',
        publicTransport:
          'Frequent Trenitalia regional trains link Civitavecchia with Roma Termini and other Rome stations; local buses and a seasonal direct station–ship service may operate on turnaround days',
      },
    },
    terminals: [
      {
        name: 'Terminal Donato Bramante (Pier 12)',
        slug: 'terminal-donato-bramante',
        description:
          'Modern Roma Cruise Terminal facility on Pier 12 near the Vespucci complex; opened to expand Civitavecchia passenger capacity.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['check-in', 'security', 'seating', 'passenger services'],
        distance_to_city_center_km: 1.5,
        transport_options: ['free port shuttle to Largo della Pace', 'taxi', 'station transfer'],
        is_primary: false,
        sort_order: 15,
        country_id: 'italy',
      },
    ],
    highlights: [
      'Colosseum and Roman Forum (book timed entry)',
      'Vatican Museums / St. Peter’s (long queues—plan ahead)',
      'Trevi Fountain and historic center stroll',
      'Stay-in-port option: Civitavecchia fortress and waterfront',
      'Ostia Antica on some independent itineraries',
    ],
    overrideSlug: 'civitavecchia-italy',
  },

  southampton: {
    sources: [
      'Associated British Ports (ABP) Southampton cruise terminal directory',
      'Visit Southampton cruise passenger information (Eastern vs Western Docks)',
    ],
    guide: {
      portInfo: {
        description:
          'Southampton is the United Kingdom’s leading cruise turnaround port, with ABP terminals in the Eastern Docks (Ocean, QEII) and Western Docks (City, Horizon, Mayflower). London is reachable by rail for pre- and post-cruise stays, while the city center is close enough for short embarkation-day errands once you know your dock gate.',
        location: 'South coast of England, Hampshire, United Kingdom',
        timezone: 'GMT (UTC+0) / BST (UTC+1)',
        language: 'English',
        currency: 'Pound sterling (GBP)',
        population: 'Southampton roughly 250,000+; London is the main tourist draw for many guests',
      },
      facts: {
        established: 'Historic passenger port; modern ABP cruise terminals serve year-round turnarounds',
        significance: 'UK’s premier cruise homeport for Atlantic, Mediterranean, and Northern Europe itineraries',
        notableFeatures: [
          'Ocean Cruise Terminal (Eastern Docks)',
          'QEII Cruise Terminal (Eastern Docks)',
          'City, Horizon, and Mayflower terminals (Western Docks)',
          'Rail links toward London Waterloo',
        ],
        culturalHighlights: [
          'Ocean Village and waterfront dining',
          'SeaCity Museum / Titanic history exhibits',
          'New Forest or Isle of Wight day trips on longer stays',
          'London pre-cruise sightseeing',
        ],
      },
      size: {
        portCapacity: 'Five ABP cruise terminals across Eastern and Western Docks',
        terminalCount: 5,
        berthCount: null,
        annualVisitors: 'Major UK homeport volumes (exact annual totals published by ABP/VisitBritain vary by year)',
        citySize: 'Southampton unitary authority ~0.25–0.3 million residents',
      },
      climate: {
        type: 'Oceanic (temperate maritime)',
        averageTemp: 'Mild; summer highs often high teens °C, winters cool and damp',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Rain possible any month; pack a waterproof layer',
        humidity: 'Moderate',
        description:
          'Temperate maritime climate. Summer provides the longest daylight for embarkation travel; shoulder seasons are still active for cruising but can be wet and windy.',
      },
      politics: {
        governmentType: 'Constitutional monarchy / parliamentary democracy (United Kingdom)',
        stability: 'Stable',
        visaRequirements:
          'UK entry rules depend on nationality (visa, ETA, or other schemes). Check official GOV.UK guidance for your passport—requirements changed in recent years for many visitors.',
        entryRequirements:
          'Bring the passport/ID documents listed by your cruise line for UK embarkation or transit. Airlines and cruise lines may enforce document checks before you reach the terminal.',
      },
      gettingThere: {
        fromTerminal:
          'Eastern Docks (Ocean / QEII via Dock Gate 4) vs Western Docks (City / Horizon / Mayflower via Dock Gate 10)—confirm berth on your cruise documents',
        transportation: ['Taxi', 'Cruise line transfer', 'Rail + taxi', 'Car / parking'],
        distanceToCity: 'Western Docks terminals are close to city-center hotels; Eastern Docks are a short drive/taxi from central Southampton',
        walkingTime: 'Possible between some city hotels and Western Docks with light bags; not ideal with full luggage',
        taxiInfo: 'Taxis and prebooked transfers are the usual airport/station solution; allow buffer for dock security queues',
        publicTransport:
          'Southampton Central station connects to London and regional rail; complete the last mile by taxi or scheduled cruise transfer to your specific terminal',
      },
    },
    terminals: [
      {
        name: 'QEII Cruise Terminal',
        slug: 'qeii-cruise-terminal',
        description:
          'Eastern Docks cruise terminal (berths commonly referenced as 38/39). Access via Dock Gate 4; further along the docks from Ocean Cruise Terminal.',
        terminal_type: 'homeport',
        terminal_status: 'active',
        facilities: ['check-in hall', 'security', 'baggage', 'seating'],
        distance_to_city_center_km: 3.5,
        transport_options: ['taxi', 'cruise transfer', 'car via Dock Gate 4'],
        is_primary: false,
        sort_order: 25,
        country_id: 'united-kingdom',
      },
    ],
    highlights: [
      'SeaCity Museum and maritime heritage',
      'Ocean Village waterfront',
      'London day trip via rail (pre/post cruise)',
      'New Forest villages on longer stays',
      'West Quay shopping before embarkation',
    ],
    overrideSlug: 'southampton-united-kingdom',
  },

  dubrovnik: {
    sources: [
      'Port of Dubrovnik passenger information (portdubrovnik.hr) — Gruž to Old City',
      'Libertas public bus guidance summarized on port site',
    ],
    guide: {
      portInfo: {
        description:
          'Dubrovnik cruise ships use Port Gruž, about a 30–40 minute walk or short bus/taxi ride from the UNESCO-listed Old City. Most guests transfer to Pile Gate for the Stradun and city walls; tendering can occur when the harbor is congested.',
        location: 'Southern Dalmatia, Croatia, on the Adriatic',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Croatian; English widely spoken in tourism',
        currency: 'Euro (EUR)',
        population: 'City roughly 40,000–45,000 residents',
      },
      facts: {
        established: 'Historic maritime republic (Ragusa); modern cruise operations centered on Gruž harbor',
        significance: 'One of the Adriatic’s signature cruise destinations and a UNESCO World Heritage old town',
        notableFeatures: [
          'Port Gruž cruise piers and passenger area',
          'Pile Gate access to the Old City',
          'City Walls circuit',
          'Lokrum Island boat trips',
        ],
        culturalHighlights: [
          'Stradun limestone promenade',
          'City Walls and fortresses',
          'Cable car viewpoint above the Old City',
          'Dalmatian seafood and konoba dining',
        ],
      },
      size: {
        portCapacity: 'Deep-water berths at Gruž with passenger terminal facilities; overflow may tender',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'Major Adriatic call volumes (seasonal peaks in summer—check Port of Dubrovnik for current season stats)',
        citySize: 'Compact historic city of roughly forty thousand residents',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Hot summers (often upper 20s–30s °C); mild winters',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'More rain in cooler months; summers usually dry and hot',
        humidity: 'Moderate; summer heat amplified on stone streets',
        description:
          'Classic Adriatic Mediterranean climate. Midsummer brings intense heat and heavy cruise congestion in the Old City—early starts and wall tickets help.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Croatia); EU member',
        stability: 'Generally stable',
        visaRequirements:
          'Croatia applies Schengen rules. Visa needs vary by nationality—confirm via official Croatian / EU sources.',
        entryRequirements:
          'Valid passport or permitted national ID. Carry ID ashore; follow any local crowd-management guidance in the Old City.',
      },
      gettingThere: {
        fromTerminal: 'Most ships dock at Port Gruž (northwest of the Old City); some calls tender to the same harbor area',
        transportation: ['Libertas city bus', 'Taxi', 'Cruise shuttle', 'Walking (long)'],
        distanceToCity: 'Approximately 3 km from Gruž to Pile Gate / Old City',
        walkingTime: 'About 30–40 minutes along the coastal road; limited shade in summer',
        taxiInfo: 'Taxi ranks outside the port; short ride to Pile Gate—confirm fare approach before departure',
        publicTransport:
          'Libertas buses (commonly lines serving Pile) run frequently; tickets are cheaper from kiosks than onboard per port guidance',
      },
    },
    terminals: [
      {
        name: 'Port of Dubrovnik — Gruž Cruise Port',
        slug: 'gruz-cruise-port',
        description:
          'Main Dubrovnik cruise harbor in Gruž with passenger facilities, taxi ranks, and bus access toward Pile Gate and the Old City.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminal area', 'taxi rank', 'tour desks', 'bus stops nearby'],
        distance_to_city_center_km: 3.0,
        transport_options: ['Libertas bus to Pile', 'taxi', 'cruise shuttle', 'walking ~30–40 min'],
        is_primary: true,
        sort_order: 10,
        country_id: 'croatia',
      },
    ],
    highlights: [
      'Walk the City Walls (buy tickets early)',
      'Stradun and Old City squares',
      'Cable car viewpoint',
      'Lokrum Island boat trip',
      'Buža-style cliff bars (seasonal)',
      'Trsteno Arboretum on longer calls',
    ],
    overrideSlug: 'dubrovnik-croatia',
  },

  marseille: {
    sources: [
      'Marseille Fos / Marseille Provence Cruise Terminal passenger guidance (secondary summaries cross-checked)',
      'Visit/port shuttle descriptions for MPCT ↔ Terrasses du Port / Joliette',
    ],
    guide: {
      portInfo: {
        description:
          'Marseille handles large ships primarily at Marseille Provence Cruise Terminal (MPCT / Môle Léon Gourret), several kilometres from the Vieux-Port, while smaller vessels may use La Joliette closer to the waterfront. A port shuttle is the usual first link from MPCT toward Joliette shopping/metro connections.',
        location: 'Southern France, Bouches-du-Rhône, on the Mediterranean',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'French; English in tourist zones',
        currency: 'Euro (EUR)',
        population: 'City roughly 870,000; metro area over 1.5 million',
      },
      facts: {
        established: 'Ancient Greek founding (Massalia); modern cruise terminals within Grand Port Maritime de Marseille-Fos',
        significance: 'France’s leading Mediterranean cruise port and major Provençal gateway',
        notableFeatures: [
          'Marseille Provence Cruise Terminal (MPCT)',
          'La Joliette / J4 berths for smaller ships',
          'Vieux-Port historic harbor',
          'Notre-Dame de la Garde basilica skyline',
        ],
        culturalHighlights: [
          'Vieux-Port and Le Panier quarter',
          'MuCEM and waterfront museums',
          'Bouillabaisse and Provençal markets',
          'Day trips to Aix-en-Provence or Calanques (time permitting)',
        ],
      },
      size: {
        portCapacity: 'Large-ship MPCT complex plus nearer-in Joliette berths for smaller vessels',
        terminalCount: 2,
        berthCount: null,
        annualVisitors: 'Among the Mediterranean’s higher-volume French cruise ports (confirm current-year GPMM figures)',
        citySize: 'Marseille ≈ 0.87 million residents within city limits',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; hot, dry summers often mid-to-upper 20s °C or higher',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'More rain in autumn/winter; Mistral winds can occur',
        humidity: 'Generally moderate',
        description:
          'Sunny Mediterranean climate. Summer is peak cruise season but can be very hot for uphill walks to Notre-Dame de la Garde—carry water.',
      },
      politics: {
        governmentType: 'Semi-presidential republic (France)',
        stability: 'Generally stable',
        visaRequirements:
          'France is in the Schengen Area. Visa requirements vary by nationality—check official French / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Standard Schengen short-stay considerations apply for many visitors.',
      },
      gettingThere: {
        fromTerminal:
          'Confirm whether you are at MPCT (large ships) or Joliette. MPCT sits in a secured port zone—do not plan to walk through industrial areas.',
        transportation: ['Port shuttle', 'Taxi / rideshare', 'Metro (after reaching Joliette)', 'Cruise shuttle'],
        distanceToCity: 'MPCT roughly 7–10 km from Vieux-Port; Joliette much closer (~1–2 km)',
        walkingTime: 'Joliette to Vieux-Port often 20–30 minutes. MPCT walking is not practical/permitted through the port',
        taxiInfo: 'Direct taxis from MPCT to Vieux-Port are the fastest door-to-door option when queues are long',
        publicTransport:
          'Free or scheduled port shuttles commonly link MPCT toward Terrasses du Port / Joliette, then metro line M2 toward the Vieux-Port area',
      },
    },
    terminals: [
      {
        name: 'Marseille Provence Cruise Terminal (MPCT)',
        slug: 'marseille-provence-cruise-terminal',
        description:
          'Primary large-ship cruise complex at Môle Léon Gourret in the commercial port zone north of the city center; use shuttle or taxi to reach Vieux-Port.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminals', 'security', 'coach parking', 'shuttle pickup'],
        distance_to_city_center_km: 8,
        transport_options: ['port shuttle', 'taxi', 'cruise shuttle'],
        is_primary: true,
        sort_order: 10,
        country_id: 'france',
      },
      {
        name: 'La Joliette Cruise Berths (J4 area)',
        slug: 'la-joliette-cruise-berths',
        description:
          'Closer-in berths used mainly by smaller and mid-size ships near the Joliette waterfront redevelopment, with shorter transfers to Vieux-Port.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger access', 'taxi', 'nearby tram/metro connections'],
        distance_to_city_center_km: 1.5,
        transport_options: ['walking', 'taxi', 'tram/metro'],
        is_primary: false,
        sort_order: 20,
        country_id: 'france',
      },
    ],
    highlights: [
      'Vieux-Port and morning fish market',
      'Notre-Dame de la Garde basilica',
      'Le Panier historic quarter',
      'MuCEM waterfront museum',
      'Château d’If boat trip',
      'Aix-en-Provence day trip on long calls',
    ],
    overrideSlug: 'marseille-france',
  },

  genua: {
    sources: [
      'Port of Genoa / Stazioni Marittime passenger terminal public descriptions',
      'City transport links Ponte dei Mille / Andrea Doria area',
    ],
    guide: {
      portInfo: {
        description:
          'Genoa (Genova) is a major Ligurian cruise and ferry hub. Cruise ships typically use the historic Stazioni Marittime area (Ponte dei Mille / nearby piers) within walking distance of the Porto Antico waterfront aquarium district and the steep medieval centro storico.',
        location: 'Liguria, northwest Italy, on the Ligurian Sea',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Italian; English in tourist areas',
        currency: 'Euro (EUR)',
        population: 'City roughly 550,000–600,000',
      },
      facts: {
        established: 'Historic maritime republic; modern passenger terminals at the old port',
        significance: 'Key northern Italian cruise call and ferry gateway for Liguria and beyond',
        notableFeatures: [
          'Stazioni Marittime cruise/ferry complex',
          'Porto Antico waterfront',
          'Aquarium of Genoa',
          'Via Garibaldi UNESCO palaces',
        ],
        culturalHighlights: [
          'Centro storico alleyways (caruggi)',
          'Pesto and focaccia food culture',
          'Palazzi dei Rolli museums',
          'Scenic viewpoints above the port',
        ],
      },
      size: {
        portCapacity: 'Central passenger terminals serving cruise and ferry traffic at the old port',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'Significant Ligurian cruise volumes (confirm latest Port of Genoa statistics)',
        citySize: 'Genoa ≈ 0.55–0.6 million residents',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; warm summers moderated by the sea',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Autumn can be wet; summer usually drier',
        humidity: 'Moderate',
        description:
          'Mediterranean coastal climate. Steep streets mean comfortable shoes matter as much as the weather forecast.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Italy)',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area. Requirements depend on nationality—verify official Italian / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Keep documents handy for terminal security re-entry.',
      },
      gettingThere: {
        fromTerminal: 'Cruise passengers normally use Stazioni Marittime / Ponte dei Mille area berths beside Porto Antico',
        transportation: ['Walking', 'Taxi', 'Local bus/metro elevators', 'Train station connections'],
        distanceToCity: 'Old port terminals are adjacent to Porto Antico and a short walk to the medieval center',
        walkingTime: 'Often 5–20 minutes to aquarium/waterfront; longer uphill into historic lanes',
        taxiInfo: 'Taxis available for hill neighborhoods, Nervi, or Cinque Terre connections when time allows',
        publicTransport:
          'Genova Piazza Principe station is the main rail hub for Milan/Rome connections; local transit includes buses and vertical lifts/funiculars',
      },
    },
    terminals: [
      {
        name: 'Stazioni Marittime — Ponte dei Mille',
        slug: 'stazioni-marittime-ponte-dei-mille',
        description:
          'Historic Genoa passenger terminal complex used by cruise and ferry traffic beside the Porto Antico waterfront.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger halls', 'check-in', 'security', 'taxi access', 'retail nearby'],
        distance_to_city_center_km: 0.8,
        transport_options: ['walking to Porto Antico', 'taxi', 'bus', 'rail via Piazza Principe'],
        is_primary: true,
        sort_order: 10,
        country_id: 'italy',
      },
    ],
    highlights: [
      'Aquarium of Genoa / Porto Antico',
      'Centro storico caruggi walk',
      'Via Garibaldi museums',
      'Belvedere Castelletto viewpoint',
      'Focaccia tasting stops',
      'Cinque Terre or Portofino only on long calls with reliable timing',
    ],
    overrideSlug: 'genoa-italy',
  },

  piraeus: {
    sources: [
      'Piraeus cruise terminal public facility descriptions (Terminal A Miaoulis)',
      'Athens Urban Rail / metro links from Piraeus area (general passenger guidance)',
    ],
    guide: {
      portInfo: {
        description:
          'Piraeus is the cruise port for Athens. Ships use dedicated cruise terminals (commonly referenced as Terminal A / Miaoulis and additional berths). The Acropolis sits roughly 10–13 km away—plan metro, bus, taxi, or organized excursions rather than walking.',
        location: 'Saronic Gulf, southwest of central Athens, Greece',
        timezone: 'EET (UTC+2) / EEST (UTC+3)',
        language: 'Greek; English widely used in tourism',
        currency: 'Euro (EUR)',
        population: 'Piraeus municipality ~160,000; Athens metro multi-million',
      },
      facts: {
        established: 'Ancient harbor of Athens; modern cruise terminals on the passenger port',
        significance: 'Eastern Mediterranean cruise hub and gateway to classical Athens',
        notableFeatures: [
          'Miaoulis (Terminal A) main cruise terminal',
          'Additional cruise berths with internal shuttle links',
          'Metro connections toward central Athens',
          'Ferry complex for Greek islands (separate from cruise gates)',
        ],
        culturalHighlights: [
          'Acropolis and Acropolis Museum',
          'Plaka and Monastiraki',
          'Ancient Agora',
          'Piraeus waterfront if remaining near port',
        ],
      },
      size: {
        portCapacity: 'Multi-berth cruise passenger zone within the Port of Piraeus',
        terminalCount: 2,
        berthCount: null,
        annualVisitors: 'One of the Mediterranean’s major cruise gateways (see PPA seasonal statistics for exact totals)',
        citySize: 'Gateway to Athens metro area (several million)',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Hot, dry summers; mild winters',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Mostly November–March; summers typically dry',
        humidity: 'Low to moderate in summer heat',
        description:
          'Hot summers make midday Acropolis climbs demanding—go early, carry water, and respect site heat closures when announced.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Greece)',
        stability: 'Generally stable',
        visaRequirements:
          'Greece is in the Schengen Area. Visa needs depend on nationality—confirm via official Greek / EU sources.',
        entryRequirements:
          'Valid passport or permitted national ID. Keep documents for terminal re-entry and any site security checks.',
      },
      gettingThere: {
        fromTerminal:
          'Note your berth (Terminal A vs further piers). Internal free shuttles often link outer berths to the main terminal area.',
        transportation: ['Metro', 'Taxi / rideshare', 'Bus', 'Organized shore excursion'],
        distanceToCity: 'Roughly 10–13 km to the Acropolis / central Athens',
        walkingTime: 'Metro stations are a substantial walk from cruise gates—factor 20+ minutes plus ride time',
        taxiInfo: 'Taxis are the simplest timed option to the Acropolis; agree destination clearly',
        publicTransport:
          'Metro lines from the Piraeus area reach central Athens (e.g., toward Monastiraki/Syntagma depending on routing); buy validated tickets before boarding',
      },
    },
    terminals: [
      {
        name: 'Piraeus Cruise Terminal A (Miaoulis)',
        slug: 'piraeus-terminal-a-miaoulis',
        description:
          'Main Piraeus cruise passenger terminal with check-in halls, border control support, and coach parking; shuttle links to farther quays.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['check-in', 'immigration desks', 'Wi-Fi', 'cafe/retail', 'taxi rank', 'coach parking'],
        distance_to_city_center_km: 12,
        transport_options: ['metro (after walk/transfer)', 'taxi', 'bus', 'port shuttle between berths'],
        is_primary: true,
        sort_order: 10,
        country_id: 'greece',
      },
      {
        name: 'Piraeus Cruise Terminal B / outer berths',
        slug: 'piraeus-terminal-b',
        description:
          'Additional cruise berths within the passenger port; guests often use free internal shuttles toward Terminal A before leaving the port zone.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['gangway access', 'shuttle to main terminal', 'security'],
        distance_to_city_center_km: 13,
        transport_options: ['port shuttle to Terminal A', 'taxi', 'organized tours'],
        is_primary: false,
        sort_order: 20,
        country_id: 'greece',
      },
    ],
    highlights: [
      'Acropolis (timed tickets strongly recommended)',
      'Acropolis Museum',
      'Plaka neighborhood stroll',
      'Ancient Agora',
      'Monastiraki flea market area',
      'Piraeus waterfront lunch if skipping central Athens',
    ],
    overrideSlug: 'piraeus-greece',
  },

  copenhagen: {
    sources: [
      'Wonderful Copenhagen / CMP cruise terminal pages (Oceankaj, Langelinie, Nordre Toldbod)',
      'Visit Copenhagen terminal transport guidance',
    ],
    guide: {
      portInfo: {
        description:
          'Copenhagen offers three CMP cruise areas: Oceankaj (Ocean Quay) for many large ships, plus Langelinie and Nordre Toldbod closer to the classic waterfront. Terminal choice changes your transfer: Oceankaj pairs with metro/bus links, while Langelinie puts you near the Little Mermaid promenade.',
        location: 'Zealand, Denmark, on the Øresund',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Danish; English widely spoken',
        currency: 'Danish krone (DKK); cards widely accepted',
        population: 'City roughly 650,000; capital region ~1.3 million+',
      },
      facts: {
        established: 'Historic harbor city; modern cruise quays operated with Copenhagen Malmö Port (CMP)',
        significance: 'Leading Northern European turnaround and Baltic itinerary hub',
        notableFeatures: [
          'Oceankaj (Ocean Quay) large-ship terminals',
          'Langelinie Pier',
          'Nordre Toldbod quay',
          'Metro M4 connections toward the city',
        ],
        culturalHighlights: [
          'Nyhavn waterfront',
          'Tivoli Gardens (seasonal)',
          'Christiansborg and royal sights',
          'Free-spirited neighborhoods like Vesterbro/Nørrebro',
        ],
      },
      size: {
        portCapacity: 'Three cruise quay areas (Oceankaj, Langelinie, Nordre Toldbod) with multiple berths',
        terminalCount: 3,
        berthCount: null,
        annualVisitors: 'Major Baltic cruise volumes (see CMP / Wonderful Copenhagen season reports)',
        citySize: 'Copenhagen municipality ~0.65 million',
      },
      climate: {
        type: 'Oceanic',
        averageTemp: 'Cool summers (often high teens °C); cold, dark winters',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Rain possible year-round; pack layers and a waterproof',
        humidity: 'Moderate',
        description:
          'Long summer daylight favors shore days. Peak cruise season is late spring through early autumn; winter calls are fewer and daylight is short.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Denmark)',
        stability: 'Highly stable',
        visaRequirements:
          'Denmark is in the Schengen Area. Visa requirements vary by nationality—check official Danish / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Standard Schengen short-stay considerations apply for many visitors.',
      },
      gettingThere: {
        fromTerminal:
          'Confirm Oceankaj vs Langelinie vs Nordre Toldbod on your cruise documents—transfer times differ substantially',
        transportation: ['Metro', 'Bus', 'Taxi / rideshare', 'Bicycle (city)', 'Hop-on hop-off (seasonal)'],
        distanceToCity:
          'Approx. distances published for planning: Nordre Toldbod ~3 km, Langelinie ~4 km, Oceankaj ~8 km to city center',
        walkingTime: 'Langelinie/Nordre Toldbod can be walkable for energetic guests; Oceankaj is a transit ride',
        taxiInfo: 'Taxis available; Oceankaj–center fares are higher—public transport is usually straightforward',
        publicTransport:
          'Oceankaj commonly pairs bus links with Metro M4 (Orientkaj). Use Rejseplanen for real-time combinations to Tivoli, Nørreport, or the airport',
      },
    },
    terminals: [
      {
        name: 'Oceankaj (Ocean Quay)',
        slug: 'oceankaj',
        description:
          'Large-ship cruise complex in Nordhavn with modern passenger facilities; about 8 km from the historic center per destination materials.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminals', 'security', 'coach parking', 'taxi'],
        distance_to_city_center_km: 8,
        transport_options: ['bus + metro M4', 'taxi', 'cruise shuttle'],
        is_primary: true,
        sort_order: 10,
        country_id: 'denmark',
      },
      {
        name: 'Langelinie Pier',
        slug: 'langelinie-pier',
        description:
          'Classic Copenhagen cruise pier near the Langelinie promenade and Little Mermaid area; roughly 4 km from the city center.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger access', 'promenade', 'taxi', 'tour buses'],
        distance_to_city_center_km: 4,
        transport_options: ['walking', 'bus', 'taxi', 'hop-on hop-off'],
        is_primary: false,
        sort_order: 20,
        country_id: 'denmark',
      },
      {
        name: 'Nordre Toldbod',
        slug: 'nordre-toldbod',
        description:
          'Inner-harbor cruise quay closest to central waterfront districts; about 3 km to the city center per destination materials.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger access', 'taxi', 'nearby waterfront walks'],
        distance_to_city_center_km: 3,
        transport_options: ['walking', 'bus', 'metro connections', 'taxi'],
        is_primary: false,
        sort_order: 30,
        country_id: 'denmark',
      },
    ],
    highlights: [
      'Nyhavn harbor front',
      'Tivoli Gardens (seasonal hours)',
      'Little Mermaid / Langelinie promenade',
      'Christiansborg and canal district',
      'Torvehallerne food halls',
      'Christiania visit only if time and interest allow',
    ],
    overrideSlug: 'copenhagen-denmark',
  },

  amsterdam: {
    sources: [
      'Port of Amsterdam passenger / cruise berth public information',
      'City transport (GVB) general guidance for Passenger Terminal Amsterdam area',
    ],
    guide: {
      portInfo: {
        description:
          'Amsterdam cruise calls commonly use Passenger Terminal Amsterdam (PTA) on the IJ waterfront east of Centraal Station, with some ships using alternative berths or the IJmuiden sea lock complex on certain itineraries. From PTA, trams, metro, ferries, and taxis connect quickly into the historic canal belt.',
        location: 'North Holland, Netherlands, on the IJ inlet',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Dutch; English extremely widely spoken',
        currency: 'Euro (EUR)',
        population: 'City roughly 900,000; metro area well over 2 million',
      },
      facts: {
        established: 'Historic entrepôt of the Dutch Golden Age; modern PTA opened on the former docklands',
        significance: 'Major Northern European cultural cruise destination and turnaround option',
        notableFeatures: [
          'Passenger Terminal Amsterdam (PTA)',
          'IJ waterfront opposite freighters and ferries',
          'Centraal Station transport hub nearby',
          'UNESCO canal ring within tram/metro range',
        ],
        culturalHighlights: [
          'Canal belt walking/cycling',
          'Rijksmuseum and Museumplein',
          'Anne Frank House (advance tickets essential)',
          'Jordaan neighborhood cafés',
        ],
      },
      size: {
        portCapacity: 'PTA plus additional regional berthing options depending on ship size and itinerary',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'High-profile Northern Europe call (city policies and seasonal caps can affect volumes—check Port of Amsterdam updates)',
        citySize: 'Amsterdam ≈ 0.9 million residents',
      },
      climate: {
        type: 'Oceanic',
        averageTemp: 'Mild summers; cool winters; frequent clouds',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Rain possible any month—carry a light waterproof',
        humidity: 'Moderate to high',
        description:
          'Maritime climate with changeable showers. Summer brings long evenings ideal for canal walks after museum visits.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Netherlands)',
        stability: 'Highly stable',
        visaRequirements:
          'Netherlands is in the Schengen Area. Visa requirements vary by nationality—verify official Dutch / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Some attractions require separate timed tickets unrelated to immigration.',
      },
      gettingThere: {
        fromTerminal:
          'Most downtown calls use Passenger Terminal Amsterdam (PTA). Confirm if your ship instead uses an outlying berth such as IJmuiden.',
        transportation: ['Tram', 'Metro', 'Ferry', 'Taxi', 'Bicycle rental', 'Walking'],
        distanceToCity: 'PTA is roughly 2–3 km east of Centraal / historic core',
        walkingTime: 'About 25–40 minutes to Centraal area; trams are faster in wet weather',
        taxiInfo: 'Taxis available at PTA; trams are usually sufficient for the center',
        publicTransport:
          'GVB trams/metro connect PTA toward Centraal and Museumplein; free GVB ferries cross the IJ for north-shore neighborhoods',
      },
    },
    terminals: [
      {
        name: 'Passenger Terminal Amsterdam (PTA)',
        slug: 'passenger-terminal-amsterdam',
        description:
          'Modern IJ waterfront cruise terminal east of Amsterdam Centraal with passenger halls and direct city transit connections.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['check-in halls', 'security', 'taxi rank', 'tram access', 'retail nearby'],
        distance_to_city_center_km: 2.5,
        transport_options: ['tram', 'metro', 'taxi', 'walking', 'ferry'],
        is_primary: true,
        sort_order: 10,
        country_id: 'netherlands',
      },
    ],
    highlights: [
      'Canal belt walking loop',
      'Rijksmuseum / Van Gogh Museum (timed tickets)',
      'Anne Frank House (book far ahead)',
      'Jordaan cafés and courtyards',
      'Dam Square and Royal Palace exterior',
      'Ferry across the IJ for A’DAM Lookout',
    ],
    overrideSlug: 'amsterdam-netherlands',
  },

  naples: {
    sources: [
      'Port of Naples passenger terminal public information (Stazione Marittima / Molo Angioino area)',
      'Circumvesuviana / transfer notes for Pompeii (general)',
    ],
    guide: {
      portInfo: {
        description:
          'Naples cruise ships normally berth at the central Stazione Marittima / Molo Angioino complex on the waterfront, within walking distance of the historic center and ferry quays for Capri and Ischia. Pompeii and the Amalfi Coast are popular longer excursions requiring trains, coaches, or organized tours.',
        location: 'Campania, southern Italy, on the Bay of Naples',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Italian; English in tourist services',
        currency: 'Euro (EUR)',
        population: 'City roughly 900,000+',
      },
      facts: {
        established: 'Ancient Greek/Roman port city; modern passenger terminal on the central waterfront',
        significance: 'Southern Italy’s major cruise gateway for Pompeii, Capri, and the Amalfi Coast',
        notableFeatures: [
          'Stazione Marittima cruise/ferry complex',
          'Walkable centro storico and Piazza del Plebiscito',
          'Ferry connections to Capri/Ischia',
          'Rail links toward Pompeii',
        ],
        culturalHighlights: [
          'Naples pizza and street food',
          'Spaccanapoli historic spine',
          'National Archaeological Museum',
          'Views of Vesuvius across the bay',
        ],
      },
      size: {
        portCapacity: 'Central passenger terminal complex handling cruise and ferry traffic',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'Major Tyrrhenian cruise volumes (see Port of Naples seasonal reports)',
        citySize: 'Naples ≈ 0.9 million+ residents',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; hot summers often upper 20s–30s °C',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'More rain in autumn/winter',
        humidity: 'Moderate to high in summer',
        description:
          'Warm Mediterranean climate. Summer shore days to Pompeii need sun protection and an early start.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Italy)',
        stability: 'Generally stable; use normal big-city awareness',
        visaRequirements:
          'Schengen Area. Requirements vary by nationality—check official Italian / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Keep valuables secure in crowded historic streets and station areas.',
      },
      gettingThere: {
        fromTerminal: 'Central cruise berths at Stazione Marittima / Molo Angioino on the downtown waterfront',
        transportation: ['Walking', 'Taxi', 'Metro/bus', 'Circumvesuviana / rail for Pompeii', 'Ferry'],
        distanceToCity: 'Terminal sits beside the historic center and ferry port',
        walkingTime: 'Often 10–25 minutes to Piazza del Plebiscito / centro storico edges',
        taxiInfo: 'Taxis for Pompeii or coast trips—use official ranks and confirm destination',
        publicTransport:
          'City metro/buses serve the center; trains toward Pompeii require a station transfer—allow generous buffers for return to ship',
      },
    },
    terminals: [
      {
        name: 'Stazione Marittima di Napoli (Molo Angioino)',
        slug: 'stazione-marittima-napoli',
        description:
          'Central Naples passenger terminal used by cruise and ferry traffic on the downtown waterfront near Piazza Municipio.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger halls', 'check-in', 'security', 'taxi rank', 'ferry connections nearby'],
        distance_to_city_center_km: 0.7,
        transport_options: ['walking', 'taxi', 'metro/bus', 'ferry to islands'],
        is_primary: true,
        sort_order: 10,
        country_id: 'italy',
      },
    ],
    highlights: [
      'Centro storico and Spaccanapoli',
      'Naples pizza lunch',
      'Pompeii archaeological park (timed transport)',
      'Capri ferry day trip on long calls',
      'National Archaeological Museum',
      'Castel dell’Ovo waterfront',
    ],
    overrideSlug: 'naples-italy',
  },

  palma: {
    sources: [
      'Autoritat Portuària de Balears / Palma cruise pier public information',
      'Palma tourism transport notes (cathedral / historic center access)',
    ],
    guide: {
      portInfo: {
        description:
          'Palma de Mallorca is the Balearic Islands’ primary cruise hub. Ships berth along the commercial waterfront with shuttle or taxi links to the cathedral (La Seu), old town lanes, and Passeig del Born. Many Western Mediterranean itineraries use Palma as both a call and a turnaround.',
        location: 'Mallorca, Balearic Islands, Spain',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Spanish and Catalan; English widely spoken in tourism',
        currency: 'Euro (EUR)',
        population: 'Palma roughly 400,000+',
      },
      facts: {
        established: 'Historic harbor city; modern cruise piers west/southwest of the historic core',
        significance: 'Main Balearic cruise gateway and major Western Mediterranean turnaround port',
        notableFeatures: [
          'Multiple cruise berths on Palma’s commercial quays',
          'Cathedral of Santa Maria (La Seu)',
          'Historic center and Arab Quarter lanes',
          'Bellver Castle hill viewpoint',
        ],
        culturalHighlights: [
          'Gothic cathedral and palace quarter',
          'Tapas and seafood along the waterfront',
          'Modernisme architecture in the center',
          'Beach clubs or island interior tours on longer calls',
        ],
      },
      size: {
        portCapacity: 'Multi-berth cruise waterfront capable of handling simultaneous large-ship calls',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'One of Spain’s busier island cruise ports (see Port Authority of the Balearic Islands stats)',
        citySize: 'Palma ≈ 0.4 million residents',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; hot summers often upper 20s–30s °C',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'More rain in autumn/winter; summers dry',
        humidity: 'Moderate',
        description:
          'Classic Mediterranean island climate. Peak summer is hot and busy; shoulder seasons are excellent for old-town walking.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Spain); Balearic Islands autonomy',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area. Visa needs depend on nationality—confirm official Spanish / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Follow cruise-line document lists for turnaround embarkations.',
      },
      gettingThere: {
        fromTerminal: 'Cruise ships use Palma’s commercial cruise quays; shuttle buses often run toward the cathedral / city center on busy days',
        transportation: ['Shuttle', 'Taxi', 'City bus', 'Walking from nearer berths'],
        distanceToCity: 'Typically a few kilometres along the waterfront to La Seu / old town, depending on berth',
        walkingTime: 'Possible from some berths in 30–50 minutes; many guests prefer shuttle/taxi in heat',
        taxiInfo: 'Abundant taxis at the cruise area for cathedral drop-off or island tours',
        publicTransport:
          'City buses link the port zone with central Palma; Palma Airport (PMI) is the usual fly-cruise gateway',
      },
    },
    terminals: [
      {
        name: 'Palma Cruise Quays (Port of Palma)',
        slug: 'palma-cruise-quays',
        description:
          'Primary cruise berthing area in Palma’s commercial port with passenger processing and shuttle/taxi access toward the historic center and cathedral.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminals', 'security', 'taxi', 'coach parking', 'shuttles'],
        distance_to_city_center_km: 3.5,
        transport_options: ['shuttle', 'taxi', 'city bus', 'walking from nearer berths'],
        is_primary: true,
        sort_order: 10,
        country_id: 'spain',
      },
    ],
    highlights: [
      'Cathedral of Santa Maria (La Seu)',
      'Old town lanes and Arab Baths',
      'Passeig del Born shopping/cafés',
      'Bellver Castle viewpoint',
      'Local tapas and ensaimada tasting',
      'Valldemossa or Serra de Tramuntana on longer calls',
    ],
    overrideSlug: 'palma-spain',
  },

  valencia: {
    sources: [
      'Valenciaport cruise terminal public information',
      'City transport links toward historic center / City of Arts and Sciences',
    ],
    guide: {
      portInfo: {
        description:
          'Valencia’s cruise terminal sits in the commercial port with shuttle or taxi links to the historic center (Cathedral, Central Market) and the futuristic City of Arts and Sciences. The beach districts of Malvarrosa/Cabanyal are additional shore-day options.',
        location: 'Eastern Spain on the Mediterranean (Valencian Community)',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Spanish and Valencian; English in tourist areas',
        currency: 'Euro (EUR)',
        population: 'City roughly 800,000; metro area over 1.5 million',
      },
      facts: {
        established: 'Historic Mediterranean trading port; modern cruise terminal within Valenciaport',
        significance: 'Major Spanish Mediterranean cruise call and growing turnaround option',
        notableFeatures: [
          'Valenciaport cruise terminal complex',
          'Historic center and Central Market',
          'City of Arts and Sciences',
          'Mediterranean beachfront districts',
        ],
        culturalHighlights: [
          'Paella traditions',
          'Gothic cathedral and Lonja',
          'Turia Gardens park ribbon',
          'Falling walls of the old riverbed promenade',
        ],
      },
      size: {
        portCapacity: 'Dedicated cruise terminal facilities within one of Spain’s largest commercial ports',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'Over 500,000 cruise passengers in recent strong seasons (confirm latest Valenciaport report)',
        citySize: 'Third-largest city in Spain ≈ 0.8 million',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; hot summers',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Occasional heavy autumn rains; summers usually dry',
        humidity: 'Moderate',
        description:
          'Sunny Mediterranean climate favorable for beach and city combination days outside peak midsummer heat.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Spain)',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area. Requirements vary by nationality—check official Spanish / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID for eligible travelers.',
      },
      gettingThere: {
        fromTerminal: 'Cruise terminal is inside the port zone; shuttles or taxis are the usual first step toward downtown',
        transportation: ['Shuttle', 'Taxi', 'Bus', 'Metro/tram after reaching city network'],
        distanceToCity: 'Roughly 5–8 km to the historic center depending on routing',
        walkingTime: 'Not practical from the terminal gates through the commercial port',
        taxiInfo: 'Taxis available for Cathedral / City of Arts drop-offs',
        publicTransport:
          'Port shuttle plus city buses/metro connect toward Xàtiva, Colón, and beach lines—allow return buffer',
      },
    },
    terminals: [
      {
        name: 'Valenciaport Cruise Terminal',
        slug: 'valenciaport-cruise-terminal',
        description:
          'Dedicated cruise passenger terminal within Valenciaport with check-in facilities and coach/taxi access toward the city.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminal', 'security', 'taxi', 'coach parking'],
        distance_to_city_center_km: 6,
        transport_options: ['shuttle', 'taxi', 'bus'],
        is_primary: true,
        sort_order: 10,
        country_id: 'spain',
      },
    ],
    highlights: [
      'Central Market and Lonja',
      'Valencia Cathedral / Holy Grail chapel visit',
      'City of Arts and Sciences',
      'Turia Gardens bike or walk',
      'Paella lunch',
      'Malvarrosa beach time on hot days',
    ],
    overrideSlug: 'valencia-spain',
  },

  malaga: {
    sources: [
      'Málaga Port cruise terminal public information',
      'City center walking distances from Muelle Uno / cruise piers',
    ],
    guide: {
      portInfo: {
        description:
          'Málaga is a walkable Costa del Sol cruise call for many ships berthing near Muelle Uno and the central passenger terminals. The Alcazaba, cathedral, and Picasso Museum sit within a short taxi or energetic walk, with day trips to Granada possible on longer calls.',
        location: 'Andalusia, southern Spain, on the Costa del Sol',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Spanish; English widely spoken in tourism',
        currency: 'Euro (EUR)',
        population: 'City roughly 570,000+',
      },
      facts: {
        established: 'Phoenician/Roman roots; modern cruise piers beside the revitalized waterfront',
        significance: 'Key Andalusian cruise gateway for the Costa del Sol and Granada excursions',
        notableFeatures: [
          'Central cruise terminals beside Muelle Uno',
          'Alcazaba fortress',
          'Málaga Cathedral',
          'Picasso Museum',
        ],
        culturalHighlights: [
          'Andalusian tapas culture',
          'Historic center lanes',
          'Waterfront promenade and shopping',
          'Gibralfaro viewpoint',
        ],
      },
      size: {
        portCapacity: 'Central passenger cruise facilities capable of handling large contemporary ships',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'Major Costa del Sol cruise volumes (see Málaga Port Authority season stats)',
        citySize: 'Málaga ≈ 0.57 million residents',
      },
      climate: {
        type: 'Mediterranean',
        averageTemp: 'Mild winters; hot summers',
        bestMonths: ['March', 'April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Limited; mainly cooler months',
        humidity: 'Moderate',
        description:
          'One of Spain’s milder winter climates. Summer is excellent for waterfront walks but hot for uphill Alcazaba climbs at midday.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Spain); Andalusia autonomy',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area. Requirements vary by nationality—confirm official Spanish / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID.',
      },
      gettingThere: {
        fromTerminal: 'Most cruise berths are on the downtown waterfront near Muelle Uno / passenger terminals',
        transportation: ['Walking', 'Taxi', 'City bus', 'Train for longer trips'],
        distanceToCity: 'Often under 1–2 km to the historic center from central berths',
        walkingTime: 'Frequently 10–25 minutes to cathedral / Atarazanas area from central piers',
        taxiInfo: 'Short taxi hops useful for Gibralfaro or travelers with mobility limits',
        publicTransport:
          'Local buses cover hill neighborhoods; María Zambrano station connects for Granada/ Córdoba day trips with tight timing',
      },
    },
    terminals: [
      {
        name: 'Málaga Cruise Terminal / Muelle Uno area',
        slug: 'malaga-cruise-terminal',
        description:
          'Central Málaga cruise passenger facilities beside the Muelle Uno waterfront retail promenade, close to the historic center.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminal', 'security', 'taxi', 'retail promenade nearby'],
        distance_to_city_center_km: 1.2,
        transport_options: ['walking', 'taxi', 'city bus'],
        is_primary: true,
        sort_order: 10,
        country_id: 'spain',
      },
    ],
    highlights: [
      'Alcazaba and Roman theatre',
      'Málaga Cathedral',
      'Picasso Museum',
      'Muelle Uno waterfront',
      'Gibralfaro castle views',
      'Granada / Alhambra only on long, well-timed calls',
    ],
    overrideSlug: 'malaga-spain',
  },

  cozumel: {
    sources: [
      'API Quintana Roo / Cozumel cruise pier public passenger information',
      'Mexico tourism / immigration general public guidance (conservative)',
    ],
    guide: {
      portInfo: {
        description:
          'Cozumel is a western Caribbean staple known for reefs, beach clubs, and short downtown walks from the International Pier / Puerta Maya area. Many ships tender or use specific piers—check your daily program. San Miguel’s waterfront is the usual independent shopping and dining zone.',
        location: 'Cozumel Island, Quintana Roo, Mexico (Caribbean)',
        timezone: 'Eastern Time (UTC−5 year-round in Quintana Roo)',
        language: 'Spanish; English widely spoken in tourist zones',
        currency: 'Mexican peso (MXN); USD often accepted in tourist areas',
        population: 'Island population roughly 80,000–100,000',
      },
      facts: {
        established: 'Historic Maya coastal links; modern cruise piers south of San Miguel',
        significance: 'One of the Caribbean’s highest-volume western itinerary ports',
        notableFeatures: [
          'Puerta Maya and International cruise piers',
          'San Miguel waterfront',
          'Cozumel reef marine park snorkeling/diving',
          'Beach clubs along the west coast',
        ],
        culturalHighlights: [
          'Fresh seafood and Mexican coastal cuisine',
          'San Gervasio Maya ruins inland',
          'Waterfront promenade shopping',
          'East-coast wild beaches on island tours',
        ],
      },
      size: {
        portCapacity: 'Multiple cruise piers handling frequent multi-ship days',
        terminalCount: 2,
        berthCount: null,
        annualVisitors: 'Among Mexico’s busiest cruise islands (see APIQROO seasonal statistics)',
        citySize: 'San Miguel / island population under 100,000',
      },
      climate: {
        type: 'Tropical',
        averageTemp: 'Warm to hot year-round; highs often upper 20s–low 30s °C',
        bestMonths: ['December', 'January', 'February', 'March', 'April'],
        rainySeason: 'Wet season roughly May–October; Atlantic hurricane season June–November',
        humidity: 'High',
        description:
          'Tropical Caribbean climate. Dry season is peak cruising weather; summer brings heat, humidity, and storm risk.',
      },
      politics: {
        governmentType: 'Federal republic (Mexico)',
        stability: 'Generally stable for tourism zones; follow local and cruise-line guidance',
        visaRequirements:
          'Many nationalities receive a tourist permit/FMM process on arrival or via airline—requirements vary. Confirm with official Mexican immigration guidance and your cruise line.',
        entryRequirements:
          'Valid passport required for most visitors. Closed-loop U.S. cruise document rules may differ—follow your cruise line’s checklist exactly.',
      },
      gettingThere: {
        fromTerminal:
          'Ships use designated Cozumel cruise piers (e.g., Puerta Maya / International Pier area) or tender when required—follow ship instructions',
        transportation: ['Walking (near downtown piers)', 'Taxi', 'Beach-club shuttle', 'Rental scooter/car'],
        distanceToCity: 'Often 2–5 km to central San Miguel depending on pier',
        walkingTime: 'Possible from some pier zones along the waterfront; hot and exposed',
        taxiInfo: 'Fixed-rate taxi island tours and beach-club drops are common—agree destination and rate first',
        publicTransport:
          'Limited urban transit for visitors; most independents use walking near downtown or taxis for beaches/ruins',
      },
    },
    terminals: [
      {
        name: 'Puerta Maya Cruise Pier',
        slug: 'puerta-maya-cruise-pier',
        description:
          'Major Cozumel cruise pier complex with passenger facilities, retail, and taxi/tour access toward San Miguel and beach clubs.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger buildings', 'retail', 'taxi', 'tour desks'],
        distance_to_city_center_km: 4,
        transport_options: ['taxi', 'walking (long/hot)', 'tour shuttles'],
        is_primary: true,
        sort_order: 10,
        country_id: 'mexico',
      },
      {
        name: 'International Pier (Cozumel)',
        slug: 'international-pier-cozumel',
        description:
          'Additional Cozumel cruise pier used on multi-ship days with similar passenger amenities and taxi access.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger access', 'retail', 'taxi'],
        distance_to_city_center_km: 3.5,
        transport_options: ['taxi', 'walking', 'tour shuttles'],
        is_primary: false,
        sort_order: 20,
        country_id: 'mexico',
      },
    ],
    highlights: [
      'Snorkeling or diving on Cozumel reefs',
      'West-coast beach clubs',
      'San Miguel waterfront stroll',
      'San Gervasio ruins',
      'Fresh seafood lunch',
      'East-coast scenic drive on island taxi tours',
    ],
    overrideSlug: 'cozumel-mexico',
  },

  nassau: {
    sources: [
      'Nassau Cruise Port / downtown pier redevelopment public passenger information',
      'Bahamas tourism transport notes (Junkanoo beach / downtown)',
    ],
    guide: {
      portInfo: {
        description:
          'Nassau is the Bahamas’ capital cruise call, with ships docking at the downtown Nassau Cruise Port complex steps from Bay Street shopping and a short hop to Junkanoo Beach. Atlantis on Paradise Island remains a popular paid excursion for longer stays.',
        location: 'New Providence Island, Bahamas',
        timezone: 'Eastern Time (UTC−5 / UTC−4 DST)',
        language: 'English',
        currency: 'Bahamian dollar (BSD) pegged 1:1 with USD; USD widely accepted',
        population: 'New Providence / Nassau area roughly 250,000+',
      },
      facts: {
        established: 'Historic British colonial harbor; modern downtown cruise port redevelopment',
        significance: 'Primary Bahamas cruise gateway for short Caribbean itineraries from Florida',
        notableFeatures: [
          'Nassau Cruise Port downtown berths',
          'Bay Street shopping corridor',
          'Junkanoo Beach nearby',
          'Paradise Island / Atlantis excursions',
        ],
        culturalHighlights: [
          'Bahamian cuisine and conch dishes',
          'Straw Market crafts',
          'Queen’s Staircase and Fort Fincastle area',
          'Downtown colonial architecture',
        ],
      },
      size: {
        portCapacity: 'Multi-berth downtown cruise port capable of handling several large ships',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'One of the Caribbean’s highest-frequency ports (see Nassau Cruise Port / tourism stats)',
        citySize: 'Nassau / New Providence roughly a quarter million residents',
      },
      climate: {
        type: 'Tropical',
        averageTemp: 'Warm year-round; winter highs often mid-20s °C, summers hotter',
        bestMonths: ['December', 'January', 'February', 'March', 'April'],
        rainySeason: 'Wetter summer months; Atlantic hurricane season June–November',
        humidity: 'High',
        description:
          'Tropical maritime climate ideal for beach time in winter/spring; monitor storm forecasts in summer/autumn.',
      },
      politics: {
        governmentType: 'Parliamentary constitutional monarchy (Bahamas)',
        stability: 'Generally stable in tourist zones',
        visaRequirements:
          'Entry rules depend on nationality. Many visitors receive a short-stay landing permission—confirm with official Bahamas immigration guidance and your cruise line.',
        entryRequirements:
          'Valid passport required for most travelers. Follow cruise-line closed-loop vs fly-cruise document instructions carefully.',
      },
      gettingThere: {
        fromTerminal: 'Downtown Nassau Cruise Port berths open directly toward Bay Street and the waterfront',
        transportation: ['Walking', 'Taxi', 'Jitney bus', 'Water taxi to Paradise Island'],
        distanceToCity: 'Immediate downtown access from the cruise port complex',
        walkingTime: 'Often 5–15 minutes to Bay Street shops and 10–20 minutes toward Junkanoo Beach',
        taxiInfo: 'Taxis for Atlantis/Paradise Island or island tours—agree rates before departure',
        publicTransport:
          'Walking covers most downtown sights; jitneys serve local routes; water taxis link Paradise Island',
      },
    },
    terminals: [
      {
        name: 'Nassau Cruise Port',
        slug: 'nassau-cruise-port',
        description:
          'Downtown multi-berth cruise port complex with passenger amenities opening onto Bay Street and the historic harbor front.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['passenger terminals', 'retail', 'security', 'taxi', 'waterfront access'],
        distance_to_city_center_km: 0.3,
        transport_options: ['walking', 'taxi', 'jitney', 'water taxi'],
        is_primary: true,
        sort_order: 10,
        country_id: 'bahamas',
      },
    ],
    highlights: [
      'Junkanoo Beach swim time',
      'Bay Street and Straw Market',
      'Queen’s Staircase / Fort Fincastle',
      'Paradise Island / Atlantis excursion',
      'Local conch lunch',
      'Downtown colonial photo stops',
    ],
    overrideSlug: 'nassau-bahamas',
  },

  santorini: {
    sources: [
      'Santorini / Athinios port tendering public guidance for cruise calls',
      'Cable car / donkey / stair options from Old Port (Skala) to Fira',
    ],
    guide: {
      portInfo: {
        description:
          'Santorini is primarily a tender port: ships anchor in the caldera and boats run to the Old Port (Skala) below Fira, with some calls using Athinios for coaches. From Skala, guests reach Fira by cable car, donkey, or the steep stairs—queues form quickly on multi-ship days.',
        location: 'Cyclades, Greece, in the Aegean Sea',
        timezone: 'EET (UTC+2) / EEST (UTC+3)',
        language: 'Greek; English widely spoken in tourism',
        currency: 'Euro (EUR)',
        population: 'Island roughly 15,000 permanent residents',
      },
      facts: {
        established: 'Volcanic island shaped by the Minoan-era eruption; modern tourism centered on caldera towns',
        significance: 'Iconic Aegean cruise call known for caldera views, whitewashed villages, and sunsets',
        notableFeatures: [
          'Tender landing at Old Port (Skala)',
          'Cable car to Fira',
          'Athinios commercial port for some coach operations',
          'Oia and Fira caldera viewpoints',
        ],
        culturalHighlights: [
          'Caldera-edge walking paths',
          'Local wines and tomato products',
          'Akrotiri archaeological site',
          'Black/red beach stops on island tours',
        ],
      },
      size: {
        portCapacity: 'Tender-based cruise operations at the caldera; limited alongside commercial capacity at Athinios',
        terminalCount: 1,
        berthCount: 0,
        annualVisitors: 'Over a million cruise passengers in busy recent seasons (island tourism reports vary by year)',
        citySize: 'Island population around 15,000',
      },
      climate: {
        type: 'Mediterranean / semi-arid Aegean',
        averageTemp: 'Warm, dry summers; mild winters',
        bestMonths: ['April', 'May', 'June', 'September', 'October'],
        rainySeason: 'Limited; winters wetter than summers',
        humidity: 'Low to moderate; strong meltemi winds possible in summer',
        description:
          'Dry, sunny summers with strong sun exposure on whitewashed paths. Shoulder seasons reduce tender queues and heat.',
      },
      politics: {
        governmentType: 'Parliamentary republic (Greece)',
        stability: 'Generally stable',
        visaRequirements:
          'Schengen Area. Requirements vary by nationality—check official Greek / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Allow extra time for tender lines back to the ship.',
      },
      gettingThere: {
        fromTerminal:
          'Most cruise guests tender to the Old Port beneath Fira; some shore excursions use Athinios coach transfers instead',
        transportation: ['Tender boat', 'Cable car', 'Donkey (optional)', 'Stairs', 'Taxi / ATV after reaching clifftop'],
        distanceToCity: 'Vertical ascent from Old Port to Fira; Oia is a further island transfer',
        walkingTime: 'Stairs from Old Port to Fira are steep and strenuous (hundreds of steps)',
        taxiInfo: 'Taxis and buses operate from Fira once you reach the clifftop',
        publicTransport:
          'Cable car is the main bottleneck—budget queue time. Local buses link Fira with Oia and other villages',
      },
    },
    terminals: [
      {
        name: 'Santorini Old Port (Skala) tender landing',
        slug: 'santorini-old-port-skala',
        description:
          'Primary tender landing beneath Fira for cruise ships anchored in the caldera; cable car, stairs, and donkey options ascend to town.',
        terminal_type: 'transit',
        terminal_status: 'active',
        facilities: ['tender quay', 'cable car access', 'kiosks', 'queue management'],
        distance_to_city_center_km: 0.5,
        transport_options: ['cable car', 'stairs', 'donkey', 'excursion coaches via Athinios on some tours'],
        is_primary: true,
        sort_order: 10,
        country_id: 'greece',
      },
    ],
    highlights: [
      'Fira caldera walk',
      'Oia viewpoints (watch return timing)',
      'Cable car ride from Old Port',
      'Akrotiri ruins',
      'Local wine tasting',
      'Santo Wines or cliffside lunch with views',
    ],
    overrideSlug: 'santorini-greece',
  },

  bergen: {
    sources: [
      'Port of Bergen cruise / Skolten–Bontelabo public passenger information',
      'Visit Bergen Bryggen walking guidance',
    ],
    guide: {
      portInfo: {
        description:
          'Bergen is Norway’s classic fjord-cruise gateway. Ships typically berth near Skolten / downtown harbor within walking distance of Bryggen’s wooden wharf district, the fish market, and the Fløibanen funicular. Weather changes quickly—pack layers even in summer.',
        location: 'Vestland county, western Norway',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Norwegian; English widely spoken',
        currency: 'Norwegian krone (NOK)',
        population: 'City roughly 280,000+',
      },
      facts: {
        established: 'Historic Hanseatic trading city; Bryggen is UNESCO-listed',
        significance: 'Primary gateway for Norwegian fjord cruise itineraries',
        notableFeatures: [
          'Downtown cruise berths near Skolten',
          'Bryggen wharf district',
          'Fløibanen funicular',
          'Fish market waterfront',
        ],
        culturalHighlights: [
          'Hanseatic Museum area',
          'Seafood dining',
          'Mount Fløyen viewpoints',
          'Day trips into Sognefjord / Norway in a Nutshell-style routes on long calls',
        ],
      },
      size: {
        portCapacity: 'Multiple downtown/near-downtown cruise berths serving large contemporary ships',
        terminalCount: 1,
        berthCount: null,
        annualVisitors: 'One of Norway’s busiest cruise cities (see Port of Bergen season statistics)',
        citySize: 'Bergen ≈ 0.28 million residents',
      },
      climate: {
        type: 'Oceanic (very wet)',
        averageTemp: 'Cool summers (often mid-teens °C); mild but damp winters for the latitude',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Frequent rain year-round—Bergen is famously wet',
        humidity: 'High',
        description:
          'Expect rain any day. Summer offers the best chance of clearer fjord views and long daylight for Fløyen walks.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Norway)',
        stability: 'Highly stable',
        visaRequirements:
          'Norway is in the Schengen Area. Visa requirements vary by nationality—check official Norwegian / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Carry layers and a waterproof regardless of the morning forecast.',
      },
      gettingThere: {
        fromTerminal: 'Most cruise ships dock within walking distance of Bryggen / downtown harbor berths (e.g., Skolten area)',
        transportation: ['Walking', 'Taxi', 'Local bus', 'Funicular (Fløibanen)', 'Light rail connections in city'],
        distanceToCity: 'Often under 1 km to Bryggen and the fish market from central berths',
        walkingTime: 'Frequently 5–20 minutes to Bryggen depending on exact berth',
        taxiInfo: 'Useful for hillside hotels or travelers avoiding wet walks',
        publicTransport:
          'City buses and Bybanen light rail serve wider Bergen; Fløibanen is the key tourist ascent from downtown',
      },
    },
    terminals: [
      {
        name: 'Bergen Cruise Berths (Skolten / downtown harbor)',
        slug: 'bergen-skolten-cruise-berths',
        description:
          'Primary downtown Bergen cruise berthing area near Skolten with short walks to Bryggen, the fish market, and Fløibanen.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger access', 'taxi', 'tourist information nearby', 'coach pickup'],
        distance_to_city_center_km: 0.6,
        transport_options: ['walking', 'taxi', 'bus', 'Fløibanen'],
        is_primary: true,
        sort_order: 10,
        country_id: 'norway',
      },
    ],
    highlights: [
      'Bryggen wooden wharf district',
      'Fløibanen to Mount Fløyen',
      'Fish market tasting',
      'Hanseatic Museum area',
      'Kodde / harbor walk in any weather with waterproofs',
      'Fjord excursion only with reliable all-aboard timing',
    ],
    overrideSlug: 'bergen-norway',
  },

  stockholm: {
    sources: [
      'Ports of Stockholm cruise terminal pages (Stadsgården, Värtahamnen, Frihamnen)',
      'SL public transport connections from cruise areas',
    ],
    guide: {
      portInfo: {
        description:
          'Stockholm cruise ships use several Ports of Stockholm areas—commonly Stadsgården (close to Gamla Stan/Slussen) or Värtahamnen/Frihamnen farther northeast. Confirm your terminal: walking into Gamla Stan is realistic from Stadsgården, while Värtan calls usually need bus, taxi, or metro connections.',
        location: 'Eastern Sweden on Lake Mälaren / Baltic approaches',
        timezone: 'CET (UTC+1) / CEST (UTC+2)',
        language: 'Swedish; English widely spoken',
        currency: 'Swedish krona (SEK)',
        population: 'City roughly 1 million; metro area ~2.4 million',
      },
      facts: {
        established: 'Historic Baltic capital; modern cruise terminals across multiple inner-city harbors',
        significance: 'Premier Baltic cruise capital and common overnight/turnaround port',
        notableFeatures: [
          'Stadsgården cruise quay',
          'Värtahamnen / Frihamnen terminals',
          'Gamla Stan old town',
          'Archipelago boat trips',
        ],
        culturalHighlights: [
          'Gamla Stan lanes and Royal Palace exteriors',
          'Vasa Museum on Djurgården',
          'ABBA Museum / Skansen on longer calls',
          'Waterfront promenades and fika culture',
        ],
      },
      size: {
        portCapacity: 'Multiple cruise terminals across Ports of Stockholm harbors',
        terminalCount: 3,
        berthCount: null,
        annualVisitors: 'Leading Baltic cruise destination volumes (see Ports of Stockholm season reports)',
        citySize: 'Stockholm municipality ≈ 1 million residents',
      },
      climate: {
        type: 'Humid continental / oceanic transition',
        averageTemp: 'Mild summers; cold winters with short daylight',
        bestMonths: ['May', 'June', 'July', 'August', 'September'],
        rainySeason: 'Showers possible in summer; winter brings cold and possible snow',
        humidity: 'Moderate',
        description:
          'Peak cruise season is summer with long daylight. Shoulder months are quieter but cooler; winter daylight is limited.',
      },
      politics: {
        governmentType: 'Constitutional monarchy (Sweden)',
        stability: 'Highly stable',
        visaRequirements:
          'Sweden is in the Schengen Area. Visa requirements vary by nationality—check official Swedish / EU guidance.',
        entryRequirements:
          'Valid passport or permitted national ID. Cards dominate payments—carry a backup payment method.',
      },
      gettingThere: {
        fromTerminal:
          'Identify Stadsgården vs Värtahamnen/Frihamnen before planning a walk. Ships publish terminal assignments in final documents.',
        transportation: ['Walking (Stadsgården)', 'SL bus/metro/tram', 'Taxi', 'Djurgården ferry connections'],
        distanceToCity:
          'Stadsgården often ~1–2 km to Gamla Stan/Slussen; Värtan area roughly 4–6+ km to the old town',
        walkingTime: 'Stadsgården: frequently 15–30 minutes to Gamla Stan. Värtan: plan transit, not a casual walk',
        taxiInfo: 'Readily available; useful from Värtan with limited time',
        publicTransport:
          'SL tickets cover buses, metro, and trams. From Värtan, bus/metro combinations reach T-Centralen and Gamla Stan',
      },
    },
    terminals: [
      {
        name: 'Stadsgården Cruise Quay',
        slug: 'stadsgarden-cruise-quay',
        description:
          'Inner-city Stockholm cruise quay on Södermalm’s north shore with comparatively short walks toward Slussen and Gamla Stan.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger access', 'taxi', 'nearby SL transit', 'coach pickup'],
        distance_to_city_center_km: 1.5,
        transport_options: ['walking', 'taxi', 'SL transit'],
        is_primary: true,
        sort_order: 10,
        country_id: 'sweden',
      },
      {
        name: 'Värtahamnen Cruise Terminal',
        slug: 'vartahamnen-cruise-terminal',
        description:
          'Northeast Stockholm cruise/ferry harbor area used by many large ships; expect bus, metro, or taxi into Gamla Stan rather than walking.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger terminal', 'security', 'taxi', 'bus connections'],
        distance_to_city_center_km: 5,
        transport_options: ['SL bus/metro', 'taxi', 'cruise shuttle'],
        is_primary: false,
        sort_order: 20,
        country_id: 'sweden',
      },
      {
        name: 'Frihamnen Cruise Area',
        slug: 'frihamnen-cruise-area',
        description:
          'Additional Ports of Stockholm cruise berths in the Frihamnen area; pair with local transit or taxi toward the historic center.',
        terminal_type: 'both',
        terminal_status: 'active',
        facilities: ['passenger access', 'taxi', 'coach parking'],
        distance_to_city_center_km: 5.5,
        transport_options: ['taxi', 'SL transit', 'cruise shuttle'],
        is_primary: false,
        sort_order: 30,
        country_id: 'sweden',
      },
    ],
    highlights: [
      'Gamla Stan old town',
      'Vasa Museum',
      'Royal Palace exterior / changing of the guard (seasonal timing)',
      'Djurgården museums and walks',
      'City Hall waterfront photos',
      'Fika break in a café',
    ],
    overrideSlug: 'stockholm-sweden',
  },
};

function updateOverrideHighlights(overrides, slug, highlights, description) {
  if (!overrides.ports) overrides.ports = {};
  const cur = overrides.ports[slug] || {};
  const next = { ...cur };
  if (Array.isArray(highlights) && highlights.length >= 4) {
    // Replace deterministic filler highlights when present
    const looksFiller =
      !Array.isArray(cur.highlights) ||
      cur.highlights.some((h) => /is a cruise port|listed in the SeaDays/i.test(String(h)));
    if (looksFiller || (cur.highlights || []).length < 4) next.highlights = highlights;
  }
  if (description && (!cur.description || /is a cruise port in/i.test(cur.description) || cur.description.length < 80)) {
    next.description = description;
  }
  next.rewrittenAt = new Date().toISOString();
  next.model = 'manual-port-guide-enrichment-phase1';
  next.confidenceScore = 0.85;
  next.sourcesUsed = Array.isArray(cur.sourcesUsed)
    ? [...new Set([...cur.sourcesUsed, 'official-port-tourism-research-2026'])]
    : ['official-port-tourism-research-2026'];
  overrides.ports[slug] = next;
}

function main() {
  const guides = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
  const terminals = JSON.parse(fs.readFileSync(TERMINALS_PATH, 'utf8'));
  const overrides = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
  if (!guides.byAppPortId) throw new Error('guides.byAppPortId missing');
  if (!terminals.byPortId) terminals.byPortId = {};

  const hamburgBefore = JSON.stringify(guides.byAppPortId.hamburg);
  const report = {
    generatedAt: new Date().toISOString(),
    portsEnriched: [],
    hamburgUnchanged: true,
    viatorTouched: false,
    envTouched: false,
    mobileAppTouched: false,
  };

  for (const [id, pack] of Object.entries(ENRICHMENTS)) {
    const existing = guides.byAppPortId[id];
    if (!existing) {
      report.portsEnriched.push({ id, error: 'missing guide record' });
      continue;
    }
    const merged = mergeGuide(existing, pack.guide);
    guides.byAppPortId[id] = merged.guide;

    let terminalAdded = 0;
    let terminalImproved = 0;
    if (pack.terminals) {
      const tr = mergeTerminals(terminals.byPortId[id], pack.terminals);
      terminals.byPortId[id] = tr.terminals;
      terminalAdded = tr.added;
      terminalImproved = tr.improved;
    }

    if (pack.overrideSlug && pack.highlights) {
      updateOverrideHighlights(
        overrides,
        pack.overrideSlug,
        pack.highlights,
        pack.guide.portInfo && pack.guide.portInfo.description
      );
    }

    const stillMissing = [];
    if (!terminals.byPortId[id] || !terminals.byPortId[id].length) stillMissing.push('cruiseTerminals');
    if (!merged.guide.portInfo?.population) stillMissing.push('population');
    if (merged.guide.size?.berthCount == null) stillMissing.push('exactBerthCount');

    report.portsEnriched.push({
      id,
      port: merged.guide.portName,
      country: merged.guide.country,
      sectionsAdded: merged.sectionsAdded,
      sectionsImproved: merged.sectionsImproved,
      terminalsAdded: terminalAdded,
      terminalsImproved: terminalImproved,
      sources: pack.sources,
      stillMissing,
    });
  }

  report.hamburgUnchanged = JSON.stringify(guides.byAppPortId.hamburg) === hamburgBefore;
  guides.meta = {
    ...(guides.meta || {}),
    lastEnrichedAt: new Date().toISOString(),
    lastEnrichment: 'phase1-priority-20-manual-research',
    count: Object.keys(guides.byAppPortId).length,
  };
  terminals.meta = {
    ...(terminals.meta || {}),
    generatedAt: new Date().toISOString(),
    count: Object.values(terminals.byPortId).reduce((n, arr) => n + (arr?.length || 0), 0),
    portCount: Object.keys(terminals.byPortId).length,
    source: (terminals.meta && terminals.meta.source) || 'public.port_terminals + manual enrichment',
    note: 'Phase 1 enrichment merged additional researched terminals for priority ports',
  };
  overrides.updatedAt = new Date().toISOString();

  fs.writeFileSync(GUIDES_PATH, JSON.stringify(guides, null, 2) + '\n', 'utf8');
  fs.writeFileSync(TERMINALS_PATH, JSON.stringify(terminals, null, 2) + '\n', 'utf8');
  fs.writeFileSync(OVERRIDES_PATH, JSON.stringify(overrides, null, 2) + '\n', 'utf8');
  fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

  console.log(`[enrich] enriched ${report.portsEnriched.length} ports`);
  console.log(`[enrich] hamburgUnchanged=${report.hamburgUnchanged}`);
  console.log(`[enrich] terminal ports now=${Object.keys(terminals.byPortId).length}`);
  console.log(`[enrich] report → ${path.relative(REPO, REPORT_PATH)}`);
}

main();

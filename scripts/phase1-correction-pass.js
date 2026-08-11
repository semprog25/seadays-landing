#!/usr/bin/env node
'use strict';

/**
 * Phase 1 correction pass (landing repo only).
 * - Civitavecchia terminal dedupe + count alignment
 * - Valencia berthCount removal
 * - Destination-specific thingsToDo / day plans
 * - Palma / Málaga / Cozumel / Vigo terminal & distance fixes
 * - Soft stats / climate / facts / entry wording polish
 *
 * Does NOT publish Amsterdam. Does NOT touch Viator / .env / mobile app.
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');
const TERMINALS_PATH = path.join(REPO, 'data', 'public-port-terminals.json');
const OVERRIDES_PATH = path.join(REPO, 'data', 'landing-cruise-content-overrides.json');
const REPORT_PATH = path.join(REPO, 'data', 'reports', 'PHASE_1_CORRECTION_PASS_REPORT.md');
const ACTIONS_PATH = path.join(REPO, 'data', 'reports', 'phase1-correction-pass-actions.json');

const actions = [];

function note(action, detail) {
  actions.push({ action, detail, at: new Date().toISOString() });
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function writeJson(p, data) {
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

/** @type {Record<string, object>} */
const THINGS_TO_DO = {
  barcelona: {
    intro:
      'Barcelona rewards a focused plan: Adossat berths need a shuttle or taxi into town, while the World Trade Center pier is closer to Port Vell. Pick one district cluster rather than racing across the city.',
    topThings: [
      'Gothic Quarter lanes and Barcelona Cathedral area',
      'La Rambla and Boqueria market (short visits work best)',
      'Sagrada Família (timed entry strongly recommended)',
      'Park Güell (book ahead; allow transfer time)',
      'Barceloneta beachfront or Montjuïc viewpoints on lighter days',
    ],
    shortCall:
      'Stay near Port Vell / Gothic Quarter / Ramblas. A cathedral-area walk, a market stop, and a café work well. Skip Sagrada Família and Park Güell unless you already hold tickets and have a private transfer waiting.',
    standardCall:
      'Choose either (A) Gothic Quarter + Ramblas/Boqueria + waterfront return, or (B) timed Sagrada Família plus one nearby neighborhood—not both Park Güell and Sagrada Família with a tight all-aboard from Adossat.',
    longerCall:
      'With a long day or overnight, combine a major Gaudí ticket with a second district (Eixample, Montjuïc, or Barceloneta). Still leave a generous buffer for Adossat shuttle queues.',
    practicalTip:
      'Confirm Adossat vs World Trade Center before planning a walk. From Adossat, treat the Blue Port shuttle or a taxi as part of your schedule—not optional.',
  },
  vigo: {
    intro:
      'Vigo is one of Spain’s most walkable Atlantic cruise calls: the Trasatlánticos waterfront sits beside Casco Vello. Save long transfers for Cíes or Santiago only when time truly allows.',
    topThings: [
      'Casco Vello (old town) lanes and viewpoints',
      'Oyster stalls and seafood along the waterfront',
      'Jardines del Cable / promenade near the maritime station',
      'Castro de Vigo hill views',
      'Cíes Islands ferries or Santiago de Compostela only on longer calls',
    ],
    shortCall:
      'Walk into Casco Vello, sample oysters or tapas near the port, and stroll the waterfront gardens. Stay within a short walk of the maritime station.',
    standardCall:
      'Old town + Castro viewpoint or a longer waterfront loop still leaves time to return on foot. Add Samil beach only if your ship’s schedule is generous and taxis are quick.',
    longerCall:
      'Cíes Islands or Santiago are realistic only with an early start, confirmed ferry/train timing, and a disciplined return buffer. Do not stack both with a casual city walk.',
    practicalTip:
      'Uphill lanes in Casco Vello take longer than the map suggests. Wear comfortable shoes and keep an eye on ship time even though the pier is close.',
  },
  miami: {
    intro:
      'PortMiami is primarily an embarkation/turnaround hub. Shore “sightseeing” usually means pre-cruise hotel time or a short post-arrival window—not a classic 6-hour transit call.',
    topThings: [
      'Confirm your lettered terminal (AA, A–F) before rideshare drop-off',
      'Downtown Miami / Brickell for a pre-cruise night',
      'South Beach Art Deco District on a longer layover',
      'Wynwood walls if you have a half-day free before embarkation',
      'On-port parking and tunnel/causeway traffic planning',
    ],
    shortCall:
      'If you only have a few hours before embarkation, stay near downtown/Brickell hotels and transfer straight to your assigned terminal. Do not attempt South Beach plus PortMiami on a tight clock.',
    standardCall:
      'A half-day layover can fit one neighborhood (South Beach or Wynwood) plus hotel checkout and port transfer—with heavy weekend traffic buffers.',
    longerCall:
      'A full pre-cruise day in Miami can combine beach time and a neighborhood meal, then an early evening or next-morning embarkation. Always reconfirm terminal letters the night before.',
    practicalTip:
      'Weekend turnarounds congest the PortMiami Tunnel and causeway. Arrive inside your cruise line’s check-in window with luggage already organized.',
  },
  civitavecchia: {
    intro:
      'Most guests treat Civitavecchia as Rome’s gateway. A Rome day is rewarding but tight; staying local or choosing Tarquinia can be smarter on shorter calls.',
    topThings: [
      'Rome classics (Colosseum area, historic center, or Vatican—pick one cluster)',
      'Regional train via Civitavecchia station + local transfer in Rome',
      'Organized Rome shore excursion with guaranteed return timing',
      'Civitavecchia fortress / waterfront if remaining in town',
      'Tarquinia or coastal Lazio on a lighter cultural day',
    ],
    shortCall:
      'Skip Rome. Explore Civitavecchia’s waterfront and fortress area, or take a short taxi/bus loop nearby. A rushed Rome round-trip with only ~4–5 hours ashore is a common miss-ship risk.',
    standardCall:
      'Rome is possible with an early start: free port shuttle to Largo della Pace, train toward Rome, one landmark cluster, then a disciplined return. Many guests prefer a line excursion for timing insurance. Do not plan Colosseum + Vatican + historic center in one call.',
    longerCall:
      'A long day supports one major Rome cluster plus a neighborhood meal, or a more relaxed Tarquinia/coast option. Overnight or embarkation stays change the math entirely.',
    practicalTip:
      'Note your RCT terminal (Vespucci, Donato Bramante / Pier 12, Terminal 10, or 25 South). Use the free pier shuttle and keep passport/ID on you in Rome.',
  },
  southampton: {
    intro:
      'Southampton is the UK’s main turnaround port. “Things to do” often means embarkation logistics, a short city errand, or a London pre/post stay—not a packed transit sightseeing day.',
    topThings: [
      'Confirm Eastern Docks (Ocean / QEII, Dock Gate 4) vs Western Docks (City / Horizon / Mayflower, Dock Gate 10)',
      'Ocean Village / waterfront dining near Western Docks',
      'SeaCity Museum / Titanic exhibits on a longer free window',
      'London by rail for pre- or post-cruise nights',
      'New Forest or Isle of Wight only with ample free time',
    ],
    shortCall:
      'If you are embarking, prioritize check-in. Errands or a quick waterfront meal near Western Docks are realistic; Eastern Docks usually need a taxi for town.',
    standardCall:
      'A free afternoon before sailing can cover Ocean Village or SeaCity plus hotel transfer. Do not attempt a full London day and same-evening embarkation without a proven buffer.',
    longerCall:
      'Pre/post nights in London or a New Forest day trip work when you are not boarding the same evening. Treat dock security queues as part of the schedule.',
    practicalTip:
      'Luggage + Dock Gate mistakes cost more time than the map implies. Match Gate 4 vs Gate 10 to your berth before ordering a taxi.',
  },
  dubrovnik: {
    intro:
      'Ships use Port Gruž, roughly 3 km from Pile Gate. Summer heat and wall queues define the day more than the attraction list.',
    topThings: [
      'Old City via Pile Gate and the Stradun',
      'City Walls circuit (buy tickets strategically; go early)',
      'Cable car viewpoint above the Old City',
      'Lokrum Island boat trips when schedules fit',
      'Fortresses and side streets away from the densest cruise surge',
    ],
    shortCall:
      'Bus or taxi to Pile Gate, walk the Stradun and main squares, then return. Skip the full walls circuit if time or heat is tight.',
    standardCall:
      'Old Town + either City Walls or the cable car is a strong day. Stacking walls + cable car + Lokrum usually overruns a standard call once queues appear.',
    longerCall:
      'Add Lokrum or a slower walls + viewpoint combo when you have a long day and can start early. Midsummer midday on the walls is punishing—hydrate and pace.',
    practicalTip:
      'The coastal walk from Gruž is ~30–40 minutes with limited shade. In summer, bus/shuttle usually beats walking for both comfort and timing.',
  },
  marseille: {
    intro:
      'Large ships use MPCT far from the Vieux-Port; smaller ships may berth nearer Joliette. Your terminal choice decides whether the day feels walkable.',
    topThings: [
      'Vieux-Port waterfront and Le Panier lanes',
      'Notre-Dame de la Garde (uphill; allow time and water)',
      'MuCEM and modern waterfront museums',
      'Bouillabaisse / Provençal market stops',
      'Aix-en-Provence or Calanques only with confirmed timing',
    ],
    shortCall:
      'From Joliette, walk or short-hop to Vieux-Port and Le Panier. From MPCT, budget shuttle time first—then keep the plan to the harbor front only.',
    standardCall:
      'Vieux-Port + Le Panier + one viewpoint or museum is realistic after the MPCT shuttle. Notre-Dame de la Garde needs extra walking/heat margin.',
    longerCall:
      'Aix or a Calanques outing can work on a long call with an organized transfer. Do not combine both with a full Old Port wander on a tight return.',
    practicalTip:
      'Do not walk through the industrial port from MPCT. Use the port/city shuttle or a taxi toward Joliette / Vieux-Port.',
  },
  genua: {
    intro:
      'Genoa’s Stazioni Marittime berths put Porto Antico and the steep centro storico within walking range—comfortable shoes matter as much as the itinerary.',
    topThings: [
      'Porto Antico waterfront and Aquarium of Genoa',
      'Centro storico caruggi (alleyways)',
      'Via Garibaldi / Palazzi dei Rolli exteriors',
      'Pesto and focaccia food stops',
      'Nervi or Cinque Terre only on long, well-buffered calls',
    ],
    shortCall:
      'Porto Antico + a short climb into the nearest historic lanes. Save museum interiors and hill neighborhoods for another day.',
    standardCall:
      'Aquarium or waterfront time plus a focused centro storico loop is a classic Genoa call. Cinque Terre is a stretch unless the ship day is long and transport is pre-booked.',
    longerCall:
      'Add a palace museum street, a viewpoint, or a cautious Cinque Terre excursion with a guaranteed return plan. Steep streets slow every schedule.',
    practicalTip:
      'Confirm Ponte dei Mille vs Ponte Andrea Doria on your documents. Both sit by the passenger complex, but walking routes differ slightly.',
  },
  piraeus: {
    intro:
      'Piraeus is Athens’ cruise gate. The Acropolis area is roughly 10–13 km away—plan metro, taxi, or an organized tour, not a walk from the pier.',
    topThings: [
      'Acropolis and Acropolis Museum (one tightly planned visit)',
      'Plaka / Monastiraki lanes after the site',
      'Ancient Agora if time remains nearby',
      'Piraeus waterfront if you stay local',
      'Island ferries are a separate complex—do not confuse them with cruise gates',
    ],
    shortCall:
      'Stay near Piraeus or take a taxi for a single nearby highlight. A full Acropolis visit with only ~4–5 hours ashore is often too tight once port shuttles and heat are factored in.',
    standardCall:
      'Acropolis (early) + short Plaka walk is the standard independent plan. Use the internal port shuttle from outer berths before you start the city clock.',
    longerCall:
      'Add the Acropolis Museum or Ancient Agora when queues cooperate. Do not also chase distant neighborhoods or a Greek-island hop on the same call.',
    practicalTip:
      'Midday Acropolis climbs in summer are demanding. Go early, carry water, and watch for heat-related site measures.',
  },
  copenhagen: {
    intro:
      'Terminal choice changes everything: Oceankaj is a transit ride; Langelinie and Nordre Toldbod sit closer to the classic waterfront.',
    topThings: [
      'Nyhavn waterfront',
      'Historic center / royal sights area',
      'Tivoli Gardens when open for the season',
      'Little Mermaid promenade if berthed near Langelinie',
      'Vesterbro or Nørrebro cafés on a longer stroll',
    ],
    shortCall:
      'From Langelinie/Nordre Toldbod, walk a waterfront loop. From Oceankaj, use metro/bus straight to one central pocket (Nyhavn or Tivoli)—not both plus a long return.',
    standardCall:
      'Nyhavn + one museum or Tivoli (seasonal) is a strong day from closer quays. From Oceankaj, keep the plan to one district cluster after transit.',
    longerCall:
      'Add a second neighborhood or a longer bike loop when daylight and berth location cooperate. Summer evenings are long—still protect all-aboard time.',
    practicalTip:
      'Check Oceankaj vs Langelinie vs Nordre Toldbod on final documents before you assume a walkable call.',
  },
  amsterdam: {
    intro:
      'Downtown calls usually use Passenger Terminal Amsterdam (PTA) on the IJ. Some itineraries use outlying options such as IJmuiden—confirm before planning a walk.',
    topThings: [
      'Canal-belt walking or cycling',
      'Museumplein (Rijksmuseum area) with timed tickets',
      'Anne Frank House only with advance tickets',
      'Jordaan cafés and side canals',
      'GVB tram/metro from PTA toward Centraal',
    ],
    shortCall:
      'Tram toward Centraal and a compact canal walk. Skip major museums unless tickets and timing are already locked.',
    standardCall:
      'One museum or Anne Frank House (ticketed) plus a neighborhood stroll is realistic from PTA. Do not stack multiple timed museums.',
    longerCall:
      'Museumplein + canal belt + a relaxed dinner district can fit a long day. Confirm you are not at an outlying berth before assuming PTA distances.',
    practicalTip:
      'Trams beat a long walk in rain. If your ship lists IJmuiden or another outlying berth, rebuild the day around transfers.',
  },
  naples: {
    intro:
      'The central Stazione Marittima berth is walkable to the historic core, but Pompeii, Herculaneum, and Capri each consume most of a call on their own.',
    topThings: [
      'Centro storico / Spaccanapoli and pizza culture',
      'Piazza del Plebiscito area',
      'Pompeii archaeological site (train/coach time required)',
      'Herculaneum as a somewhat tighter archaeology option than Pompeii',
      'Capri ferries only with careful timetable discipline',
    ],
    shortCall:
      'Stay in Naples: historic center lanes, a classic pizza stop, and waterfront views. Do not attempt Pompeii or Capri.',
    standardCall:
      'Choose ONE: Naples walking day, OR Pompeii, OR Herculaneum, OR Capri. Combining Naples sightseeing with Pompeii on a standard call is how guests run late.',
    longerCall:
      'Pompeii with a little buffer, or Capri with ferry margins, can work on a long day. Amalfi Coast coach tours need an early start and a reliable return.',
    practicalTip:
      'Circumvesuviana/trains toward Pompeii need station transfer time. Prefer official taxis and keep a wide return margin.',
  },
  'palma-de-mallorca': {
    intro:
      'Ships use Estació Marítima terminals along Palma’s commercial waterfront. Poniente/Paraires (EM 1–4) are nearer the promenade route; Dique del Oeste (EM 5–6) sits farther out.',
    topThings: [
      'Cathedral of Santa Maria (La Seu) and Parc de la Mar',
      'Old Town lanes and Passeig del Born',
      'Arab Baths or palace exteriors nearby',
      'Waterfront promenade (Passeig Marítim) if berthed closer in',
      'Bellver Castle or island tours only with spare time',
    ],
    shortCall:
      'Shuttle or taxi to La Seu / Parc de la Mar, short Old Town loop, return. Walking the full waterfront from outer berths usually eats the call.',
    standardCall:
      'Cathedral + Old Town + Born-area tapas is the classic independent day. Add Bellver only if transport is quick and all-aboard is late.',
    longerCall:
      'Island interior, beach club, or Bellver become realistic. Still confirm whether you are at EM 1–4 or EM 5–6 before assuming walk times.',
    practicalTip:
      'Cruise shuttles toward the cathedral area are the default on busy days. Heat makes the long waterfront walk slower than guidebooks imply.',
  },
  valencia: {
    intro:
      'The cruise terminal sits in the commercial port—shuttle or taxi first. Downtown Gothic Valencia and the City of Arts and Sciences are different directions; pick a theme.',
    topThings: [
      'Cathedral / historic center and Central Market',
      'Lonja and Gothic streets',
      'City of Arts and Sciences architecture',
      'Turia Gardens walking ribbon',
      'Malvarrosa / Cabanyal beach districts on a beach-focused day',
    ],
    shortCall:
      'Shuttle/taxi to the historic center for cathedral + market. Leave the City of Arts for another call.',
    standardCall:
      'Historic center OR City of Arts and Sciences plus a short garden/beach add-on—not a full double-feature with long photo stops at both.',
    longerCall:
      'Center + Turia Gardens + beach, or a deeper City of Arts visit, can fit a long day with disciplined transfers back to the port zone.',
    practicalTip:
      'Do not walk out through the commercial port gates expecting a short stroll to the cathedral. Budget the shuttle/taxi both ways.',
  },
  malaga: {
    intro:
      'Málaga is often a walkable Costa del Sol call from central berths near Muelle Uno. Granada is a separate full-day excursion—not a casual add-on.',
    topThings: [
      'Muelle Uno waterfront promenade',
      'Alcazaba fortress',
      'Málaga Cathedral',
      'Picasso Museum (timed entry helps)',
      'Gibralfaro viewpoint by taxi or energetic climb',
    ],
    shortCall:
      'Muelle Uno + cathedral area or a quick Alcazaba visit. Keep the radius tight and skip Granada entirely.',
    standardCall:
      'Alcazaba + cathedral/Picasso neighborhood is a strong independent day. Gibralfaro is optional if heat and hills allow.',
    longerCall:
      'Granada (Alhambra) only belongs on a long call or organized excursion with reserved tickets and a firm return plan. Do not treat it like a nearby Málaga sight.',
    practicalTip:
      'Midday Alcazaba climbs are hot. If Granada is on your list, assume it consumes the day—do not also plan a full Málaga museum crawl.',
  },
  cozumel: {
    intro:
      'Cozumel has three main cruise piers. Your assigned pier (posted on the daily program) changes whether downtown is a walk or a taxi.',
    topThings: [
      'San Miguel waterfront shopping and dining',
      'Beach clubs along the west coast',
      'Snorkeling or diving on Cozumel’s reefs',
      'San Gervasio Maya ruins inland',
      'East-coast wild beaches on a guided island loop',
    ],
    shortCall:
      'From Punta Langosta, walk downtown. From Puerta Maya or International Pier, taxi to a nearby beach club or into San Miguel—then return with time to spare.',
    standardCall:
      'Beach club + light downtown time, or a focused snorkel trip, fits most calls. Island-wide east-coast loops need an earlier start.',
    longerCall:
      'Ruins + beach, or a longer reef outing, become realistic. Still confirm pier assignment before assuming you can walk into town.',
    practicalTip:
      'Puerta Maya and International Pier sit near each other south of town; Punta Langosta is the downtown pier. Tendering is uncommon and usually only when pier capacity or operations require it—follow ship instructions.',
  },
  nassau: {
    intro:
      'Downtown Nassau Cruise Port opens onto Bay Street. Beach time and Paradise Island/Atlantis compete for the same clock.',
    topThings: [
      'Bay Street and downtown colonial streets',
      'Junkanoo Beach for a quick swim',
      'Queen’s Staircase / Fort Fincastle area',
      'Straw Market crafts',
      'Atlantis / Paradise Island as a paid longer outing',
    ],
    shortCall:
      'Bay Street + Junkanoo Beach or the Queen’s Staircase loop. Skip Atlantis if the window is short.',
    standardCall:
      'Downtown highlights plus beach time, OR a focused Atlantis/Paradise Island visit—not both at a leisurely pace.',
    longerCall:
      'Combine a longer Atlantis visit with a brief downtown stop only if transfers are smooth and all-aboard is late.',
    practicalTip:
      'Agree taxi rates before Paradise Island runs. Walking covers most downtown sights if heat allows.',
  },
  santorini: {
    intro:
      'Santorini is primarily a tender call to the Old Port (Skala) below Fira; some excursions use Athinios for coaches. Cable-car queues dominate the clock.',
    topThings: [
      'Fira caldera paths and viewpoints',
      'Cable car between Old Port and Fira (or steep stairs)',
      'Oia (needs transfer time from Fira)',
      'Akrotiri archaeological site on coach-based plans',
      'Local wine tasting on longer island loops',
    ],
    shortCall:
      'Tender up to Fira, walk the caldera edge, descend with extra queue time. Skip Oia unless you have a private transfer and a late all-aboard.',
    standardCall:
      'Fira first. Oia is optional only with disciplined transfer timing. Do not browse endlessly before joining the cable-car line down.',
    longerCall:
      'Fira + Oia or an Akrotiri/wine loop can fit a long day. Athinios coach operations follow excursion plans—not the Old Port stroll.',
    practicalTip:
      'Budget tender + cable-car queues as real attractions that consume time. On multi-ship days, prioritize getting up to Fira early and leaving extra time to descend.',
  },
  bergen: {
    intro:
      'Bergen’s downtown quays (often around the Skolten / central harbor area) put Bryggen within a short walk—weather changes faster than itineraries.',
    topThings: [
      'Bryggen wharf district',
      'Fish market waterfront',
      'Fløibanen funicular to Mount Fløyen',
      'Hanseatic museum area',
      'Fjord day trips only on long calls',
    ],
    shortCall:
      'Bryggen + fish market loop. Save Fløyen if rain and time are uncertain.',
    standardCall:
      'Bryggen + Fløibanen viewpoint is the classic combo. Add a museum only if weather drives you indoors early.',
    longerCall:
      'Fjord excursions (e.g., Sognefjord-style day trips) need an early start and a trusted operator return. Do not casual-stack them after a long Fløyen hike.',
    practicalTip:
      'Pack waterproof layers even in summer. Exact quay names vary—follow ship signage once alongside.',
  },
  stockholm: {
    intro:
      'Stadsgården can be walkable to Gamla Stan; Värtahamnen/Frihamnen usually need bus, metro, or taxi. Identify the terminal before planning a stroll.',
    topThings: [
      'Gamla Stan (Old Town) lanes and palace exteriors',
      'Vasa Museum on Djurgården',
      'Waterfront promenades and fika stops',
      'ABBA Museum / Skansen on longer calls',
      'Archipelago boats when schedules and berth location allow',
    ],
    shortCall:
      'From Stadsgården, walk Gamla Stan. From Värtan/Frihamnen, take transit to Old Town only—skip Djurgården museums.',
    standardCall:
      'Gamla Stan + Vasa Museum is a strong independent day when transfers cooperate. From Värtan, keep the plan tighter.',
    longerCall:
      'Add Skansen/ABBA or an archipelago hop on a long day. Still protect return time from the farther harbors.',
    practicalTip:
      'SL tickets cover buses/metro/trams. Do not assume every Stockholm berth is a Gamla Stan walk.',
  },
};

const OVERRIDE_SLUGS = {
  barcelona: 'barcelona-spain',
  vigo: 'vigo-spain',
  miami: 'miami-fl-united-states',
  civitavecchia: 'rome-civitavecchia-italy',
  southampton: 'southampton-united-kingdom',
  dubrovnik: 'dubrovnik-croatia',
  marseille: 'marseille-provence-france',
  genua: 'genoa-italy',
  piraeus: 'athens-piraeus-greece',
  copenhagen: 'copenhagen-denmark',
  naples: 'naples-italy',
  'palma-de-mallorca': 'palma-de-mallorca-spain',
  valencia: 'valencia-spain',
  malaga: 'malaga-spain',
  cozumel: 'cozumel-mexico',
  nassau: 'nassau-bahamas',
  santorini: 'santorini-greece',
  bergen: 'bergen-norway',
  stockholm: 'stockholm-sweden',
  // amsterdam intentionally omitted from overrides publish path
};

function fixCivitavecchiaTerminals(byPortId, guides) {
  const merged = [
    {
      name: 'Terminal Amerigo Vespucci',
      slug: 'terminal-amerigo-vespucci',
      description:
        'Large Roma Cruise Terminal passenger building on Quay 12 North; major embarkation/turnaround hub with extensive check-in and baggage areas. Free port shuttles commonly link piers with the Largo della Pace service area.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['check-in hall', 'security', 'baggage', 'coach parking', 'passenger services'],
      distance_to_city_center_km: 1.2,
      transport_options: ['free RCT / port shuttle', 'taxi', 'links toward Civitavecchia station'],
      is_primary: true,
      sort_order: 10,
      country_id: 'italy',
    },
    {
      name: 'Terminal Donato Bramante (Quay 12 South / Pier 12)',
      slug: 'terminal-donato-bramante',
      description:
        'Canonical Pier 12 South passenger terminal operated by Roma Cruise Terminal (also referred to historically as Terminal Bramante). Modern check-in capacity beside the Vespucci complex; confirm Pier 12 assignment on arrival-day signage. This record replaces duplicate “Bramante / Donato Bramante” cards that previously described the same facility.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['check-in hall', 'security', 'seating', 'covered pier access', 'passenger services'],
      distance_to_city_center_km: 1.3,
      transport_options: ['free port shuttle to Largo della Pace', 'taxi', 'station transfer'],
      is_primary: false,
      sort_order: 20,
      country_id: 'italy',
    },
    {
      name: 'Terminal 10',
      slug: 'terminal-10-civitavecchia',
      description:
        'RCT cruise terminal at Quay 10 along the Cristoforo Colombo antemurale. Used for cruise operations alongside the larger Vespucci/Bramante buildings—follow ship documents for the assigned quay.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger processing', 'pier access', 'shuttle links'],
      distance_to_city_center_km: 1.5,
      transport_options: ['port shuttle', 'taxi'],
      is_primary: false,
      sort_order: 30,
      country_id: 'italy',
    },
    {
      name: 'Terminal 25 South',
      slug: 'terminal-25-south-civitavecchia',
      description:
        'RCT terminal at Quay 25 South, on the opposite side of the antemurale from the main Quay 10–13 cruise cluster. Transfers still typically funnel through port shuttle / Largo della Pace patterns—allow a little extra orientation time.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger processing', 'pier access'],
      distance_to_city_center_km: 2,
      transport_options: ['port shuttle', 'taxi'],
      is_primary: false,
      sort_order: 40,
      country_id: 'italy',
    },
  ];
  byPortId.civitavecchia = merged;
  const g = guides.byAppPortId.civitavecchia;
  if (g && g.size) {
    g.size.terminalCount = merged.length;
    g.size.portCapacity =
      'Roma Cruise Terminal (RCT) operates multiple cruise passenger facilities in Civitavecchia (commonly cited as five terminal/berth areas including Quays 10–13 and 25). SeaDays lists the primary named passenger buildings passengers meet most often.';
    g.size.annualVisitors =
      'One of the Mediterranean’s highest-volume Italian cruise gateways (exact annual totals vary by year—check Port Authority / RCT publications for the current season)';
  }
  if (g && g.gettingThere) {
    g.gettingThere.fromTerminal =
      'Ships berth at RCT piers (commonly Terminal Amerigo Vespucci, Terminal Donato Bramante on Quay 12 South, Terminal 10, or Terminal 25 South). Free shuttle buses commonly run between docks and Largo della Pace—confirm your building on arrival-day signage.';
  }
  if (g && g.facts) {
    g.facts.notableFeatures = [
      'Terminal Amerigo Vespucci (Quay 12 North)',
      'Terminal Donato Bramante (Quay 12 South / Pier 12)',
      'Additional RCT facilities including Terminal 10 and Terminal 25 South',
      'Largo della Pace passenger service hub with free pier shuttles',
    ];
  }
  note('civitavecchia-terminals', `Set ${merged.length} canonical terminals; removed duplicate Bramante card`);
}

function fixVigoTerminals(byPortId, guides) {
  const list = byPortId.vigo || [];
  for (const t of list) {
    if (t.slug === 'vigo-cruise-terminal-trasatlanticos') {
      t.description =
        'One of two concessioned cruise terminal operators inside the historic Alberto Durán Maritime Station on Muelle de Trasatlánticos (not a separate pier from Atlantic Vigo). City-center waterfront with passenger processing and tourist information; Casco Vello is a short walk.';
      t.name = 'Vigo Cruise Terminal (Alberto Durán / Trasatlánticos)';
    }
    if (t.slug === 'atlantic-vigo-cruise-terminal') {
      t.description =
        'Second concessioned cruise terminal operator also housed in the Alberto Durán Maritime Station on Muelle de Trasatlánticos. Same waterfront complex as Vigo Cruise Terminal—different operator/facility rooms, not a distant second pier. Your ship’s agent assigns which concession handles the call.';
      t.name = 'Atlantic Vigo Cruise Terminal (Alberto Durán / Trasatlánticos)';
    }
  }
  byPortId.vigo = list;
  const g = guides.byAppPortId.vigo;
  if (g && g.gettingThere) {
    g.gettingThere.fromTerminal =
      'Primary calls use Muelle de Trasatlánticos inside the Alberto Durán Maritime Station, where two concessioned terminals operate: Vigo Cruise Terminal and Atlantic Vigo Cruise Terminal (same building complex). Multi-ship days may also use El Tinglado on Muelle de Comercio.';
  }
  if (g && g.portInfo) {
    g.portInfo.description =
      'Vigo is Galicia’s principal Atlantic cruise call. Ships dock on the city waterfront at Muelle de Trasatlánticos—where the Alberto Durán Maritime Station hosts two concessioned terminals (Vigo Cruise Terminal and Atlantic Vigo Cruise Terminal)—and on multi-ship days at Muelle de Comercio (El Tinglado). Casco Vello, oyster bars, and the promenade are a short walk away.';
  }
  if (g && g.size) {
    g.size.terminalCount = 3;
    g.size.annualVisitors =
      'Port of Vigo materials describe on the order of 200,000+ cruise visitors in recent marketing seasons (qualitative port-authority language—confirm current-year totals on apvigo.es)';
  }
  note('vigo-terminals', 'Clarified dual Trasatlánticos concessions vs Comercio secondary terminal');
}

function fixPalmaTerminals(byPortId, guides) {
  byPortId['palma-de-mallorca'] = [
    {
      name: 'Estació Marítima EM 1–4 (Poniente / Paraires)',
      slug: 'palma-estacion-maritima-em1-4',
      description:
        'Main cruise passenger terminal cluster around Muelle de Poniente / Muelle de Paraires (Estació Marítima buildings commonly numbered 1–4). Typically the nearer commercial-port option toward Passeig Marítim; shuttle or taxi to La Seu / Old Town is still the usual cruise-day pattern.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger terminals', 'security', 'taxi', 'coach parking', 'shuttles'],
      distance_to_city_center_km: 4,
      transport_options: ['cruise shuttle', 'taxi', 'city bus', 'long waterfront walk'],
      is_primary: true,
      sort_order: 10,
      country_id: 'spain',
    },
    {
      name: 'Estació Marítima EM 5–6 (Dique del Oeste)',
      slug: 'palma-dique-del-oeste-em5-6',
      description:
        'Outer cruise terminals on Dique del Oeste near Portopí. Farther from La Seu / Old Town than Poniente–Paraires—plan shuttle or taxi rather than a casual walk with limited hours ashore.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger terminals', 'security', 'taxi', 'shuttles'],
      distance_to_city_center_km: 6,
      transport_options: ['cruise shuttle', 'taxi', 'city bus'],
      is_primary: false,
      sort_order: 20,
      country_id: 'spain',
    },
  ];
  const g = guides.byAppPortId['palma-de-mallorca'];
  if (g) {
    g.size = g.size || {};
    g.size.terminalCount = 2;
    g.size.berthCount = null;
    g.size.portCapacity =
      'Multi-terminal Estació Marítima complex: Poniente/Paraires (EM 1–4) and Dique del Oeste (EM 5–6), capable of handling simultaneous large-ship calls';
    g.size.annualVisitors =
      'One of Spain’s busier island cruise ports (see Port Authority of the Balearic Islands season statistics for current totals)';
    g.gettingThere = {
      ...(g.gettingThere || {}),
      fromTerminal:
        'Confirm Estació Marítima number: EM 1–4 (Poniente/Paraires) vs EM 5–6 (Dique del Oeste). Shuttles toward the cathedral / city center are common on busy days.',
      distanceToCity:
        'Rough planning ranges: EM 1–4 often about 4–5.5 km to La Seu / Old Town; EM 5–6 often about 6–7+ km depending on berth and routing',
      walkingTime:
        'A full waterfront walk from nearer berths can take roughly 45–60+ minutes; from Dique del Oeste it is longer and usually not worth it on a short call',
      taxiInfo: 'Taxis at the cruise terminals for cathedral drop-off or island tours—confirm destination first',
      publicTransport:
        'City buses link the Portopí / cruise zone with central Palma; many guests still prefer the cruise shuttle on multi-ship days',
      transportation: ['Shuttle bus', 'Taxi', 'City bus', 'Walking (long / heat-exposed)'],
    };
  }
  note('palma-terminals', 'Named EM 1–4 vs EM 5–6 clusters with distances');
}

function fixMalagaTerminals(byPortId, guides) {
  byPortId.malaga = [
    {
      name: 'Málaga Cruise Terminal (Levante / Muelle Uno area)',
      slug: 'malaga-cruise-terminal-muelle-uno',
      description:
        'Central cruise passenger facilities on Málaga’s downtown waterfront beside the Muelle Uno retail promenade. Many calls are within a short walk or brief taxi of the cathedral, Alcazaba approaches, and historic center.',
      terminal_type: 'both',
      terminal_status: 'active',
      facilities: ['passenger terminal', 'security', 'taxi', 'waterfront retail nearby'],
      distance_to_city_center_km: 1,
      transport_options: ['walking', 'taxi', 'city bus'],
      is_primary: true,
      sort_order: 10,
      country_id: 'spain',
    },
  ];
  const g = guides.byAppPortId.malaga;
  if (g) {
    g.size = g.size || {};
    g.size.terminalCount = 1;
    g.size.annualVisitors =
      'Major Costa del Sol cruise volumes (see Málaga Port Authority season statistics for current totals)';
    g.gettingThere = {
      ...(g.gettingThere || {}),
      fromTerminal:
        'Most cruise berths are on the downtown waterfront near the cruise terminal / Muelle Uno promenade—confirm the exact gate on ship signage.',
      distanceToCity: 'Often under 1–2 km to the historic center from central berths',
      walkingTime: 'Frequently 10–25 minutes to cathedral / Atarazanas area from central piers',
      taxiInfo: 'Short taxi hops help for Gibralfaro or travelers avoiding hills/heat',
      publicTransport:
        'Local buses cover hill neighborhoods. Granada is a longer rail/coach excursion—not a casual add-on to a short Málaga walk.',
      transportation: ['Walking', 'Taxi', 'City bus', 'Train/coach for Granada (long excursion)'],
    };
    if (g.facts) {
      g.facts.culturalHighlights = [
        'Andalusian tapas culture in the historic center',
        'Waterfront promenade shopping at Muelle Uno',
        'Picasso’s birthplace city museums',
        'Granada/Alhambra as a separate full-day excursion when time and tickets allow',
      ];
    }
  }
  note('malaga-terminals', 'Clarified Muelle Uno central terminal; Granada flagged as long excursion');
}

function fixCozumelTerminals(byPortId, guides) {
  byPortId.cozumel = [
    {
      name: 'Punta Langosta Cruise Pier',
      slug: 'punta-langosta-cruise-pier',
      description:
        'Downtown San Miguel cruise pier. Guests often walk straight into the waterfront shopping district. Pier assignment is published by the ship—do not assume every Cozumel call uses Punta Langosta.',
      terminal_type: 'transit',
      terminal_status: 'active',
      facilities: ['passenger access', 'retail nearby', 'taxi'],
      distance_to_city_center_km: 0.3,
      transport_options: ['walking', 'taxi', 'beach-club transfers'],
      is_primary: false,
      sort_order: 10,
      country_id: 'mexico',
    },
    {
      name: 'Puerta Maya Cruise Pier',
      slug: 'puerta-maya-cruise-pier',
      description:
        'Major purpose-built cruise pier complex south of downtown San Miguel with passenger buildings, retail, and taxi/tour access. Typically requires a short taxi to central San Miguel or beach clubs. Confirm assignment on the daily program.',
      terminal_type: 'transit',
      terminal_status: 'active',
      facilities: ['passenger buildings', 'retail', 'taxi', 'tour desks'],
      distance_to_city_center_km: 4,
      transport_options: ['taxi', 'tour shuttles', 'walking (long/hot—usually not preferred)'],
      is_primary: true,
      sort_order: 20,
      country_id: 'mexico',
    },
    {
      name: 'International Pier (Cozumel)',
      slug: 'international-pier-cozumel',
      description:
        'Cruise pier adjacent to the Puerta Maya area south of town (also referenced with SSA/TMM operator names in local materials). Not a downtown walk for most guests—use taxis or prearranged transfers. Assignments vary by sailing.',
      terminal_type: 'transit',
      terminal_status: 'active',
      facilities: ['passenger access', 'retail', 'taxi'],
      distance_to_city_center_km: 3.5,
      transport_options: ['taxi', 'tour shuttles', 'walking between nearby pier complexes'],
      is_primary: false,
      sort_order: 30,
      country_id: 'mexico',
    },
  ];
  const g = guides.byAppPortId.cozumel;
  if (g) {
    g.size = g.size || {};
    g.size.terminalCount = 3;
    g.size.berthCount = null;
    g.size.annualVisitors =
      'Among Mexico’s busiest cruise islands (see APIQROO / destination statistics for current season totals)';
    g.gettingThere = {
      ...(g.gettingThere || {}),
      fromTerminal:
        'Cozumel uses three main cruise piers—Punta Langosta (downtown), Puerta Maya, and International Pier (south of town, near each other). Confirm the assigned pier on your ship’s daily program; line patterns exist but are not guaranteed.',
      distanceToCity:
        'Punta Langosta: waterfront downtown. Puerta Maya / International Pier: typically a few kilometres south of San Miguel (often ~10 minutes by taxi in light traffic)',
      walkingTime:
        'Easy from Punta Langosta. From Puerta Maya / International Pier, walking to downtown is long and hot—taxis are the usual choice',
      taxiInfo: 'Fixed-rate taxi boards are common—agree destination and rate before departure',
      publicTransport:
        'Limited urban transit for visitors; most independents walk near downtown or taxi to beaches/ruins. Tendering is uncommon and usually only when pier capacity or operations require it.',
      transportation: ['Walking (Punta Langosta)', 'Taxi', 'Beach-club shuttle', 'Rental scooter/car'],
    };
    if (g.portInfo) {
      g.portInfo.description =
        'Cozumel is a western Caribbean staple known for reefs, beach clubs, and downtown San Miguel. Ships normally dock at one of three piers—Punta Langosta, Puerta Maya, or International Pier—rather than tendering. Check your daily program for the assigned pier before planning a walk into town.';
    }
  }
  note('cozumel-terminals', 'Added Punta Langosta; clarified three-pier model + rare tender caveat');
}

function polishClimateAndEntry(g, id) {
  const climatePatches = {
    barcelona: {
      type: 'Mediterranean',
      averageTemp: 'Warm summers often mid-to-upper 20s °C; milder winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn and winter bring more rain; summer is usually drier',
      humidity: 'Can feel muggy on the waterfront in midsummer',
      description:
        'Peak cruise months are spring and early autumn when walking days are long but less extreme than July–August heat. Midsummer pairs high temperatures with heavier landmark queues—start early for Sagrada Família or Park Güell.',
    },
    vigo: {
      type: 'Oceanic (Atlantic)',
      averageTemp: 'Mild; summers often mid-teens to low-20s °C',
      bestMonths: ['May', 'June', 'July', 'August', 'September'],
      rainySeason: 'Rain is possible year-round; fronts move in quickly from the Atlantic',
      humidity: 'Damp Atlantic air—pack a light waterproof layer',
      description:
        'Even in summer, Vigo can feel cool and changeable compared with Mediterranean ports. Cruise season favors late spring through early autumn for outdoor dining and Casco Vello walks.',
    },
    miami: {
      type: 'Tropical',
      averageTemp: 'Warm year-round; summer hotter and more humid',
      bestMonths: ['November', 'December', 'January', 'February', 'March', 'April'],
      rainySeason: 'Summer wet season with brief heavy showers; monitor tropical storm forecasts',
      humidity: 'High in summer',
      description:
        'Winter and early spring are the most comfortable embarkation seasons. Summer heat, humidity, and storm risk matter more for outdoor layover plans than for a quick terminal transfer.',
    },
    civitavecchia: {
      type: 'Mediterranean',
      averageTemp: 'Hot summers inland in Rome; coastal breezes at the port',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn can be wetter; summer mostly dry',
      humidity: 'Rome summer heat feels intense in open plazas',
      description:
        'Spring and early autumn are popular for Rome shore days. Midsummer requires earlier starts, water, and realistic queue expectations at major sites.',
    },
    southampton: {
      type: 'Temperate maritime',
      averageTemp: 'Mild summers; cool, damp winters',
      bestMonths: ['May', 'June', 'July', 'August', 'September'],
      rainySeason: 'Rain possible any month; wind can feel sharp on the docks',
      humidity: 'Often cloudy/damp rather than tropical-humid',
      description:
        'Summer offers the longest daylight for embarkation travel. Shoulder seasons remain active for cruising but can be wet—pack layers for dock queues.',
    },
    dubrovnik: {
      type: 'Mediterranean (Adriatic)',
      averageTemp: 'Hot summers often upper 20s–30s °C',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn storms possible; summer usually dry and intense',
      humidity: 'High heat on stone streets and walls in July–August',
      description:
        'Midsummer brings both heat and peak cruise congestion in the Old City. Early wall walks and shade breaks matter as much as the sightseeing list.',
    },
    marseille: {
      type: 'Mediterranean',
      averageTemp: 'Hot, dry summers; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn can bring heavier rain; Mistral wind can feel strong',
      humidity: 'Dry heat is common in summer',
      description:
        'Summer is peak cruise season but punishing for the uphill walk to Notre-Dame de la Garde. Shoulder months are often kinder for long walks from Joliette.',
    },
    genua: {
      type: 'Mediterranean coastal',
      averageTemp: 'Mild winters; warm summers moderated by the sea',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn rain possible; humid summer evenings in the alleys',
      humidity: 'Can feel close in the caruggi after rain',
      description:
        'Steep historic lanes amplify warm-day effort. Comfortable shoes and a weather check matter more here than in flat waterfront ports.',
    },
    piraeus: {
      type: 'Mediterranean',
      averageTemp: 'Hot, dry summers; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Limited summer rain; winter wetter',
      humidity: 'Dry heat at exposed archaeological sites',
      description:
        'Summer Acropolis visits are defined by heat and sun exposure. Early entries and water are practical necessities, not tips.',
    },
    copenhagen: {
      type: 'Oceanic / Nordic coastal',
      averageTemp: 'Cool summers (often high teens °C); cold, dark winters',
      bestMonths: ['May', 'June', 'July', 'August', 'September'],
      rainySeason: 'Showers possible year-round',
      humidity: 'Brisk wind off the water can feel colder than the thermometer',
      description:
        'Long summer daylight favors shore days. Peak cruise season runs late spring through early autumn; winter calls are fewer and daylight is short.',
    },
    amsterdam: {
      type: 'Oceanic',
      averageTemp: 'Mild summers; cool winters',
      bestMonths: ['April', 'May', 'June', 'July', 'August', 'September'],
      rainySeason: 'Showers are frequent—pack a light rain layer',
      humidity: 'Damp rather than tropical',
      description:
        'Changeable Atlantic weather is normal. Summer evenings are long enough for canal walks after a museum visit if showers pass.',
    },
    naples: {
      type: 'Mediterranean',
      averageTemp: 'Hot summers often upper 20s–30s °C; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn can be wetter; summer usually dry and intense',
      humidity: 'High summer heat at Pompeii’s exposed ruins',
      description:
        'Pompeii and open piazzas are harsh at midday in July–August. An early archaeology start beats a late return scramble.',
    },
    'palma-de-mallorca': {
      type: 'Mediterranean island',
      averageTemp: 'Hot summers often upper 20s–30s °C; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn storms possible; summer typically dry',
      humidity: 'Strong sun on the waterfront promenade',
      description:
        'Peak summer is hot and busy around the cathedral. Shoulder seasons are excellent for Old Town walking without the heaviest heat.',
    },
    valencia: {
      type: 'Mediterranean',
      averageTemp: 'Hot summers; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Autumn can bring heavy rain; summer usually dry',
      humidity: 'Humid near the beach districts in midsummer',
      description:
        'Sunny conditions favor beach-and-city combination days outside peak midsummer heat. Plan shade if walking Turia Gardens at noon.',
    },
    malaga: {
      type: 'Mediterranean (Costa del Sol)',
      averageTemp: 'Mild winters; hot summers',
      bestMonths: ['March', 'April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Limited; winter is the wetter period',
      humidity: 'Dry heat on Alcazaba climbs',
      description:
        'One of Spain’s milder winter climates. Summer is excellent for Muelle Uno walks but hot for midday fortress climbs—and brutal if you also attempt Granada.',
    },
    cozumel: {
      type: 'Tropical Caribbean',
      averageTemp: 'Warm to hot year-round; highs often upper 20s–low 30s °C',
      bestMonths: ['November', 'December', 'January', 'February', 'March', 'April'],
      rainySeason: 'Summer wetter with storm risk; dry season is peak cruising weather',
      humidity: 'High—hydrate between pier and beach club',
      description:
        'Dry season brings the most reliable beach weather. Summer heat and humidity make exposed walks from southern piers into town less appealing than a taxi.',
    },
    nassau: {
      type: 'Tropical maritime',
      averageTemp: 'Warm year-round; summers hotter',
      bestMonths: ['November', 'December', 'January', 'February', 'March', 'April'],
      rainySeason: 'Summer/autumn storm season—monitor forecasts',
      humidity: 'High near the waterfront',
      description:
        'Winter and spring are ideal for beach time after Bay Street. Summer heat argues for shorter outdoor loops between air-conditioned stops.',
    },
    santorini: {
      type: 'Mediterranean / semi-arid Aegean',
      averageTemp: 'Warm, dry summers; mild winters',
      bestMonths: ['April', 'May', 'June', 'September', 'October'],
      rainySeason: 'Limited summer rain; wind can be strong on the caldera edge',
      humidity: 'Low humidity but intense sun on whitewashed paths',
      description:
        'Dry summer sun and tender/cable-car queues define the experience. Shoulder seasons often mean fewer ships and more manageable waits—still protect descent time.',
    },
    bergen: {
      type: 'Oceanic (very wet)',
      averageTemp: 'Cool summers often mid-teens °C; mild but damp winters for the latitude',
      bestMonths: ['May', 'June', 'July', 'August'],
      rainySeason: 'Rain is common any day—waterproof layers are normal cruise kit',
      humidity: 'Damp air; wind on the harbor can feel colder',
      description:
        'Expect rain. Summer offers the best chance of clearer fjord views and long daylight for Fløyen walks, but “dry day” is never guaranteed.',
    },
    stockholm: {
      type: 'Humid continental / Baltic coastal',
      averageTemp: 'Mild summers; cold winters with short daylight',
      bestMonths: ['May', 'June', 'July', 'August', 'September'],
      rainySeason: 'Showers possible in summer; winter brings snow/ice risk',
      humidity: 'Fresh Baltic air; evenings cool even in summer',
      description:
        'Peak cruise season is summer with long daylight for Gamla Stan and Djurgården. Shoulder months are quieter but cooler; winter daylight is limited.',
    },
  };

  if (climatePatches[id]) g.climate = climatePatches[id];

  const country = (g.country || '').toLowerCase();
  if (id === 'miami') {
    g.politics = {
      ...(g.politics || {}),
      governmentType: 'Federal republic (United States); Florida state/local authorities',
      stability: 'Tourism infrastructure is mature; follow ordinary big-city awareness',
      visaRequirements:
        'U.S. entry depends on nationality (ESTA/VWP, visa, or other status). Confirm with official CBP / State Department guidance and your cruise line—closed-loop vs fly-cruise paperwork can differ.',
      entryRequirements:
        'Carry the documents your cruise line listed for embarkation. Terminal check-in will not replace missing immigration eligibility.',
    };
  } else if (id === 'southampton') {
    g.politics = {
      ...(g.politics || {}),
      governmentType: 'Constitutional monarchy (United Kingdom)',
      stability: 'Mature homeport operations; allow time for dock security',
      visaRequirements:
        'UK entry rules depend on nationality (visa, ETA, or other schemes). Check official GOV.UK guidance for your passport before travel.',
      entryRequirements:
        'Follow your cruise line’s embarkation document list. Airport-to-dock timing is separate from immigration eligibility.',
    };
  } else if (id === 'nassau') {
    g.politics = {
      ...(g.politics || {}),
      governmentType: 'Parliamentary constitutional monarchy (Bahamas)',
      stability: 'Generally stable in main tourist zones',
      visaRequirements:
        'Bahamas entry rules depend on nationality. Many visitors receive short-stay landing permission—confirm with official Bahamas immigration guidance and your cruise line.',
      entryRequirements:
        'Valid passport required for most travelers. Closed-loop vs fly-cruise document instructions from your line still apply.',
    };
  } else if (id === 'cozumel') {
    g.politics = {
      ...(g.politics || {}),
      governmentType: 'Federal republic (Mexico); Quintana Roo state',
      stability: 'Tourism zones are accustomed to cruise volumes; follow local and cruise-line guidance',
      visaRequirements:
        'Mexican entry rules depend on nationality. Many visitors complete a tourist permit/FMM process via airline or on arrival—confirm current rules with official Mexican immigration sources and your cruise line.',
      entryRequirements:
        'Carry a valid passport and follow ship instructions for going ashore. Pier shopping zones are not a substitute for checking re-boarding cutoffs.',
    };
  } else if (
    [
      'barcelona',
      'vigo',
      'civitavecchia',
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
      'santorini',
      'bergen',
      'stockholm',
    ].includes(id)
  ) {
    const place =
      id === 'genua'
        ? 'Italy (Genoa)'
        : id === 'palma-de-mallorca'
          ? 'Spain (Balearic Islands)'
          : id === 'civitavecchia'
            ? 'Italy'
            : g.country || 'this destination';
    g.politics = {
      ...(g.politics || {}),
      visaRequirements: `${place} follows Schengen / European short-stay frameworks for many travelers, but visa and passport rules depend on nationality and can change. Confirm with official government sources and your cruise line before travel.`,
      entryRequirements:
        'Carry a valid passport (or a national ID only where your cruise line and destination authorities explicitly accept it). Shore excursions do not change document rules—keep required ID with you ashore.',
    };
    // lightly unique stability without fluff
    if (!g.politics.stability || /^(Generally|Highly) stable/.test(g.politics.stability)) {
      g.politics.stability =
        'Ordinary urban/tourist awareness applies; check local notices if demonstrations or large events affect transfer routes.';
    }
  }
}

function polishFacts(g, id) {
  const patches = {
    barcelona: {
      established: 'Roman roots; modern commercial and cruise facilities expanded through the 19th–21st centuries',
      significance:
        'Catalonia’s principal seaport and a primary Western Mediterranean homeport—Adossat turnarounds shape many Western Med itineraries',
      notableFeatures: [
        'Moll Adossat Terminals A–D for most large ships',
        'World Trade Center pier closer to Port Vell',
        'Blue Port shuttle pattern from Adossat',
        'Major Gaudí and Gothic Quarter shore demand',
      ],
      culturalHighlights: [
        'Catalan–Spanish bilingual public life',
        'Modernisme architecture as a defining city brand',
        'Beach-city dual identity (Barceloneta vs historic core)',
      ],
    },
    valencia: {
      established: 'Roman foundation; major Mediterranean trading city with a large modern commercial port',
      significance:
        'Spain’s third-largest city and a growing cruise call where the commercial port sits apart from the historic center and the City of Arts district',
      notableFeatures: [
        'Dedicated cruise terminal inside Valenciaport',
        'Historic center / Central Market cluster',
        'City of Arts and Sciences as a separate axis',
      ],
      culturalHighlights: [
        'Paella traditions tied to the surrounding region',
        'Gothic Lonja heritage',
        'Turia Gardens on the old riverbed',
      ],
    },
    civitavecchia: {
      established: 'Ancient Roman port heritage; modern cruise gateway role expanded with Roma Cruise Terminal facilities',
      significance:
        'Italy’s busiest cruise port for many seasons and the standard sea approach for Rome itineraries—logistics matter as much as landmarks',
      notableFeatures: [
        'RCT multi-terminal layout (Vespucci, Donato Bramante, Terminal 10, 25 South, and additional quays)',
        'Free pier shuttle culture toward Largo della Pace',
        'Rail link toward Rome as the independent traveler backbone',
      ],
      culturalHighlights: [
        'Rome day-trip gravity for most cruise guests',
        'Etruscan/coastal alternatives such as Tarquinia for lighter days',
      ],
    },
  };
  if (patches[id]) g.facts = { ...(g.facts || {}), ...patches[id] };
  // Trim culturalHighlights that merely repeat topThings lists for others: keep significance-focused
  if (g.facts && Array.isArray(g.facts.culturalHighlights) && g.thingsToDo?.topThings) {
    // ensure facts don't duplicate word-for-word topThings
    const tops = new Set(g.thingsToDo.topThings.map((x) => String(x).toLowerCase()));
    g.facts.culturalHighlights = (g.facts.culturalHighlights || []).filter(
      (h) => !tops.has(String(h).toLowerCase())
    );
  }
}

function applySoftStats(g, id) {
  if (!g.size) return;
  // Keep verified hard numbers only for Barcelona + Miami
  if (id === 'barcelona') {
    g.size.annualVisitors =
      'About 4.0 million pleasure-cruise passenger movements in 2025 (Port de Barcelona official traffic statistics; includes transit plus embark/disembark movements)';
    return;
  }
  if (id === 'miami') {
    g.size.annualVisitors =
      '8,564,151 cruise passengers in FY2025 (Miami-Dade PortMiami official historical snapshot; fiscal year Oct–Sep—not a calendar-year total)';
    return;
  }
  if (id === 'valencia') {
    g.size.berthCount = null;
    g.size.annualVisitors =
      'A significant Spanish Mediterranean cruise call (exact annual passenger totals vary—check Valenciaport publications for the current season)';
    note('valencia-berthCount', 'Removed berthCount 15 (not confidently cruise-specific)');
    return;
  }
  // Ensure no fake precision elsewhere — strip digit-heavy unverified lines
  const soft = {
    southampton:
      'Major UK cruise homeport (exact annual totals published by ABP / VisitBritain vary by year—check current reports)',
    dubrovnik:
      'Major Adriatic call with sharp summer peaks (check Port of Dubrovnik season materials for current volumes)',
    marseille:
      'Among France’s higher-volume Mediterranean cruise ports (confirm current-year GPMM figures)',
    genua:
      'Significant Ligurian cruise volumes (confirm latest Port of Genoa / Stazioni Marittime statistics)',
    piraeus:
      'One of the Eastern Mediterranean’s major cruise gateways (see PPA season statistics for exact totals)',
    copenhagen:
      'Major Baltic cruise volumes (see CMP / Wonderful Copenhagen season reports)',
    amsterdam:
      'High-profile Northern Europe call (city policies and seasonal caps can affect volumes—check Port of Amsterdam updates)',
    naples:
      'Major Tyrrhenian cruise volumes (see Port of Naples seasonal reports)',
    nassau:
      'One of the Caribbean’s highest-frequency ports (see Nassau Cruise Port / tourism statistics)',
    santorini:
      'A very high-volume Aegean tender call in peak season (published annual totals vary by source and year—treat “million+” claims cautiously)',
    bergen:
      'One of Norway’s busiest cruise cities (see Port of Bergen season statistics)',
    stockholm:
      'Leading Baltic cruise destination volumes (see Ports of Stockholm season reports)',
    malaga:
      'Major Costa del Sol cruise volumes (see Málaga Port Authority season statistics)',
    cozumel:
      'Among Mexico’s busiest cruise islands (see APIQROO / destination statistics for current season totals)',
    'palma-de-mallorca':
      'One of Spain’s busier island cruise ports (see Port Authority of the Balearic Islands season statistics)',
    vigo:
      'Port of Vigo materials describe on the order of 200,000+ cruise visitors in recent marketing seasons (qualitative port-authority language—confirm current-year totals on apvigo.es)',
    civitavecchia:
      'One of the Mediterranean’s highest-volume Italian cruise gateways (exact annual totals vary by year—check Port Authority / RCT publications for the current season)',
  };
  if (soft[id]) g.size.annualVisitors = soft[id];
}

function updateOverrides(overrides, id) {
  const slug = OVERRIDE_SLUGS[id];
  if (!slug) return;
  const t = THINGS_TO_DO[id];
  if (!t) return;
  overrides.ports = overrides.ports || {};
  const cur = overrides.ports[slug] || {};
  overrides.ports[slug] = {
    ...cur,
    highlights: (t.topThings || []).slice(0, 6),
    description: t.intro || cur.description,
  };
}

function main() {
  const guides = loadJson(GUIDES_PATH);
  const terminals = loadJson(TERMINALS_PATH);
  const overrides = loadJson(OVERRIDES_PATH);

  fixCivitavecchiaTerminals(terminals.byPortId, guides);
  fixVigoTerminals(terminals.byPortId, guides);
  fixPalmaTerminals(terminals.byPortId, guides);
  fixMalagaTerminals(terminals.byPortId, guides);
  fixCozumelTerminals(terminals.byPortId, guides);

  // Valencia berth removal + all thingsToDo
  for (const [id, things] of Object.entries(THINGS_TO_DO)) {
    const g = guides.byAppPortId[id];
    if (!g) {
      note('missing-guide', id);
      continue;
    }
    g.thingsToDo = things;
    applySoftStats(g, id);
    polishClimateAndEntry(g, id);
    polishFacts(g, id);
    updateOverrides(overrides, id);
    note('thingsToDo', id);
  }

  // Explicit Valencia berth null even if loop order matters
  if (guides.byAppPortId.valencia?.size) {
    guides.byAppPortId.valencia.size.berthCount = null;
  }

  // Amsterdam remains in JSON only
  note('amsterdam', 'Enrichment updated in JSON; not added to SEO dataset / not published');

  guides.meta = guides.meta || {};
  guides.meta.phase1CorrectionPassAt = new Date().toISOString();
  terminals.meta = terminals.meta || {};
  terminals.meta.phase1CorrectionPassAt = new Date().toISOString();
  overrides.updatedAt = new Date().toISOString();

  writeJson(GUIDES_PATH, guides);
  writeJson(TERMINALS_PATH, terminals);
  writeJson(OVERRIDES_PATH, overrides);
  writeJson(ACTIONS_PATH, { generatedAt: new Date().toISOString(), actions });

  const report = `# PHASE 1 CORRECTION PASS REPORT

Generated: ${new Date().toISOString()}

## Actions
- Civitavecchia: merged duplicate Bramante into Terminal Donato Bramante; added Terminal 10 + Terminal 25 South; terminalCount=${terminals.byPortId.civitavecchia.length}
- Valencia: berthCount removed (was 15)
- Things-to-do: destination-specific objects written for ${Object.keys(THINGS_TO_DO).length} Phase 1 ports (incl. Amsterdam JSON-only)
- Palma / Málaga / Cozumel / Vigo terminal & distance clarifications applied
- Soft stats / climate / entry / facts polish applied
- Viator mappings / builder / .env: untouched
- Amsterdam: still unpublished (not in 323 SEO dataset)

## Next
Run: \`SEADAYS_APP_ROOT=... npm run regenerate-port-pages\` then \`npm run smoke-port-guides\`
`;
  fs.writeFileSync(REPORT_PATH, report, 'utf8');
  console.log('Phase 1 correction pass data written.');
  console.log('Guides:', GUIDES_PATH);
  console.log('Terminals:', TERMINALS_PATH);
  console.log('Report:', REPORT_PATH);
}

main();

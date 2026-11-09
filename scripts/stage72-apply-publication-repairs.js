#!/usr/bin/env node
'use strict'

/**
 * Passenger-facing copy repairs for Stage 72 factual sign-off (corrected-drafts + proposed).
 * Evidence-backed replacements only — no owner authorization changes.
 */

const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'qa-evidence/stage71-bootstrap-25')

/** @type {Record<string, Array<{path: string, after: string, evidence: string}>>} */
const PUBLICATION_REPAIRS = {
  'madeira-funchal-portugal': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        after: 'Mercado dos Lavradores — check market hours on your call day.',
        evidence: 'passenger-safe; removed hours null',
      },
      {
        path: 'thingsToDo.topThings[2]',
        after: 'Cable car to Monte — allow queue and return time; confirm pier-to-station transfer locally.',
        evidence: 'passenger-safe; removed transfer null',
      },
    ],
  },
  'melbourne-australia': {
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'About 3 km to the CBD via tram Route 109 or taxi. Public access to parts of the pier can be limited on ship days — follow Ports Victoria notices and your cruise line shuttle guidance.',
        evidence: 'research distances; removed null shuttle placeholder',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'About 3 km to the CBD via tram Route 109 or taxi. Public access to parts of the pier can be limited on ship days — follow Ports Victoria notices and your cruise line shuttle guidance.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'About 3 km to the CBD via tram Route 109 or taxi. Public access to parts of the pier can be limited on ship days — follow Ports Victoria notices and your cruise line shuttle guidance.',
        evidence: 'same',
      },
    ],
  },
  'molde-norway': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Molde sits on Romsdalsfjord and is one of three cruise destinations under Molde og Romsdal Havn IKS (with Åndalsnes and Eresfjord). Storkaia and Moldegård are the ISPS quays named for cruise on the Cruise Norway destination sheet. Ships typically dock in town rather than at a remote industrial pier. Confirm which quay and LOA/draft your line is assigned before planning walk times.',
        evidence: 'port authority + Cruise Norway; removed door GPS internal',
      },
    ],
  },
  'narvik-norway': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Narvik’s public port lists Pier 3 as an ISPS terminal used for cruise. Cruise Norway’s destination sheet cites berths at Pier 3, about 500 m to the town centre, and published quay dimensions that can differ from live port facility tables — confirm berth assignment and gangway location with your cruise line. Anchorage and tender options are also described for some sailings.',
        evidence: 'passenger-safe; removed map-import / sheet-claim internal language',
      },
    ],
  },
  'ponta-delgada-azores-portugal': {
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Azores Cruise materials cite about 200 m from Portas do Mar to downtown; taxis and bus parking are listed among port services. Ponta Delgada airport is about 5 km — allow extra time if flying in.',
        evidence: 'Azores Cruise sheet distance',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Azores Cruise materials cite about 200 m from Portas do Mar to downtown; taxis and bus parking are listed among port services. Ponta Delgada airport is about 5 km — allow extra time if flying in.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Azores Cruise materials cite about 200 m from Portas do Mar to downtown; taxis and bus parking are listed among port services. Ponta Delgada airport is about 5 km — allow extra time if flying in.',
        evidence: 'same',
      },
    ],
  },
  'port-canaveral-fl-united-states': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Canaveral Port Authority publishes arrival guides for seven passenger terminals in Cape Canaveral, FL 32920. North-side terminals use Charles Rowland Drive (Exit 54A); south-side terminals use Discovery Road / Christopher Columbus Drive (Exit 54B). Parking is adjacent to each terminal; ship schedules and assigned terminals can change — confirm with your cruise line before embarkation.',
        evidence: 'portcanaveral.com [S2]; removed door pins internal',
      },
      {
        path: 'gettingThere.publicTransport',
        after: 'Confirm shuttles, taxis, and parking exits with the port or your cruise line on embarkation day.',
        evidence: 'stage72 editorial repair',
      },
      {
        path: 'thingsToDo.topThings[4]',
        after: 'Cape Canaveral lighthouse area — allow flexible timing; confirm access on your call day.',
        evidence: 'removed Not verified internal tag',
      },
    ],
  },
  'salvador-de-bahia-brazil': {
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Waterfront Comércio location; Elevador Lacerda links the lower city to Pelourinho. Taxis and rideshare are the practical option for hills and heat — confirm fares locally.',
        evidence: 'passenger-safe; removed prices null',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Waterfront Comércio location; Elevador Lacerda links the lower city to Pelourinho. Taxis and rideshare are the practical option for hills and heat — confirm fares locally.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Waterfront Comércio location; Elevador Lacerda links the lower city to Pelourinho. Taxis and rideshare are the practical option for hills and heat — confirm fares locally.',
        evidence: 'same',
      },
    ],
  },
  'sharm-el-sheikh-egypt': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Sharm El Sheikh Port (UNCTAD EGSSH) sits on the southern Sinai Red Sea coast. Official pages publish coordinates 27°51.2′N / 34°17′E, passenger berths 1 (570 m) and 2 (116 m), and yacht gates. MedCruise’s Egyptian Ports facts cite differing maximum ship dimensions and quay totals — ships must follow the line’s declared draught/LOA limits. AD Ports Group stated in May 2026 that cruise terminal services commenced after Ministry of Transport / RSPA docking upgrades.',
        evidence: 'UNCTAD + MedCruise; removed Door GPS null',
      },
    ],
  },
  'skagen-denmark': {
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'The port states about 1,600 yards (roughly 1.5 km) from cruise piers to the pedestrian precinct and marina — plan walking time or use your cruise line shuttle. Grenen and inland sights need a coach or taxi.',
        evidence: 'port distance statement; removed path pins unverified',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'The port states about 1,600 yards (roughly 1.5 km) from cruise piers to the pedestrian precinct and marina — plan walking time or use your cruise line shuttle. Grenen and inland sights need a coach or taxi.',
        evidence: 'same',
      },
    ],
  },
  'skjolden-norway': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Port of Skjolden markets itself as a call at the head of Lustrafjord, on Norway’s longest ice-free fjord system about 205 km from the open sea. The port fact sheet publishes a 127.5 m cruise pier with 12 m alongside, maximum LOA 400 m and draft 12 m, plus a 36 m tender pier and Haugsbukta anchorage about 600 m from the tender pier. Technical pages note a 45 m charted clearance at an overhead line as a limiting dimension on the approach. Typical cruise season runs mid-April to mid-October.',
        evidence: 'port fact sheet; removed research-turn / Door GPS null',
      },
    ],
  },
  'st-george-s-grenada': {
    fields: [
      {
        path: 'gettingThere.publicTransport',
        after:
          'The Carenage town area is adjacent to the harbour — allow flexible walk time from your gangway. Grand Etang and estate tours need coaches; keep a 75–120 minute buffer on busy days.',
        evidence: 'passenger-safe; removed walk minutes unverified',
      },
      {
        path: 'thingsToDo.topThings[1]',
        after: 'Fort George views — allow extra time for the climb; confirm opening hours locally.',
        evidence: 'removed climb minutes unverified',
      },
      {
        path: 'thingsToDo.topThings[2]',
        after: "Carenage / St. George's harbour town — keep time for crowds near the gangway.",
        evidence: 'removed duplicate unverified Fort George line',
      },
    ],
  },
  'st-lucia-castries-st-lucia': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Castries concentrates Saint Lucia’s cruise traffic. SLASPA describes Pointe Seraphine as a dedicated cruise shopping and berth complex within walking distance of the city, with La Place Carenage serving ships at the Queen Elizabeth II docks and water taxis linking the retail hubs. The commercial Saint Lucia Cruise Port site lists Pointe Seraphine berth lengths and draught figures plus larger numbered berths. Berth tables differ between sources — confirm your assigned terminal and gangway with the cruise line before planning transfers.',
        evidence: 'SLASPA + GPH; removed SeaDays open-question internal',
      },
      {
        path: 'gettingThere.distanceToCity',
        after:
          'The downtown market area is a short walk from the cruise terminals — keep time for crowds at the gangway. Soufrière and the Pitons are full-day coach outings; allow at least two hours’ buffer beyond advertised tour length.',
        evidence: 'passenger shore-time guidance',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'The downtown market area is a short walk from the cruise terminals — keep time for crowds at the gangway. Soufrière and the Pitons are full-day coach outings; allow at least two hours’ buffer beyond advertised tour length.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'The downtown market area is a short walk from the cruise terminals — keep time for crowds at the gangway. Soufrière and the Pitons are full-day coach outings; allow at least two hours’ buffer beyond advertised tour length.',
        evidence: 'same',
      },
    ],
  },
  'tauranga-new-zealand': {
    fields: [
      {
        path: 'gettingThere.publicTransport',
        after:
          'The port cites easy access to Tauranga city and Bay of Plenty attractions. Shuttle provision varies by sailing — confirm with your ship. Taxis and rideshare are available; confirm pricing locally.',
        evidence: 'removed null shuttle/price placeholders',
      },
    ],
  },
  'tenerife-spain': {
    fields: [
      {
        path: 'gettingThere.publicTransport',
        after:
          'Santa Cruz urban core is the nearest option via taxi or bus — confirm fares locally. Teide National Park and southern resort areas need substantial road time; book only on longer calls with confirmed return transport.',
        evidence: 'passenger-safe; removed prices/minutes null',
      },
    ],
  },
  'tortola-british-virgin-islands': {
    fields: [
      {
        path: 'gettingThere.fromTerminal',
        after: 'Cyril B. Romney Tortola Pier Park — published pier dimensions up to 180,000 GRT class.',
        evidence: 'removed door null',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'The pier park sits at the waterfront. Road Town centre is a short taxi ride — confirm walk time from your gangway if you plan to walk. Cane Garden Bay and North Shore outings need 75–120 minute buffers on busy days.',
        evidence: 'passenger-safe',
      },
      {
        path: 'thingsToDo.topThings[1]',
        after: 'Road Town stroll — allow flexible time from the pier; confirm shops and services on your call day.',
        evidence: 'removed walk minutes unverified',
      },
    ],
  },
  'trondheim-norway': {
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Trondheim Port Authority (TPA) operates ISPS cruise facilities in Trondheim. Cruise quay 68 at Brattøra is published at 96 m length and 13 m depth and has received large ships including Queen Mary 2 and MSC Meraviglia. Ila 30 (280 m / 8 m) is used when 68 is unavailable; Pir 1 appears in the cruise quay table with afternoon availability notes. Anchored ships may tender to the Skansen floating bridge (~1300 m from anchorage per 2026 terms). The port terms sheet cites up to four cruise ships and 9,000 passengers per day.',
        evidence: 'TPA pages; removed Door GPS null',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Cruise berths are centrally located for city exploring. Confirm whether you start from Brattøra (quay 68) or Ila — walk times differ. Prefer your ship’s pier map for the gangway you use.',
        evidence: 'removed unsurveyed gap wording',
      },
    ],
  },
  'ulvik-norway': {
    fields: [
      {
        path: 'gettingThere.publicTransport',
        after:
          'Expect ship tender to the floating dock when assigned. Ulvik village is compact — allow flexible walk time from the dock and keep a return buffer for tender queues.',
        evidence: 'removed not surveyed gap',
      },
      {
        path: 'thingsToDo.topThings[2]',
        after: 'Fruit & Cider Route farms — seasonal; confirm coach or taxi transfer with your ship.',
        evidence: 'removed transfer not surveyed',
      },
    ],
  },
  'visby-sweden': {
    fields: [
      {
        path: 'gettingThere.publicTransport',
        after:
          'Gotland’s cruise terminal is within walking distance of Visby’s city centre — plan extra time inside the medieval wall when crowds are heavy and keep a gangway buffer.',
        evidence: 'CMP walking distance; removed pins not verified',
      },
    ],
  },
}

function setByPath(obj, dotted, value) {
  const m = dotted.match(/^thingsToDo\.topThings\[(\d+)\]$/)
  if (m) {
    const idx = Number(m[1])
    if (!obj.thingsToDo) obj.thingsToDo = { topThings: [] }
    if (!obj.thingsToDo.topThings) obj.thingsToDo.topThings = []
    const before = obj.thingsToDo.topThings[idx]
    obj.thingsToDo.topThings[idx] = value
    return before
  }
  const parts = dotted.split('.')
  const last = parts.pop()
  let cur = obj
  for (const p of parts) {
    if (!cur[p]) cur[p] = {}
    cur = cur[p]
  }
  const before = cur[last]
  cur[last] = value
  return before
}

function patchGuide(guide, spec) {
  const rowApplied = []
  for (const field of spec.fields) {
    const before = setByPath(guide, field.path, field.after)
    rowApplied.push({
      path: field.path,
      evidence: field.evidence,
      before_snippet: String(before ?? '').slice(0, 120),
    })
  }
  return rowApplied
}

function main() {
  const applied = []
  for (const [slug, spec] of Object.entries(PUBLICATION_REPAIRS)) {
    const draftPath = path.join(OUT, 'corrected-drafts', `${slug}.json`)
    const proposedPath = path.join(OUT, 'proposed-guides', `${slug}.json`)
    const wrap = JSON.parse(fs.readFileSync(draftPath, 'utf8'))
    const draftRepairs = patchGuide(wrap.draft, spec)
    wrap.stage72_publication_repair_at_utc = new Date().toISOString()
    fs.writeFileSync(draftPath, `${JSON.stringify(wrap, null, 2)}\n`, 'utf8')

    let proposedRepairs = []
    if (fs.existsSync(proposedPath)) {
      const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
      proposedRepairs = patchGuide(proposed, spec)
      fs.writeFileSync(proposedPath, `${JSON.stringify(proposed, null, 2)}\n`, 'utf8')
    }

    applied.push({ landing_slug: slug, draft_repairs: draftRepairs, proposed_repairs: proposedRepairs })
  }

  const report = {
    generated_at_utc: new Date().toISOString(),
    slug_count: applied.length,
    slugs: applied.map((a) => a.landing_slug),
    detail: applied,
  }
  fs.writeFileSync(path.join(OUT, 'STAGE72_PUBLICATION_REPAIRS_APPLIED.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ publication_repairs: applied.length, slugs: report.slugs }, null, 2))
}

main()

#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage78-legacy-copy-cleanup')

const REPAIRS = {
  'boston-ma-united-states': {
    appPortId: 'boston',
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Massachusetts Port Authority’s Flynn Cruiseport is in South Boston’s Seaport district with I-90/I-93 access and Logan Airport nearby. Homeport partners listed on Massport materials include Norwegian, Celebrity, and Princess. Confirm terminal parking and drop-off on Massport’s Flynn Cruiseport page before you sail.',
        evidence: 'Massport Flynn Cruiseport; removed WGS84 pin research wording',
      },
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Driving. Massport publishes I-93 / Seaport Boulevard / Drydock Avenue / Black Falcon Avenue approaches. Parking. 93 Fargo Street; reserve online; shuttle; ~10 min walk. Logan. The airport is the usual gateway — allow extra time for Seaport traffic and confirm taxi or rideshare drop-off at the Flynn Cruiseport address on your sailing documents.',
        evidence: 'Massport directions; removed timed taxi “Not verified” leak',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Driving. Massport publishes I-93 / Seaport Boulevard / Drydock Avenue / Black Falcon Avenue approaches. Parking. 93 Fargo Street; reserve online; shuttle; ~10 min walk. Logan. The airport is the usual gateway — allow extra time for Seaport traffic and confirm taxi or rideshare drop-off at the Flynn Cruiseport address on your sailing documents.',
        evidence: 'same',
      },
    ],
  },
  'cabo-san-lucas-mexico': {
    appPortId: 'cabo-san-lucas',
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Cabo San Lucas is a tender port at the tip of Baja California. Swell and queue times at the marina can affect your time ashore — build a generous buffer before all-aboard. Puerto Los Cabos near San José del Cabo is a separate marina; match pickup points to your cruise documents.',
        evidence: 'Passenger tender guidance; removed SEMAR questionnaire wording',
      },
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Ship → shore. Expect a tender to the marina; queues can lengthen in swell. Airport (SJD). Los Cabos International Airport serves the region — confirm private transfer or cruise-line motorcoach timing with your line. Downtown. The marina boardwalk sits close to central Cabo once you are ashore; allow time for the tender round trip.',
        evidence: 'Tender-first guidance; removed SEMAR doc leak',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Ship → shore. Expect a tender to the marina; queues can lengthen in swell. Airport (SJD). Los Cabos International Airport serves the region — confirm private transfer or cruise-line motorcoach timing with your line. Downtown. The marina boardwalk sits close to central Cabo once you are ashore; allow time for the tender round trip.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Ship → shore. Expect a tender to the marina; queues can lengthen in swell. Airport (SJD). Los Cabos International Airport serves the region — confirm private transfer or cruise-line motorcoach timing with your line. Downtown. The marina boardwalk sits close to central Cabo once you are ashore; allow time for the tender round trip.',
        evidence: 'same',
      },
    ],
  },
  'galveston-tx-united-states': {
    appPortId: 'galveston',
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Galveston Wharves markets itself as the only cruise homeport in Texas and a major Gulf embarkation point for Caribbean itineraries. The facilities page documents four cruise piers with published berth lengths and terminal floor areas. Confirm your pier (10, 16, 25, or 27/28) on cruise documents before you travel.',
        evidence: 'Galveston Wharves facilities; removed pin-null research wording',
      },
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Airports. Galveston Wharves materials cite two major international airports within roughly 1.5 hours’ drive — confirm which airport your line recommends and allow highway time on embarkation morning. Parking. Port parking page: online reservations, economy outdoor and garage options, lots within walking distance of each terminal, ADA spaces first-come, Port Police patrol. Rideshare. Brochure cites Lyft/Uber curbside drop-off/pickup. Houston Ship Channel confusion. Galveston Island cruise piers are not Port Houston Bayport — keep itineraries and rideshare destinations labeled Galveston Wharves.',
        evidence: 'Wharves brochure excerpt rephrased',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Airports. Galveston Wharves materials cite two major international airports within roughly 1.5 hours’ drive — confirm which airport your line recommends and allow highway time on embarkation morning. Parking. Port parking page: online reservations, economy outdoor and garage options, lots within walking distance of each terminal, ADA spaces first-come, Port Police patrol. Rideshare. Brochure cites Lyft/Uber curbside drop-off/pickup. Houston Ship Channel confusion. Galveston Island cruise piers are not Port Houston Bayport — keep itineraries and rideshare destinations labeled Galveston Wharves.',
        evidence: 'same',
      },
    ],
    topThings: [
      'The Strand Historic District — shops/restaurants near the port commercial area — ~120 min.',
      'Seawall Boulevard / beach — short taxi or rideshare — ~90 min.',
      'Texas Seaport Museum / Elissa — tourist piers 19–22 area — check hours before you visit.',
      'Moody Gardens — longer organised transfer.',
      'Pleasure Pier — evening option with overnight buffer.',
    ],
  },
  'seattle-wa-united-states': {
    appPortId: 'seattle',
    fields: [
      {
        path: 'portInfo.description',
        after:
          'Port of Seattle operates two Alaska-season cruise terminals: Smith Cove at Pier 91 north of downtown and Bell Street at Pier 66 on the central waterfront. Pier 91’s place page lists 2001 W Garfield Way, ground transportation for buses/taxis/shuttles, complimentary parking shuttles, and notes that public transit is not available to Pier 91. Pier 66 lists 2225 Alaskan Way with curb-lane drop-off and day parking via the cited operator. Marketing copy frames Seattle as an Alaska home port with Seattle-Tacoma International Airport as the usual air gateway.',
        evidence: 'Port of Seattle place pages; removed door-pin research wording',
      },
    ],
    topThings: [
      'Pike Place Market — walkable from Pier 66; taxi from Pier 91 — ~120 min.',
      'Seattle waterfront / Great Wheel area — Pier 66 adjacent context.',
      'Chihuly / Space Needle — Seattle Center; allow taxi time from either terminal.',
      'Museum of Pop Culture / Chihuly cluster — mid call.',
      'Ferry to Bainbridge — only with long buffer and schedule discipline.',
    ],
  },
}

function setByPath(obj, dotted, value) {
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

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const skipHtml = process.argv.includes('--skip-html')
  const guides = loadPublicPortGuidesFile(REPO)
  const applied = []

  for (const [landingSlug, spec] of Object.entries(REPAIRS)) {
    const guide = guides.byAppPortId[spec.appPortId]
    if (!guide) throw new Error(`missing guide: ${spec.appPortId} (${landingSlug})`)
    if (guide.researchImport?.landing_slug && guide.researchImport.landing_slug !== landingSlug) {
      throw new Error(`landing_slug mismatch for ${spec.appPortId}`)
    }
    const row = { landing_slug: landingSlug, appPortId: spec.appPortId, fields: [] }
    for (const field of spec.fields) {
      const before = setByPath(guide, field.path, field.after)
      if (containsInternalResearchLeak(field.after)) {
        throw new Error(`repair still leaks: ${landingSlug} ${field.path}`)
      }
      row.fields.push({
        path: field.path,
        evidence: field.evidence,
        before_snippet: String(before ?? '').slice(0, 140),
      })
    }
    if (spec.topThings) {
      const before = guide.thingsToDo?.topThings
      guide.thingsToDo = { ...(guide.thingsToDo || {}), topThings: spec.topThings }
      row.fields.push({
        path: 'thingsToDo.topThings',
        evidence: 'passenger durations without research leak tokens',
        before_snippet: JSON.stringify(before || []).slice(0, 140),
      })
    }
    guide.researchImport = {
      ...(guide.researchImport || {}),
      stage78_legacy_copy_cleanup_at_utc: new Date().toISOString(),
    }
    applied.push(row)
  }

  if (!dryRun) {
    writePublicPortGuidesFile(REPO, guides)
    fs.mkdirSync(EVIDENCE, { recursive: true })
    fs.writeFileSync(path.join(EVIDENCE, 'LEGACY_COPY_APPLY.json'), `${JSON.stringify({ applied_at: new Date().toISOString(), rows: applied }, null, 2)}\n`, 'utf8')
    if (!skipHtml) {
      const only = Object.keys(REPAIRS).join(',')
      const genEnv = {
        ...process.env,
        VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
        VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
        VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
      }
      execSync(`node scripts/generateBlogs.js --ports-only --only=${only}`, { cwd: REPO, stdio: 'inherit', env: genEnv })
    }
  }
  console.log(JSON.stringify({ dry_run: dryRun, slugs: Object.keys(REPAIRS), applied: applied.length }, null, 2))
}

main()

#!/usr/bin/env node
'use strict'

/**
 * Evidence-backed passenger copy repairs only — patches corrected-drafts in place.
 */

const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'qa-evidence/stage71-bootstrap-25')

/** @type {Record<string, {fields: Array<{path: string, before: string, after: string, evidence: string}>}>} */
const REPAIRS = {
  'port-canaveral-fl-united-states': {
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        before: '',
        after:
          'From Orlando International Airport (MCO), the port authority cites about 45 minutes via S.R. 528 East to Exit 54A (north terminals) or 54B (south terminals). Parking is adjacent; terminal assignment can change—confirm with your cruise line.',
        evidence: 'portcanaveral.com directions-parking [S2] in research by-port',
      },
      {
        path: 'gettingThere.distanceAnswer',
        before: '',
        after:
          'From Orlando International Airport (MCO), the port authority cites about 45 minutes via S.R. 528 East to Exit 54A (north terminals) or 54B (south terminals). Parking is adjacent; terminal assignment can change—confirm with your cruise line.',
        evidence: 'portcanaveral.com directions-parking [S2] in research by-port',
      },
      {
        path: 'gettingThere.publicTransport',
        before: '',
        after: 'Confirm shuttles, taxis, and parking exits with the port or your cruise line on embarkation day.',
        evidence: 'generic passenger guidance; avoids clipped research cell merge',
      },
    ],
  },
  'skjolden-norway': {
    fields: [
      {
        path: 'thingsToDo.topThings[2]',
        before: 'Catamaran M/S Holly',
        after: 'Catamaran M/S Holly — port-listed excursion asset; confirm tickets and sailing times at the pier.',
        evidence: 'research lists asset; removed internal hours-not-verified wording',
      },
    ],
  },
  'st-lucia-castries-st-lucia': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Castries market',
        after: 'Castries market — check opening hours locally on your call day.',
        evidence: 'passenger-safe phrasing; no fabricated hours',
      },
    ],
  },
  'ulvik-norway': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Olav H. Hauge Centre',
        after: 'Olav H. Hauge Centre — poetry museum; check hours on your call day.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'visby-sweden': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Botanical',
        after: 'Botanical gardens and church ruins — allow extra time; check hours locally.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'skagen-denmark': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Grenen',
        after: 'Grenen sand spit — coach outing; allow a long call and confirm transfer time locally.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'turku-finland': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Archipelago',
        after: 'Archipelago boat trips — long calls only; book through your ship or a verified operator.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'olden-norway': {
    fields: [
      {
        path: 'thingsToDo.topThings[0]',
        before: 'minutes verified',
        after:
          'Olden quayside — compact village staging; keep plans flexible until your berth or tender assignment is announced.',
        evidence: 'removed internal verification phrasing',
      },
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Loen Skylift',
        after: 'Loen Skylift — popular add-on; confirm shuttle or tender timing with your cruise line.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'molde-norway': {
    fields: [
      {
        path: 'thingsToDo.topThings[1]',
        before: 'Atlantic Road',
        after: 'Atlantic Road scenic drive — needs a long call and confirmed coach timing.',
        evidence: 'passenger-safe phrasing',
      },
    ],
  },
  'ushuaia-argentina': {
    fields: [
      {
        path: 'portInfo.description',
        before: 'passenger experience impact not verified',
        after:
          'Ushuaia is the southernmost major cruise and Antarctic gateway in Argentina. National port agency materials cite a 550 m × 28 m multipurpose quay, more than 500 international cruise calls, and roughly 250,000 seasonal visitors. Administrative changes were reported for early 2026 — confirm embarkation details with your cruise line.',
        evidence: 'ANPyN/DPP research [S1][S2]; removed internal verification tag',
      },
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
  if (dotted.includes('topThings[')) {
    const m = dotted.match(/topThings\[(\d+)\]/)
    const idx = Number(m[1])
    const before = cur.topThings[idx]
    cur.topThings[idx] = value
    return before
  }
  const before = cur[last]
  cur[last] = value
  return before
}

function main() {
  const applied = []
  for (const [slug, spec] of Object.entries(REPAIRS)) {
    const file = path.join(OUT, 'corrected-drafts', `${slug}.json`)
    const wrap = JSON.parse(fs.readFileSync(file, 'utf8'))
    const draft = wrap.draft
    const rowApplied = []
    for (const field of spec.fields) {
      const current =
        field.path.includes('topThings[')
          ? draft.thingsToDo.topThings[Number(field.path.match(/\[(\d+)\]/)[1])]
          : field.path.split('.').reduce((o, k) => o?.[k], draft)
      if (field.before && !String(current).includes(field.before)) {
        throw new Error(`${slug}: repair anchor not found in ${field.path}`)
      }
      const before = setByPath(draft, field.path, field.after)
      rowApplied.push({ path: field.path, evidence: field.evidence, before_snippet: String(before).slice(0, 120) })
    }
    wrap.draft = draft
    wrap.stage72_repair_at_utc = new Date().toISOString()
    fs.writeFileSync(file, `${JSON.stringify(wrap, null, 2)}\n`, 'utf8')
    applied.push({ landing_slug: slug, repairs: rowApplied })
  }
  const report = {
    generated_at_utc: new Date().toISOString(),
    slug_count: applied.length,
    slugs: applied.map((a) => a.landing_slug),
    detail: applied,
  }
  fs.writeFileSync(path.join(OUT, 'STAGE72_REPAIRS_APPLIED.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ applied: applied.length, slugs: report.slugs }, null, 2))
}

main()

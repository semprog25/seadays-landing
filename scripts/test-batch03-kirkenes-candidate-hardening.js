#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const SLUG = 'kirkenes-norway'
const APP_ID = 'kirkenes'
const RESEARCH_SHA = '7fb39713a569246163e51f762bdff77d2b473351c4f8b884077ebf752a914fe8'
const MANIFEST = path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate/BATCH03_PREP_MANIFEST.json')

const FORBIDDEN_OPERATIONAL = [
  /\bpopulation \(2023\)/i,
  /square-kilometre/i,
  /\"berthCount\":\s*2/,
  /Timed metres gap/i,
  /transfer_metres_gap/i,
  /berth_lengths_gap/i,
]

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  const row = manifest.ports.find((p) => p.landing_slug === SLUG)
  assert.ok(row, 'kirkenes manifest row')
  assert.strictEqual(row.research_sha256, RESEARCH_SHA)

  const guide = JSON.parse(
    fs.readFileSync(
      path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied', `byAppPortId.${APP_ID}.json`),
      'utf8'
    )
  )
  const proposedPath = path.join(
    REPO,
    'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-assets/kirkenes-norway/proposed-guide.json'
  )
  const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
  const hash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
  assert.strictEqual(hash, row.proposed_content_hash, 'manifest hash matches proposed-guide')

  assert.strictEqual(guide.size?.berthCount ?? null, null)
  assert.strictEqual(proposed.size?.berthCount ?? null, null)

  const html = fs.readFileSync(
    path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied/ports', SLUG, 'index.html'),
    'utf8'
  )
  const lead = String(guide.portInfo?.description || '').trim()
  for (const re of FORBIDDEN_OPERATIONAL) {
    assert.ok(!re.test(html), `forbidden pattern in html: ${re}`)
  }
  assert.ok(!containsInternalResearchLeak(html), 'kirkenes html leak scan')

  const td = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"TouristDestination"[\s\S]*?\})<\/script>/
  )
  assert.ok(td, 'TouristDestination block')
  const tdJson = JSON.parse(td[1])
  assert.ok(tdJson.description.startsWith(lead.slice(0, 80)), 'TouristDestination uses passenger lead')
  assert.ok(!/Girkonjárga|Kirkkoniemi/i.test(tdJson.description), 'no wiki place-name dump in JSON-LD')

  const gapsPath = path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate/UNRESOLVED_FACTUAL_GAPS.json')
  const gaps = JSON.parse(fs.readFileSync(gapsPath, 'utf8'))
  const ochoGaps = gaps.ports.find((p) => p.landing_slug === 'ocho-rios-jamaica')
  assert.ok(ochoGaps, 'historical Ocho gap ledger row must survive Kirkenes-only prep')
  assert.deepStrictEqual(ochoGaps.outstanding_factual_gaps, [
    'paj_berth_lengths_reynolds_assignment_unverified',
    'transfer_metres_to_town_unverified',
    'waterfall_ticket_hours_unverified',
    'beach_operator_primary_unverified',
    'attraction_decimal_coordinates_null',
  ])
  assert.strictEqual(ochoGaps.owner_factual_hold_cleared, false, 'Ocho gap ledger is historical prep record, not clearance')

  const kirkenesGaps = gaps.ports.find((p) => p.landing_slug === 'kirkenes-norway')
  assert.ok(kirkenesGaps)
  assert.strictEqual(kirkenesGaps.owner_factual_hold_cleared, false)

  console.log('test-batch03-kirkenes-candidate-hardening PASS', { proposed_content_hash: hash })
}

main()

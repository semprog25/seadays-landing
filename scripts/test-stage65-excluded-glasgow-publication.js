#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const crypto = require('crypto')
const {
  STAGE65_EXCLUDED_APP_PORT_IDS,
  assertStage65ExcludedNotPublished,
  countPassengerEditorialGuides,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const GUIDES_PATH = path.join(REPO, 'data/public-port-guides.json')
const MANIFEST_PATH = path.join(REPO, 'qa-evidence/stage65-next-25-recovery/STAGE65_NEXT_25_MANIFEST.json')
const GLASGOW_HTML = path.join(REPO, 'ports/glasgow-united-kingdom/index.html')
const EXPECTED_PASSENGER_TOTAL = 220

function shaEntry(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

function main() {
  const guides = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  const approved = manifest.slugs_approved || []

  assertStage65ExcludedNotPublished(guides)

  for (const appPortId of STAGE65_EXCLUDED_APP_PORT_IDS) {
    assert.strictEqual(guides.byAppPortId[appPortId], undefined, `glasgow must be absent from guides json`)
  }

  if (fs.existsSync(GLASGOW_HTML)) {
    const html = fs.readFileSync(GLASGOW_HTML, 'utf8')
    assert.strictEqual(
      (html.match(/pg-call-plan-card/g) || []).length,
      0,
      'glasgow html must not ship passenger call-plan cards'
    )
  }

  const portsBySlug = new Map((manifest.ports || []).map((p) => [p.landing_slug, p]))
  for (const landingSlug of approved) {
    const row = portsBySlug.get(landingSlug)
    assert(row, `manifest row for ${landingSlug}`)
    const g = guides.byAppPortId[row.app_port_id]
    assert(g, `approved guide present: ${landingSlug}`)
    assert.strictEqual(
      g.researchImport?.publication_tier,
      'passenger_editorial',
      `approved tier ${landingSlug}`
    )
  }

  const greenock = guides.byAppPortId.greenock
  const greifswald = guides.byAppPortId.greifswald
  assert.strictEqual(greenock?.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(greifswald?.researchImport?.publication_tier, 'passenger_editorial')

  const passengerTotal = countPassengerEditorialGuides(guides)
  assert.strictEqual(
    passengerTotal,
    EXPECTED_PASSENGER_TOTAL,
    `passenger editorial total after glasgow revert`
  )

  const snapshotPath = path.join(REPO, 'qa-evidence/stage65-glasgow-revert/STAGE65_APPROVED_GUIDE_HASHES.json')
  if (fs.existsSync(snapshotPath)) {
    const expected = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'))
    for (const landingSlug of approved) {
      const row = portsBySlug.get(landingSlug)
      const actual = shaEntry(guides.byAppPortId[row.app_port_id])
      assert.strictEqual(actual, expected.hashes[landingSlug], `approved guide unchanged: ${landingSlug}`)
    }
  }

  console.log('test-stage65-excluded-glasgow-publication PASS', { passengerTotal, approved: approved.length })
}

main()

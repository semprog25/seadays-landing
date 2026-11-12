#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  removeStage65ExcludedGuideEntries,
  countPassengerEditorialGuides,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const {
  assertBatch04TokyoReleaseBinding,
  SLUG,
  APP_ID,
} = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')
const { assertPagesPassengerEditorialPePolicy } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

const REPO = path.join(__dirname, '..')

function expectFail(label, fn) {
  try {
    fn()
    throw new Error(`expected failure: ${label}`)
  } catch (err) {
    if (err.message === `expected failure: ${label}`) throw err
    console.log('  ok negative:', label, '→', (err.message || err).split('\n')[0])
  }
}

function cloneGuides() {
  return JSON.parse(JSON.stringify(loadPublicPortGuidesFile(REPO)))
}

function main() {
  assert.strictEqual(countPassengerEditorialGuides(cloneGuides()), 363, 'sanity: repo must be batch04 tokyo release state')

  expectFail('owner_indexing_authorized true on tokyo', () => {
    const guides = cloneGuides()
    guides.byAppPortId[APP_ID].researchImport.owner_indexing_authorized = true
    assertBatch04TokyoReleaseBinding(REPO, guides)
  })

  expectFail('wrong proposed_content_hash on tokyo', () => {
    const guides = cloneGuides()
    guides.byAppPortId[APP_ID].researchImport.proposed_content_hash = '0'.repeat(64)
    assertBatch04TokyoReleaseBinding(REPO, guides)
  })

  expectFail('unrelated port added as net-new PE', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId.testslot = {
      portInfo: { description: 'x' },
      researchImport: {
        publication_tier: 'passenger_editorial',
        landing_slug: 'test-slot-unknown',
        owner_factual_hold_cleared: true,
        owner_publication_authorized: true,
        owner_indexing_authorized: false,
        proposed_content_hash: 'a'.repeat(64),
        research_sha256: 'b'.repeat(64),
      },
    }
    assertBatch04TokyoReleaseBinding(REPO, guides)
  })

  expectFail('pages PE policy with spoofed PE 364', () => {
    const guides = cloneGuides()
    guides.byAppPortId.duplicate = JSON.parse(JSON.stringify(guides.byAppPortId[APP_ID]))
    guides.byAppPortId.duplicate.researchImport.landing_slug = 'duplicate-slot'
    guides.byAppPortId.duplicate2 = JSON.parse(JSON.stringify(guides.byAppPortId[APP_ID]))
    guides.byAppPortId.duplicate2.researchImport.landing_slug = 'duplicate-slot-2'
    assertPagesPassengerEditorialPePolicy(REPO, guides)
  })

  const result = assertPagesPassengerEditorialPePolicy(REPO)
  assert.strictEqual(result.mode, 'batch04_tokyo_release')
  assert.strictEqual(result.pe, 363)
  console.log('test-batch04-tokyo-publication-release-negative PASS', { slug: SLUG })
}

main()

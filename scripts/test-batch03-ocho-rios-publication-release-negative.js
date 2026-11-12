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
  assertBatch03OchoRiosReleaseBinding,
  assertPagesPassengerEditorialPePolicy,
  SLUG,
  APP_ID,
} = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

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
  const guides = loadPublicPortGuidesFile(REPO)
  return JSON.parse(JSON.stringify(guides))
}

function main() {
  const livePe = countPassengerEditorialGuides(cloneGuides())
  assert.ok(livePe === 361 || livePe === 362, `sanity: repo must be batch03 release state (361 or 362); got ${livePe}`)

  expectFail('unrelated port becomes the 361st PE instead of Ocho', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    delete guides.byAppPortId[APP_ID].researchImport
    guides.byAppPortId.kirkenes.researchImport = {
      publication_tier: 'passenger_editorial',
      landing_slug: 'kirkenes-norway',
      owner_factual_hold_cleared: true,
      owner_publication_authorized: true,
      owner_indexing_authorized: false,
      research_sha256: '0'.repeat(64),
      proposed_content_hash: '0'.repeat(64),
    }
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  })

  expectFail('ocho owner_publication_authorized false', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.owner_publication_authorized = false
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  })

  expectFail('ocho owner_factual_hold_cleared false', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.owner_factual_hold_cleared = false
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  })

  expectFail('ocho proposed_content_hash mismatch', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.proposed_content_hash = '0'.repeat(64)
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  })

  expectFail('ocho owner_indexing_authorized true', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.owner_indexing_authorized = true
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  })

  const sitemapPath = path.join(REPO, 'sitemap.xml')
  const sitemapBackup = fs.readFileSync(sitemapPath, 'utf8')
  expectFail('ocho added to sitemap', () => {
  try {
    fs.writeFileSync(
      sitemapPath,
      `${sitemapBackup}\n<url><loc>https://seadays.app/ports/${SLUG}/</loc></url>\n`,
      'utf8',
    )
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    assertBatch03OchoRiosReleaseBinding(REPO, guides)
  } finally {
    fs.writeFileSync(sitemapPath, sitemapBackup, 'utf8')
  }
  })

  if (livePe === 361) {
    expectFail('kirkenes promoted to passenger_editorial', () => {
      const guides = cloneGuides()
      removeStage65ExcludedGuideEntries(guides)
      guides.byAppPortId.kirkenes.researchImport = {
        publication_tier: 'passenger_editorial',
        landing_slug: 'kirkenes-norway',
        owner_factual_hold_cleared: true,
        owner_publication_authorized: true,
        owner_indexing_authorized: false,
      }
      assertBatch03OchoRiosReleaseBinding(REPO, guides)
    })
  }

  expectFail('clearance file present but ocho not authorized (PE 360)', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    delete guides.byAppPortId[APP_ID].researchImport
    assert.strictEqual(countPassengerEditorialGuides(guides), 360)
    assertPagesPassengerEditorialPePolicy(REPO, guides)
  })

  console.log('test-batch03-ocho-rios-publication-release-negative PASS')
}

try {
  main()
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}

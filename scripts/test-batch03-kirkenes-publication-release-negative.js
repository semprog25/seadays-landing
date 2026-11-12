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
  assertBatch03KirkenesReleaseBinding,
  SLUG,
  APP_ID,
} = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')
const {
  assertBatch03OchoRiosReleaseInvariants,
  assertPagesPassengerEditorialPePolicy,
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
  assert.strictEqual(countPassengerEditorialGuides(cloneGuides()), 362, 'sanity: repo must be kirkenes release state')

  expectFail('unrelated port becomes the 362nd PE instead of Kirkenes', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    delete guides.byAppPortId[APP_ID].researchImport
    guides.byAppPortId.eilat = guides.byAppPortId.eilat || { portInfo: { name: 'Eilat' } }
    guides.byAppPortId.eilat.researchImport = {
      publication_tier: 'passenger_editorial',
      landing_slug: 'eilat-israel',
      owner_factual_hold_cleared: true,
      owner_publication_authorized: true,
      owner_indexing_authorized: false,
      research_sha256: '0'.repeat(64),
      proposed_content_hash: '0'.repeat(64),
    }
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  expectFail('kirkenes owner_publication_authorized false', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.owner_publication_authorized = false
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  expectFail('kirkenes proposed_content_hash mismatch', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.proposed_content_hash = '0'.repeat(64)
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  expectFail('kirkenes owner_indexing_authorized true', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport.owner_indexing_authorized = true
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  const sitemapPath = path.join(REPO, 'sitemap.xml')
  const sitemapBackup = fs.readFileSync(sitemapPath, 'utf8')
  expectFail('kirkenes added to sitemap', () => {
    try {
      fs.writeFileSync(
        sitemapPath,
        `${sitemapBackup}\n<url><loc>https://seadays.app/ports/${SLUG}/</loc></url>\n`,
        'utf8',
      )
      const guides = cloneGuides()
      removeStage65ExcludedGuideEntries(guides)
      assertBatch03KirkenesReleaseBinding(REPO, guides)
    } finally {
      fs.writeFileSync(sitemapPath, sitemapBackup, 'utf8')
    }
  })

  expectFail('ocho demoted while kirkenes release bound', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId['ocho-rios'].researchImport.publication_tier = 'legacy'
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  expectFail('clearance present but kirkenes not authorized (PE 361)', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport = {
      publication_tier: 'legacy',
      landing_slug: SLUG,
      owner_factual_hold_cleared: false,
      owner_publication_authorized: false,
    }
    assert.strictEqual(countPassengerEditorialGuides(guides), 361)
    assertPagesPassengerEditorialPePolicy(REPO, guides)
  })

  expectFail('spoofed PE 362 without kirkenes flags', () => {
    const guides = cloneGuides()
    removeStage65ExcludedGuideEntries(guides)
    guides.byAppPortId[APP_ID].researchImport = {
      publication_tier: 'passenger_editorial',
      landing_slug: SLUG,
      owner_factual_hold_cleared: false,
      owner_publication_authorized: false,
    }
    assertBatch03KirkenesReleaseBinding(REPO, guides)
  })

  const guides = cloneGuides()
  removeStage65ExcludedGuideEntries(guides)
  assertBatch03OchoRiosReleaseInvariants(REPO, guides)

  console.log('test-batch03-kirkenes-publication-release-negative PASS')
}

try {
  main()
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}

#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  WAVE01_OWNER_POLICY_EXCEPTION_SLUGS,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { assertHistoricalPolicyPublicationGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')

const REPO = path.join(__dirname, '..')
const WAVE_SLUGS = [...WAVE01_OWNER_POLICY_EXCEPTION_SLUGS]
const APP_IDS = { 'mumbai-india': 'mumbai', 'ravenna-italy': 'ravenna', 'bod-norway': 'bodo' }
const DEFERRED = ['goa-india']

function headJsonLdTypeCounts(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0]
  const counts = { TouristDestination: 0, BreadcrumbList: 0, FAQPage: 0 }
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(head))) {
    try {
      const data = JSON.parse(m[1].trim())
      const type = data && data['@type']
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1
    } catch {
      /* skip */
    }
  }
  return counts
}

function main() {
  const clearance = JSON.parse(
    fs.readFileSync(path.join(REPO, 'qa-evidence/publication-batch-01/wave-01/WAVE_01_POLICY_CLEARANCE.json'), 'utf8')
  )
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.owner_publication_authorized, true)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  assert.strictEqual(countPassengerEditorialGuides(guides), 360)

  for (const slug of WAVE_SLUGS) {
    assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug), `${slug} must remain on historical ledger`)
    const appPortId = APP_IDS[slug]
    const guide = guides.byAppPortId[appPortId]
    assert.ok(guide, `missing guide ${appPortId}`)
    assert.strictEqual(guide.researchImport?.owner_publication_authorized, true)
    assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
    assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
    assert.strictEqual(guide.researchImport?.qa_verdict, 'PASS')

    const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf8')
    assert.ok(/noindex/i.test(html), `${slug} must stay noindex`)
    const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
    assert.strictEqual(plans, 3, `${slug} call plans`)
    const ld = headJsonLdTypeCounts(html)
    assert.strictEqual(ld.TouristDestination, 1)
    assert.strictEqual(ld.BreadcrumbList, 1)
    assert.strictEqual(ld.FAQPage, 1)
    assert.ok(!/\bGAP\b|Sum:|est\.\/GAP/.test(html), `${slug} internal artifacts`)
    if (slug === 'mumbai-india') {
      const top = guide.thingsToDo?.topThings || []
      assert.strictEqual(top.length, 2, 'mumbai topThings exclusion')
    }
    if (slug === 'bod-norway') {
      const v = validateGeneratedPortHtml(html, {
        slug,
        previewFragment: false,
        expectTerminalMap: false,
      })
      assert.ok(v.ok, `bod html: ${v.issues.join(';')}`)
    }
  }

  for (const slug of DEFERRED) {
    assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug))
  }

  assert.strictEqual(WAVE01_OWNER_POLICY_EXCEPTION_SLUGS.size, 3)
  assertHistoricalPolicyPublicationGate(REPO, guides)

  console.log('test-wave01-publication-release PASS', { pe: 360, wave: WAVE_SLUGS })
}

main()

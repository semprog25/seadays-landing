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
  BATCH02_OWNER_POLICY_EXCEPTION_SLUGS,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { assertHistoricalPolicyPublicationGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate')
const { buildPortAliasRedirectMap } = require('./lib/portBrowseAliases')

const REPO = path.join(__dirname, '..')
const SLUG = 'mormugao-port-goa-india'
const APP_ID = 'mormugao'
const PROTECTED = ['mumbai-india', 'ravenna-italy', 'bod-norway', 'goa-india', 'eilat-israel', 'trieste-italy']

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
    fs.readFileSync(path.join(REPO, 'qa-evidence/publication-batch-02/BATCH_02_PUBLICATION_POLICY_CLEARANCE.json'), 'utf8')
  )
  assert.strictEqual(clearance.owner_publication_authorized, true)
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.sitemap_inclusion_authorized, false)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  assert.strictEqual(countPassengerEditorialGuides(guides), 360)

  assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(SLUG), 'mormugao remains on historical ledger')
  assert.strictEqual(BATCH02_OWNER_POLICY_EXCEPTION_SLUGS.size, 1)

  const guide = guides.byAppPortId[APP_ID]
  assert.ok(guide, 'mormugao guide slot')
  assert.strictEqual(guide.researchImport?.landing_slug, SLUG)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, true)
  assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(guide.researchImport?.qa_verdict, 'PASS')
  assert.strictEqual(guide.researchImport?.research_sha256, clearance.mormugao_research_sha256)
  assert.strictEqual(guide.researchImport?.batch02_owner_policy_exception, true)
  assert.deepStrictEqual(guide.researchImport?.verified_factual_field_exclusions, ['thingsToDo.topThings[2]'])
  assert.strictEqual((guide.thingsToDo?.topThings || []).length, 2)

  const html = fs.readFileSync(path.join(REPO, 'ports', SLUG, 'index.html'), 'utf8')
  assert.ok(/noindex/i.test(html), 'mormugao stays noindex')
  const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.strictEqual(plans, 3, 'mormugao call plans')
  assert.ok(html.includes('seadays-web-pmormugao'), 'Viator campaign')
  assert.ok(/Break Water Berth/i.test(html), 'berth facts preserved')

  const ld = headJsonLdTypeCounts(html)
  assert.strictEqual(ld.TouristDestination, 1)
  assert.strictEqual(ld.BreadcrumbList, 1)
  assert.strictEqual(ld.FAQPage, 1)

  const aliases = buildPortAliasRedirectMap()
  assert.strictEqual(aliases['goa-india'], SLUG)
  const goaHtml = fs.readFileSync(path.join(REPO, 'ports/goa-india/index.html'), 'utf8')
  assert.ok(/mormugao-port-goa-india/.test(goaHtml), 'goa-india redirect')
  assert.ok(/noindex/i.test(goaHtml), 'goa-india noindex')

  for (const slug of WAVE01_OWNER_POLICY_EXCEPTION_SLUGS) {
    const g = Object.values(guides.byAppPortId || {}).find((row) => row?.researchImport?.landing_slug === slug)
    assert.strictEqual(g?.researchImport?.owner_publication_authorized, true, `${slug} wave-1 unchanged`)
  }

  const eilat = guides.byAppPortId?.eilat
  assert.notStrictEqual(eilat?.researchImport?.owner_publication_authorized, true, 'eilat excluded')

  for (const slug of PROTECTED) {
    if (slug === SLUG) continue
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
    if (!fs.existsSync(htmlPath)) continue
  }

  assert.ok(!fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8').includes(`/ports/${SLUG}/`), 'mormugao not in sitemap')

  assertHistoricalPolicyPublicationGate(REPO, guides)

  console.log('test-batch02-mormugao-publication-release PASS', {
    pe: 360,
    batch02: [...BATCH02_OWNER_POLICY_EXCEPTION_SLUGS],
    wave01: [...WAVE01_OWNER_POLICY_EXCEPTION_SLUGS],
  })
}

main()

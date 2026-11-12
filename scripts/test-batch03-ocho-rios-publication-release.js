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
const { assertHistoricalPolicyPublicationGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const crypto = require('crypto')

const REPO = path.join(__dirname, '..')
const SLUG = 'ocho-rios-jamaica'
const APP_ID = 'ocho-rios'
const EXPECTED_HASH = '5635233496acf009f81ec86289e3a165bfb1d93302deaee74709a71f47b3032e'
const RESEARCH_SHA = '50682517fb65fb632488d2075a6782d1e049956b84f61b91c4e9171d720b99a2'

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
    fs.readFileSync(path.join(REPO, 'qa-evidence/publication-batch-03-ocho/BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json'), 'utf8')
  )
  assert.strictEqual(clearance.owner_factual_hold_cleared, true)
  assert.strictEqual(clearance.owner_publication_authorized, true)
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.kirkenes_norway_factual_hold_cleared, false)
  assert.strictEqual(clearance.ocho_rios_proposed_content_hash, EXPECTED_HASH)

  const candidate = JSON.parse(
    fs.readFileSync(
      path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied/byAppPortId.ocho-rios.json'),
      'utf8'
    )
  )
  const candidateHash = crypto.createHash('sha256').update(stableStringify(candidate)).digest('hex')
  assert.strictEqual(candidateHash, EXPECTED_HASH)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  assert.strictEqual(countPassengerEditorialGuides(guides), 361)

  const guide = guides.byAppPortId[APP_ID]
  assert.ok(guide, 'ocho-rios slot')
  assert.strictEqual(guide.researchImport?.landing_slug, SLUG)
  assert.strictEqual(guide.researchImport?.owner_factual_hold_cleared, true)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, true)
  assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(guide.researchImport?.research_sha256, RESEARCH_SHA)
  assert.strictEqual(guide.researchImport?.proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(guide.size?.berthCount ?? null, null)
  assert.deepStrictEqual(guide.facts?.notableFeatures, [])
  assert.strictEqual((guide.thingsToDo?.topThings || []).length, 3)

  const tops = (guide.thingsToDo?.topThings || []).join('\n')
  assert.match(tops, /Dunn/i)
  assert.match(tops, /gangway walk|organised transfer/i)

  const kirkenes = guides.byAppPortId.kirkenes
  assert.notStrictEqual(kirkenes?.researchImport?.publication_tier, 'passenger_editorial', 'kirkenes unchanged')
  assert.notStrictEqual(kirkenes?.researchImport?.owner_factual_hold_cleared, true)

  const html = fs.readFileSync(path.join(REPO, 'ports', SLUG, 'index.html'), 'utf8')
  assert.ok(/noindex/i.test(html), 'ocho stays noindex')
  assert.ok(!/"berthCount":\s*2/.test(html), 'no berth count in html')
  assert.ok(/Turtle Beach Road/i.test(html))
  const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.strictEqual(plans, 3, 'three call plans')
  const ld = headJsonLdTypeCounts(html)
  assert.strictEqual(ld.TouristDestination, 1)
  assert.strictEqual(ld.BreadcrumbList, 1)
  assert.strictEqual(ld.FAQPage, 1)

  assert.ok(!fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8').includes(`/ports/${SLUG}/`), 'ocho not in sitemap')

  const rostock = fs.readFileSync(path.join(REPO, 'ports/rostock-germany/index.html'), 'utf8')
  assert.match(rostock, /warnemunde-berlin-germany/i)

  const eilat = guides.byAppPortId?.eilat
  assert.notStrictEqual(eilat?.researchImport?.owner_publication_authorized, true, 'eilat hold preserved')

  assertHistoricalPolicyPublicationGate(REPO, guides)

  console.log('test-batch03-ocho-rios-publication-release PASS', { pe: 361 })
}

main()

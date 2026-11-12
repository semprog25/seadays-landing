'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./stage65PublicationGuards')
const { assertHistoricalPolicyPublicationGate } = require('./historicalPolicyPublicationGate')
const { stableStringify } = require('../portResearchImport/jsonDiff')
const {
  assertBatch03OchoRiosReleaseInvariants,
  passengerEditorialSlugSet,
  headJsonLdTypeCounts,
} = require('./batch03OchoRiosReleaseBinding')
const { assertBatch03KirkenesReleaseInvariants } = require('./batch03KirkenesReleaseBinding')
const { TOKYO_PASSENGER_LEAD } = require('./tokyoYokohamaPassengerPatch')

const SLUG = 'tokyo-yokohama-japan'
const APP_ID = 'yokohama'
const EXPECTED_HASH = '5dbc4fe518f40e02e0abdd998e4d3bbc943bc5e9cc945364c840a6b75f493b88'
const RESEARCH_SHA = '7e1a1016bff4d827fe7fa1246531b3c242a8b9d5584b0c0126e917e3fbf6d017'
const BASELINE_PE = 362
const RELEASE_PE = 363
const CLEARANCE_REL = 'qa-evidence/publication-batch-04-tokyo/BATCH04_TOKYO_PUBLICATION_POLICY_CLEARANCE.json'
const ROLLBACK_GUIDES_REL =
  'qa-evidence/publication-batch-04-tokyo/rollback-pre-apply/tokyo-yokohama-japan/public-port-guides.json'
const CANDIDATE_GUIDE_REL =
  'qa-evidence/content-repair-batch04/candidate-applied/byAppPortId.yokohama.json'

function clearancePath(repoRoot) {
  return path.join(repoRoot, CLEARANCE_REL)
}

function loadBaselinePeSlugs(repoRoot) {
  const rollback = path.join(repoRoot, ROLLBACK_GUIDES_REL)
  assert.ok(fs.existsSync(rollback), `missing baseline rollback guides: ${ROLLBACK_GUIDES_REL}`)
  const baseline = JSON.parse(fs.readFileSync(rollback, 'utf8'))
  removeStage65ExcludedGuideEntries(baseline)
  assert.strictEqual(
    countPassengerEditorialGuides(baseline),
    BASELINE_PE,
    'rollback baseline must reflect PE 362',
  )
  return passengerEditorialSlugSet(baseline)
}

function assertNetNewPeSlugIsTokyoOnly(repoRoot, guides) {
  const baselineSlugs = loadBaselinePeSlugs(repoRoot)
  const liveSlugs = passengerEditorialSlugSet(guides)
  const added = [...liveSlugs].filter((s) => !baselineSlugs.has(s)).sort()
  const removed = [...baselineSlugs].filter((s) => !liveSlugs.has(s)).sort()
  assert.deepStrictEqual(removed, [], `unexpected PE demotions: ${removed.join(', ')}`)
  assert.deepStrictEqual(
    added,
    [SLUG],
    `net-new passenger_editorial slug must be only ${SLUG}; got: ${added.join(', ')}`,
  )
}

function assertTokyoPassengerContentGuards(guide, html) {
  const lead = String(guide.portInfo?.description || '').trim()
  assert.ok(lead.startsWith(TOKYO_PASSENGER_LEAD.slice(0, 60)), 'passenger lead must match approved Tokyo copy')
  assert.ok(!/Quay LOA for TICT/i.test(lead), 'no internal TICT LOA research language')
  assert.ok(!/Daikoku/i.test(lead + html), 'no unverified Daikoku claims')
  assert.ok(!/\"berthCount\":\s*\d/.test(html), 'html must not expose berthCount figures')
  assert.ok(!/terminalCount/i.test(html), 'html must not expose terminalCount')
  assert.strictEqual(guide.portName, 'Tokyo / Yokohama')
  assert.strictEqual(guide.size?.berthCount ?? null, null)
  assert.strictEqual(guide.size?.terminalCount ?? null, null)
  assert.ok(!guide.climate?.averageTemperature, 'no inherited climate stub')
  assert.ok(
    !guide.facts?.notableFeatures?.length,
    'facts.notableFeatures must remain empty',
  )
  assert.match(
    String(guide.politics?.visaRequirements || ''),
    /official government sources and your cruise line/i,
  )
  assert.match(String(guide.gettingThere?.fromTerminal || ''), /Osanbashi.*TICT|Harumi/i)
}

/**
 * Fail-closed binding for Batch 04 Tokyo/Yokohama release (PE 363).
 * @param {string} repoRoot
 * @param {object} [guidesInput]
 */
function assertBatch04TokyoReleaseBinding(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  assert.ok(fs.existsSync(clearancePath(repo)), `missing policy clearance: ${CLEARANCE_REL}`)

  const clearance = JSON.parse(fs.readFileSync(clearancePath(repo), 'utf8'))
  assert.strictEqual(clearance.owner_factual_hold_cleared, true)
  assert.strictEqual(clearance.owner_publication_authorized, true)
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.kirkenes_norway_publication_release_unchanged, true)
  assert.strictEqual(clearance.ocho_rios_publication_release_unchanged, true)
  assert.strictEqual(clearance.tokyo_yokohama_japan_proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(clearance.tokyo_yokohama_japan_research_sha256, RESEARCH_SHA)
  assert.strictEqual(clearance.baseline_live_passenger_editorial, BASELINE_PE)
  assert.strictEqual(clearance.projected_passenger_editorial_after_batch04_tokyo, RELEASE_PE)

  const candidatePath = path.join(repo, CANDIDATE_GUIDE_REL)
  assert.ok(fs.existsSync(candidatePath), 'missing pinned candidate guide artifact')
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'))
  const candidateHash = crypto.createHash('sha256').update(stableStringify(candidate)).digest('hex')
  assert.strictEqual(candidateHash, EXPECTED_HASH)

  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  assert.strictEqual(pe, RELEASE_PE, `batch04 tokyo release requires PE ${RELEASE_PE}`)

  assertNetNewPeSlugIsTokyoOnly(repo, guides)

  const guide = guides.byAppPortId[APP_ID]
  assert.ok(guide, 'yokohama slot')
  assert.strictEqual(guide.researchImport?.landing_slug, SLUG)
  assert.strictEqual(guide.researchImport?.owner_factual_hold_cleared, true)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, true)
  assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(guide.researchImport?.research_sha256, RESEARCH_SHA)
  assert.strictEqual(guide.researchImport?.proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(guide.researchImport?.batch04_tokyo_publication_release, true)
  assert.notStrictEqual(guide.researchImport?.batch04_preparation_only, true)

  const tops = guide.thingsToDo?.topThings || []
  assert.strictEqual(tops.length, 3)

  const htmlPath = path.join(repo, 'ports', SLUG, 'index.html')
  assert.ok(fs.existsSync(htmlPath), 'missing tokyo port html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(/noindex,\s*follow/i.test(html), 'tokyo must stay noindex,follow until indexing authorization')
  assertTokyoPassengerContentGuards(guide, html)

  const td = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"TouristDestination"[\s\S]*?\})<\/script>/,
  )
  assert.ok(td, 'TouristDestination block')
  const tdJson = JSON.parse(td[1])
  const lead = String(guide.portInfo?.description || '').trim()
  assert.ok(tdJson.description.startsWith(lead.slice(0, 80)), 'TouristDestination uses passenger lead')

  const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.strictEqual(plans, 3)

  const ld = headJsonLdTypeCounts(html)
  assert.strictEqual(ld.FAQPage, 1)

  const sitemap = fs.readFileSync(path.join(repo, 'sitemap.xml'), 'utf8')
  assert.ok(!sitemap.includes(`/ports/${SLUG}/`), 'tokyo must not be in sitemap')

  const pinnedHtml = path.join(
    repo,
    'qa-evidence/content-repair-batch04/candidate-applied/ports/tokyo-yokohama-japan/index.html',
  )
  assert.ok(fs.existsSync(pinnedHtml), 'missing pinned candidate html')
  const pinnedBody = fs.readFileSync(pinnedHtml, 'utf8')
  assert.ok(
    html.includes(TOKYO_PASSENGER_LEAD.slice(0, 80)),
    'live html must include approved passenger lead',
  )
  assert.ok(
    pinnedBody.includes(TOKYO_PASSENGER_LEAD.slice(0, 80)),
    'pinned candidate html must include approved passenger lead',
  )

  assertBatch03KirkenesReleaseInvariants(repo, guides)
  assertBatch03OchoRiosReleaseInvariants(repo, guides)
  assertHistoricalPolicyPublicationGate(repo, guides)

  return { pe: RELEASE_PE, slug: SLUG, app_port_id: APP_ID }
}

module.exports = {
  APP_ID,
  SLUG,
  EXPECTED_HASH,
  RESEARCH_SHA,
  BASELINE_PE,
  RELEASE_PE,
  CLEARANCE_REL,
  CANDIDATE_GUIDE_REL,
  assertBatch04TokyoReleaseBinding,
  assertTokyoPassengerContentGuards,
}

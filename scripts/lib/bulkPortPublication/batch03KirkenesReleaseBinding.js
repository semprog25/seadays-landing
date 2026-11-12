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
} = require('./batch03OchoRiosReleaseBinding')

const SLUG = 'kirkenes-norway'
const APP_ID = 'kirkenes'
const EXPECTED_HASH = '85dbe2f90be7aeb98d61b8f85678b6f10a56bee2dac9e219cbec784d0e0d5294'
const RESEARCH_SHA = '7fb39713a569246163e51f762bdff77d2b473351c4f8b884077ebf752a914fe8'
const BASELINE_PE = 361
const RELEASE_PE = 362
const CLEARANCE_REL = 'qa-evidence/publication-batch-03-kirkenes/BATCH03_KIRKENES_PUBLICATION_POLICY_CLEARANCE.json'
const ROLLBACK_GUIDES_REL =
  'qa-evidence/publication-batch-03-kirkenes/rollback-pre-apply/kirkenes-norway/public-port-guides.json'

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
    'rollback baseline must reflect PE 361',
  )
  return passengerEditorialSlugSet(baseline)
}

function assertNetNewPeSlugIsKirkenesOnly(repoRoot, guides) {
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

/**
 * Fail-closed binding for Batch 03 Kirkenes release (PE 362). Preserves Ocho PE 361 invariants.
 * @param {string} repoRoot
 * @param {object} [guidesInput]
 */
function assertBatch03KirkenesReleaseInvariants(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  const guide = guides.byAppPortId[APP_ID]
  assert.ok(guide, 'kirkenes slot')
  assert.strictEqual(guide.researchImport?.landing_slug, SLUG)
  assert.strictEqual(guide.researchImport?.owner_factual_hold_cleared, true)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, true)
  assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(guide.researchImport?.research_sha256, RESEARCH_SHA)
  assert.strictEqual(guide.researchImport?.proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(guide.size?.berthCount ?? null, null)
  assert.deepStrictEqual(guide.facts?.notableFeatures, [])

  const tops = guide.thingsToDo?.topThings || []
  assert.strictEqual(tops.length, 3)
  const topsText = tops.join('\n')
  assert.match(topsText, /Dypvannskaia/i)
  assert.match(topsText, /Borderland Museum|Grenselandsmuseet/i)
  assert.match(topsText, /King crab/i)

  const htmlPath = path.join(repo, 'ports', SLUG, 'index.html')
  assert.ok(fs.existsSync(htmlPath), 'missing kirkenes port html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(/noindex/i.test(html), 'kirkenes must stay noindex')
  assert.ok(!/"berthCount":\s*2/.test(html))
  const lead = String(guide.portInfo?.description || '').trim()
  const td = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"TouristDestination"[\s\S]*?\})<\/script>/,
  )
  assert.ok(td, 'TouristDestination block')
  const tdJson = JSON.parse(td[1])
  assert.ok(tdJson.description.startsWith(lead.slice(0, 80)), 'TouristDestination uses passenger lead')
  assert.ok(!/Girkonjárga|Kirkkoniemi/i.test(tdJson.description), 'no wiki dump in JSON-LD')
  const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.strictEqual(plans, 3)

  const sitemap = fs.readFileSync(path.join(repo, 'sitemap.xml'), 'utf8')
  assert.ok(!sitemap.includes(`/ports/${SLUG}/`), 'kirkenes must not be in sitemap')
}

function assertBatch03KirkenesReleaseBinding(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  assert.ok(fs.existsSync(clearancePath(repo)), `missing policy clearance: ${CLEARANCE_REL}`)

  const clearance = JSON.parse(fs.readFileSync(clearancePath(repo), 'utf8'))
  assert.strictEqual(clearance.owner_factual_hold_cleared, true)
  assert.strictEqual(clearance.owner_publication_authorized, true)
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.ocho_rios_publication_release_unchanged, true)
  assert.strictEqual(clearance.kirkenes_norway_proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(clearance.kirkenes_norway_research_sha256, RESEARCH_SHA)
  assert.strictEqual(clearance.baseline_live_passenger_editorial, BASELINE_PE)
  assert.strictEqual(clearance.projected_passenger_editorial_after_batch03_kirkenes, RELEASE_PE)

  const candidatePath = path.join(
    repo,
    'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied/byAppPortId.kirkenes.json',
  )
  assert.ok(fs.existsSync(candidatePath), 'missing pinned candidate guide artifact')
  const candidate = JSON.parse(fs.readFileSync(candidatePath, 'utf8'))
  const candidateHash = crypto.createHash('sha256').update(stableStringify(candidate)).digest('hex')
  assert.strictEqual(candidateHash, EXPECTED_HASH)

  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  assert.strictEqual(pe, RELEASE_PE, `batch03 kirkenes release requires PE ${RELEASE_PE}`)

  assertNetNewPeSlugIsKirkenesOnly(repo, guides)

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
  assertBatch03KirkenesReleaseBinding,
  assertBatch03KirkenesReleaseInvariants,
}

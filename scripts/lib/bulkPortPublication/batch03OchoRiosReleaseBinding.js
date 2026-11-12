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

const SLUG = 'ocho-rios-jamaica'
const APP_ID = 'ocho-rios'
const EXPECTED_HASH = '5635233496acf009f81ec86289e3a165bfb1d93302deaee74709a71f47b3032e'
const RESEARCH_SHA = '50682517fb65fb632488d2075a6782d1e049956b84f61b91c4e9171d720b99a2'
const BASELINE_PE = 360
const RELEASE_PE = 361
const CLEARANCE_REL = 'qa-evidence/publication-batch-03-ocho/BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json'
const ROLLBACK_GUIDES_REL =
  'qa-evidence/publication-batch-03-ocho/rollback-pre-apply/ocho-rios-jamaica/public-port-guides.json'

function clearancePath(repoRoot) {
  return path.join(repoRoot, CLEARANCE_REL)
}

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

function passengerEditorialSlugSet(guides) {
  const out = new Set()
  for (const guide of Object.values(guides?.byAppPortId || {})) {
    if (guide?.researchImport?.publication_tier !== 'passenger_editorial') continue
    const slug = guide?.researchImport?.landing_slug
    if (slug) out.add(slug)
  }
  return out
}

function loadBaselinePeSlugs(repoRoot) {
  const rollback = path.join(repoRoot, ROLLBACK_GUIDES_REL)
  assert.ok(fs.existsSync(rollback), `missing baseline rollback guides: ${ROLLBACK_GUIDES_REL}`)
  const baseline = JSON.parse(fs.readFileSync(rollback, 'utf8'))
  removeStage65ExcludedGuideEntries(baseline)
  assert.strictEqual(
    countPassengerEditorialGuides(baseline),
    BASELINE_PE,
    'rollback baseline must reflect PE 360',
  )
  return passengerEditorialSlugSet(baseline)
}

function assertNetNewPeSlugIsOchoOnly(repoRoot, guides) {
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
 * Ocho Rios release invariants — safe to assert alongside Kirkenes at PE 362.
 * @param {string} repoRoot
 * @param {object} guides
 */
function assertBatch03OchoRiosReleaseInvariants(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  assert.ok(fs.existsSync(clearancePath(repo)), `missing policy clearance: ${CLEARANCE_REL}`)
  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)

  const clearance = JSON.parse(fs.readFileSync(clearancePath(repo), 'utf8'))
  assert.strictEqual(clearance.owner_factual_hold_cleared, true)
  assert.strictEqual(clearance.owner_publication_authorized, true)
  assert.strictEqual(clearance.owner_indexing_authorized, false)
  assert.strictEqual(clearance.ocho_rios_proposed_content_hash, EXPECTED_HASH)
  assert.strictEqual(clearance.ocho_rios_research_sha256, RESEARCH_SHA)

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

  const tops = guide.thingsToDo?.topThings || []
  assert.strictEqual(tops.length, 3)
  const topsText = tops.join('\n')
  assert.match(topsText, /Dunn/i)
  assert.match(topsText, /gangway walk|organised transfer/i)

  const eilat = guides.byAppPortId?.eilat
  assert.notStrictEqual(eilat?.researchImport?.owner_publication_authorized, true)

  const htmlPath = path.join(repo, 'ports', SLUG, 'index.html')
  assert.ok(fs.existsSync(htmlPath), 'missing ocho port html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(/noindex/i.test(html), 'ocho must stay noindex')
  assert.ok(!/"berthCount":\s*2/.test(html))
  assert.ok(/Turtle Beach Road/i.test(html))
  const plans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.strictEqual(plans, 3)
  const ld = headJsonLdTypeCounts(html)
  assert.strictEqual(ld.TouristDestination, 1)
  assert.strictEqual(ld.BreadcrumbList, 1)
  assert.strictEqual(ld.FAQPage, 1)

  const sitemap = fs.readFileSync(path.join(repo, 'sitemap.xml'), 'utf8')
  assert.ok(!sitemap.includes(`/ports/${SLUG}/`), 'ocho must not be in sitemap')

  const rostock = fs.readFileSync(path.join(repo, 'ports/rostock-germany/index.html'), 'utf8')
  assert.match(rostock, /warnemunde-berlin-germany/i)
}

/**
 * Fail-closed binding for Batch 03 Ocho Rios release (PE 361).
 * @param {string} repoRoot
 * @param {object} [guidesInput] optional pre-loaded guides (mutated exclusions applied)
 */
function assertBatch03OchoRiosReleaseBinding(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')

  const clearance = JSON.parse(fs.readFileSync(clearancePath(repo), 'utf8'))
  assert.strictEqual(clearance.kirkenes_norway_factual_hold_cleared, false)
  assert.strictEqual(clearance.baseline_live_passenger_editorial, BASELINE_PE)
  assert.strictEqual(clearance.projected_passenger_editorial_after_batch03_ocho, RELEASE_PE)

  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  assert.strictEqual(pe, RELEASE_PE, `batch03 ocho release requires PE ${RELEASE_PE}`)

  assertNetNewPeSlugIsOchoOnly(repo, guides)

  const kirkenes = guides.byAppPortId.kirkenes
  assert.notStrictEqual(kirkenes?.researchImport?.publication_tier, 'passenger_editorial')
  assert.notStrictEqual(kirkenes?.researchImport?.owner_factual_hold_cleared, true)

  assertBatch03OchoRiosReleaseInvariants(repo, guides)
  assertHistoricalPolicyPublicationGate(repo, guides)

  return { pe: RELEASE_PE, slug: SLUG, app_port_id: APP_ID }
}

/**
 * @param {string} repoRoot
 * @param {object} [guidesInput]
 */
function assertPagesPassengerEditorialPePolicy(repoRoot, guidesInput) {
  const kirkenesBinding = require('./batch03KirkenesReleaseBinding')
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  const hasOchoClearance = fs.existsSync(clearancePath(repo))
  const hasKirkenesClearance = fs.existsSync(path.join(repo, kirkenesBinding.CLEARANCE_REL))
  const kirkenesLive =
    guides.byAppPortId.kirkenes?.researchImport?.publication_tier === 'passenger_editorial' &&
    guides.byAppPortId.kirkenes?.researchImport?.owner_publication_authorized === true

  if (pe === BASELINE_PE) {
    if (hasOchoClearance) {
      throw new Error(
        'batch03 ocho policy clearance present but passenger_editorial count still 360 (incomplete or spoofed release)',
      )
    }
    return { pe, mode: 'baseline' }
  }

  if (hasKirkenesClearance && pe === kirkenesBinding.BASELINE_PE && !kirkenesLive) {
    throw new Error(
      'batch03 kirkenes policy clearance present but passenger_editorial count still 361 (incomplete or spoofed release)',
    )
  }

  if (pe === RELEASE_PE && !kirkenesLive) {
    assertBatch03OchoRiosReleaseBinding(repo, guides)
    return { pe, mode: 'batch03_ocho_release' }
  }

  if (pe === kirkenesBinding.RELEASE_PE) {
    if (hasKirkenesClearance) {
      kirkenesBinding.assertBatch03KirkenesReleaseBinding(repo, guides)
      return { pe, mode: 'batch03_kirkenes_release' }
    }
    throw new Error(
      'passenger editorial count 362 but missing batch03 Kirkenes policy clearance (incomplete or spoofed release)',
    )
  }

  throw new Error(
    `passenger editorial count ${pe} not allowed (expected ${BASELINE_PE}, ${RELEASE_PE} with Ocho, or ${kirkenesBinding.RELEASE_PE} with Kirkenes)`,
  )
}

module.exports = {
  APP_ID,
  SLUG,
  EXPECTED_HASH,
  RESEARCH_SHA,
  BASELINE_PE,
  RELEASE_PE,
  CLEARANCE_REL,
  assertBatch03OchoRiosReleaseBinding,
  assertBatch03OchoRiosReleaseInvariants,
  assertPagesPassengerEditorialPePolicy,
  passengerEditorialSlugSet,
  headJsonLdTypeCounts,
}

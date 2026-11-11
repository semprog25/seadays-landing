#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { STAGE43_HARD_EXCLUDE_HISTORICAL } = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { assertHistoricalPolicyPublicationGate: assertGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate')
const { buildPortAliasRedirectMap } = require('./lib/portBrowseAliases')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/publication-batch-02')
const MANIFEST_PATH = path.join(EVIDENCE, 'BATCH_02_MANIFEST.json')
const PUBLICATION_CLEARANCE_PATH = path.join(EVIDENCE, 'BATCH_02_PUBLICATION_POLICY_CLEARANCE.json')
const SLUG = 'mormugao-port-goa-india'
const APP_ID = 'mormugao'

function loadPublicationClearance() {
  if (!fs.existsSync(PUBLICATION_CLEARANCE_PATH)) return null
  return JSON.parse(fs.readFileSync(PUBLICATION_CLEARANCE_PATH, 'utf8'))
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
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

function assertGoaAliasUnchanged(clearance) {
  const aliases = buildPortAliasRedirectMap()
  assert.strictEqual(aliases['goa-india'], 'mormugao-port-goa-india')
  const goaHtml = fs.readFileSync(path.join(REPO, 'ports/goa-india/index.html'), 'utf8')
  assert.ok(/mormugao-port-goa-india/.test(goaHtml), 'goa-india redirect target')
  assert.ok(/noindex/i.test(goaHtml), 'goa-india stays noindex')
  assert.ok(
    /rel=["']canonical["'][^>]+mormugao-port-goa-india/.test(goaHtml),
    'goa-india canonical → Mormugao'
  )
  const prodMormugao = fs.readFileSync(path.join(REPO, 'ports', SLUG, 'index.html'), 'utf8')
  const callPlansProd = (prodMormugao.match(/<article class="pg-call-plan-card/g) || []).length
  const published = clearance?.owner_publication_authorized === true
  if (published) {
    assert.ok(callPlansProd >= 3, 'production Mormugao PE html')
  } else {
    assert.ok(callPlansProd < 3, 'production Mormugao must stay stub (<3 call plans)')
  }
  assert.ok(/noindex/i.test(prodMormugao), 'production Mormugao noindex')
}

function assertProductionPe(clearance) {
  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const expectedPe =
    clearance?.owner_publication_authorized === true
      ? clearance.projected_passenger_editorial_after_batch02
      : manifestBaselinePe()
  assert.strictEqual(countPassengerEditorialGuides(guides), expectedPe)
  delete process.env.SEADAYS_PUBLICATION_BATCH_01_CANDIDATE
  delete process.env.SEADAYS_STAGE89_BODO_CANDIDATE
  assertGate(REPO, guides)
}

function manifestBaselinePe() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  return manifest.baseline_live_passenger_editorial
}

function main() {
  const clearance = loadPublicationClearance()
  const productionPublished = clearance?.owner_publication_authorized === true

  const goaDecision = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE, 'GOA_CANONICAL_OWNER_DECISION.json'), 'utf8')
  )
  assert.strictEqual(goaDecision.owner_decision, 'APPROVE_GOA_CANONICAL_IDENTITY')
  assert.strictEqual(goaDecision.owner_publication_authorized, false)
  assert.strictEqual(goaDecision.canonical_landing_slug, SLUG)
  assert.strictEqual(goaDecision.alias_landing_slug, 'goa-india')

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 359)
  assert.strictEqual(manifest.candidates.length, 1)
  assert.ok(!manifest.excluded_slugs.includes(SLUG))
  assert.ok(manifest.excluded_slugs.includes('eilat-israel'))
  assert.ok(manifest.excluded_slugs.includes('goa-india'))

  const matrixPath = path.join(EVIDENCE, 'REMAINING_PORT_STATUS_MATRIX.json')
  assert.ok(fs.existsSync(matrixPath), 'run publication-batch-02-workflow matrix first')
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'))
  assert.strictEqual(matrix.baseline.live_passenger_editorial, 359)
  assert.strictEqual(matrix.baseline.remaining_unpublished, 47)

  assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(SLUG))
  assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has('goa-india'))

  const prepPath = path.join(EVIDENCE, 'PREP_MANIFEST.json')
  const applyPath = path.join(EVIDENCE, 'APPLY_REPORT.json')
  if (!productionPublished && (!fs.existsSync(prepPath) || !fs.existsSync(applyPath))) {
    execSync('node scripts/publication-batch-02-workflow.js prepare', { cwd: REPO, stdio: 'inherit' })
    execSync('node scripts/publication-batch-02-workflow.js apply', {
      cwd: REPO,
      stdio: 'inherit',
      env: { ...process.env, SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1' },
    })
  }

  const candidate = manifest.candidates[0]
  const candDir = path.join(EVIDENCE, 'candidates', SLUG)
  const htmlPath = path.join(candDir, 'ports', SLUG, 'index.html')
  const guidePath = path.join(candDir, `byAppPortId.${APP_ID}.json`)
  assert.ok(fs.existsSync(htmlPath), 'candidate html')
  assert.ok(fs.existsSync(guidePath), 'candidate guide')

  const prodGuidesBefore = productionPublished ? null : sha256File(path.join(REPO, 'data/public-port-guides.json'))

  const html = fs.readFileSync(htmlPath, 'utf8')
  const callPlans = (html.match(/<article class="pg-call-plan-card/g) || []).length
  assert.ok(callPlans >= 3, `candidate needs 3 call plans, got ${callPlans}`)
  assert.ok(/noindex/i.test(html), 'candidate noindex')
  assert.ok(html.includes('seadays-web-pmormugao'), 'Viator campaign')

  const ld = headJsonLdTypeCounts(html)
  assert.strictEqual(ld.TouristDestination, 1)
  assert.strictEqual(ld.BreadcrumbList, 1)
  assert.strictEqual(ld.FAQPage, 1)

  const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'))
  assert.strictEqual(guide.researchImport?.research_sha256, candidate.research_sha256)
  assert.strictEqual(guide.researchImport?.qa_verdict, 'PASS')
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, false)
  assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
  assert.deepStrictEqual(guide.researchImport?.verified_factual_field_exclusions, ['thingsToDo.topThings[2]'])

  assertGoaAliasUnchanged(clearance)
  assertProductionPe(clearance)

  if (!productionPublished) {
    const prodGuidesAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'))
    assert.strictEqual(prodGuidesAfter, prodGuidesBefore, 'public-port-guides.json unchanged after apply')
  }

  execSync('node scripts/test-port-seo-redirects.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/test-port-guide-human-approved-hero.js', { cwd: REPO, stdio: 'pipe' })

  execSync('node scripts/assert-pages-deploy-publication-gate.js', {
    cwd: REPO,
    stdio: 'pipe',
    env: { ...process.env, SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1' },
  })

  execSync('node scripts/test-wave01-publication-release.js', { cwd: REPO, stdio: 'pipe' })
  if (productionPublished) {
    execSync('node scripts/test-batch02-mormugao-publication-release.js', { cwd: REPO, stdio: 'pipe' })
  }
  execSync('node scripts/test-historical-policy-pages-deploy-gate.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/test-publication-batch-apply-safety.js', {
    cwd: REPO,
    stdio: 'pipe',
    env: { ...process.env, SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1' },
  })

  const rollback = path.join(EVIDENCE, 'rollback-pre-apply', SLUG)
  assert.ok(fs.existsSync(path.join(rollback, 'public-port-guides.json')), 'rollback guides snapshot')
  assert.ok(fs.existsSync(path.join(rollback, 'ports', SLUG, 'index.html')), 'rollback html snapshot')

  console.log('test-publication-batch-02-mormugao PASS', {
    pe: productionPublished ? clearance.projected_passenger_editorial_after_batch02 : 359,
    projected_if_merged: 360,
    production_published: productionPublished,
    candidate_hash: candidate.proposed_content_hash,
  })
}

main()

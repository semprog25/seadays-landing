#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { loadResearchIndex } = require('./lib/portResearchImport/buildIdentifierManifest')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { gateManifestForApply } = require('./lib/portResearchImport/applyPortResearch')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage82-hamburg-graduation')
const LANDING_SLUG = 'hamburg-germany'
const APP_PORT_ID = 'hamburg'
const PRODUCTION_BASELINE_MAIN = '0d1d845345b191e2b44ecd393062213e88fd3946'
const RESEARCH_MAIN_PIN = 'e5680f19d3ea86ce2261c3027894f2a45124e36b'
const EXPECTED_RESEARCH_SHA = 'e563b7c1ef6dd455adf4a08a1576388e73bc8c3bfccb4e93f4b2d5a01ddf1e82'

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE82_PREP_STOP', message: msg }, null, 2))
  process.exit(42)
}

function main() {
  let mainHead = ''
  try {
    mainHead = execSync('git rev-parse origin/main', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    fail('cannot resolve origin/main')
  }
  if (mainHead !== PRODUCTION_BASELINE_MAIN) {
    fail(`expected production main ${PRODUCTION_BASELINE_MAIN} (got ${mainHead})`)
  }

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const livePe = countPassengerEditorialGuides(guides)
  if (livePe !== 355) fail(`live passenger editorial baseline ${livePe} !== 355`)

  const hamburg = guides.byAppPortId?.[APP_PORT_ID]
  if (!hamburg) fail('missing hamburg guide slot')
  if (usesPassengerEditorialLead(hamburg)) fail('hamburg already passenger_editorial — not an upgrade candidate')

  const patchPath = path.join(EVIDENCE, 'COMPOSITE_SHA_PATCH.json')
  if (!fs.existsSync(patchPath)) fail('missing COMPOSITE_SHA_PATCH.json')
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'))
  if (patch.verified_research_commit !== RESEARCH_MAIN_PIN) {
    fail(`research pin ${patch.verified_research_commit} !== ${RESEARCH_MAIN_PIN}`)
  }

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const index = loadResearchIndex(compositeRoot)
    const indexRow = index.find((p) => p.slug === LANDING_SLUG)
    if (!indexRow) fail('hamburg missing from PORTS_MASTER_INDEX')
    if (indexRow.qa_verdict !== 'PASS') fail(`qa_verdict ${indexRow.qa_verdict} !== PASS`)
    if (indexRow.sha256 !== EXPECTED_RESEARCH_SHA) {
      fail(`index sha ${indexRow.sha256} !== expected ${EXPECTED_RESEARCH_SHA}`)
    }

    const sha = verifyResearchPortSha({
      researchRoot: compositeRoot,
      landingSlug: LANDING_SLUG,
      manifestRow: { landing_slug: LANDING_SLUG, sha256: EXPECTED_RESEARCH_SHA },
    })
    if (!sha.ok) fail(`research sha verify: ${sha.reason}`)

    const manifestRow = {
      landing_slug: LANDING_SLUG,
      app_port_id: APP_PORT_ID,
      sha256: EXPECTED_RESEARCH_SHA,
      qa_verdict: 'PASS',
      research_status: indexRow.research_status,
      identifier_status: 'resolved',
      has_public_port_guide: true,
    }
    const blockers = gateManifestForApply(manifestRow)
    if (blockers.length) fail(`gateManifestForApply blockers: ${blockers.join(',')}`)
  } finally {
    cleanup()
  }

  const leakBlob = collectGuidePassengerLeakBlob(hamburg)
  if (containsInternalResearchLeak(leakBlob)) fail('existing hamburg JSON has internal research leak')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  if (!fs.existsSync(htmlPath)) fail('missing hamburg index.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) fail('expected pilot noindex on hamburg html before graduation apply')

  const callPlanCards = (html.match(/<article class="pg-call-plan-card/g) || []).length
  if (callPlanCards < 3) fail(`expected >=3 call-plan cards, got ${callPlanCards}`)

  const proposedResearchImport = {
    landing_slug: LANDING_SLUG,
    app_port_id: APP_PORT_ID,
    publication_tier: 'passenger_editorial',
    qa_verdict: 'PASS',
    research_sha256: EXPECTED_RESEARCH_SHA,
    research_main_pin: RESEARCH_MAIN_PIN,
    stage82_hamburg_graduation_candidate: true,
    stage82_pilot_upgrade_in_place: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    identifier_confidence: 'review_key_picker_id',
    prepared_at_utc: new Date().toISOString(),
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  const prepManifest = {
    schema_version: 1,
    stage: 'stage82-hamburg-graduation-prep',
    status: 'READY_FOR_OWNER_REVIEW',
    landing_slug: LANDING_SLUG,
    app_port_id: APP_PORT_ID,
    upgrade_in_place: true,
    net_new_slug: false,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    production_apply_permitted: false,
    baseline_main: PRODUCTION_BASELINE_MAIN,
    baseline_live_passenger_editorial: 355,
    projected_passenger_editorial_if_merged: 356,
    research_main_pin: RESEARCH_MAIN_PIN,
    research_sha256: EXPECTED_RESEARCH_SHA,
    qa_verdict: 'PASS',
    proposed_researchImport: proposedResearchImport,
    pilot_robots_before: 'noindex, follow',
    canonical_url: 'https://seadays.app/ports/hamburg-germany/',
    call_plan_card_count_baseline: callPlanCards,
    viator_campaign_present: /campaign=seadays-web-phamburg/i.test(html),
    created_at_utc: new Date().toISOString(),
  }
  const bundleHash = crypto.createHash('sha256').update(JSON.stringify(prepManifest)).digest('hex')
  prepManifest.bundle_idempotency_hash = bundleHash

  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE82_PREP_MANIFEST.json'),
    `${JSON.stringify(prepManifest, null, 2)}\n`,
    'utf8'
  )
  fs.writeFileSync(
    path.join(EVIDENCE, 'PROPOSED_RESEARCH_IMPORT.json'),
    `${JSON.stringify(proposedResearchImport, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify({ ok: true, bundle_hash: bundleHash, projected: 356 }, null, 2))
}

main()

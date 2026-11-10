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
const { gateManifestForApply } = require('./lib/portResearchImport/applyPortResearch')
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  buildPublishedSlugSet,
  exclusionReasonForSlug,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate')
const POLICY = path.join(EVIDENCE, 'STAGE89_POLICY_CLEARANCE.json')
const PRODUCTION_BASELINE_MAIN = 'd9f3a8e7eaeb51c80a3b54813d1f815064974758'
const LANDING_SLUG = 'bod-norway'
const APP_PORT_ID = 'bodo'
const EXPECTED_RESEARCH_SHA = '937ad03d7b3d328d8f147f3824f9d6dce461c9349b5b06aecdb33e2b11a434a5'
const PROPOSED_REF = 'qa-evidence/stage53-11-port-release/proposed-guides/bod-norway.json'
const EXPECTED_PROPOSED_HASH = '0882826222fe39fcb697de28ae021dfac5e3e025bb225e844ba7ce505a6790be'
const RESEARCH_MAIN_PIN = 'e5680f19d3ea86ce2261c3027894f2a45124e36b'

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE89_PREP_STOP', message: msg }, null, 2))
  process.exit(42)
}

function main() {
  if (!fs.existsSync(POLICY)) fail('missing STAGE89_POLICY_CLEARANCE.json')
  const clearance = JSON.parse(fs.readFileSync(POLICY, 'utf8'))
  if (clearance.owner_publication_authorized === true || clearance.owner_indexing_authorized === true) {
    fail('owner auth flags must remain false on policy clearance')
  }
  if (clearance.owner_conditional_prep_authorized !== true) {
    fail('owner_conditional_prep_authorized must be true')
  }

  let mainHead = ''
  try {
    mainHead = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    fail('cannot resolve HEAD')
  }
  if (mainHead !== PRODUCTION_BASELINE_MAIN) {
    fail(`expected baseline HEAD ${PRODUCTION_BASELINE_MAIN} (got ${mainHead})`)
  }

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const livePe = countPassengerEditorialGuides(guides)
  if (livePe !== 356) fail(`live passenger editorial baseline ${livePe} !== 356`)

  const bodo = guides.byAppPortId?.[APP_PORT_ID]
  if (!bodo) fail('missing bodo guide slot')
  if (usesPassengerEditorialLead(bodo)) fail('bodo already passenger_editorial')

  if (!STAGE43_HARD_EXCLUDE_HISTORICAL.has(LANDING_SLUG)) {
    fail('historical hard-exclude ledger missing bod-norway')
  }

  const publishedSet = buildPublishedSlugSet(REPO)
  const prodExclusion = exclusionReasonForSlug(LANDING_SLUG, publishedSet)
  if (prodExclusion !== 'stage43_hard_exclude') {
    fail(`expected production stage43_hard_exclude, got ${prodExclusion}`)
  }

  const proposedPath = path.join(REPO, PROPOSED_REF)
  if (!fs.existsSync(proposedPath)) fail(`missing ${PROPOSED_REF}`)
  const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
  const proposedHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
  if (proposedHash !== EXPECTED_PROPOSED_HASH) {
    fail(`proposed content hash mismatch: ${proposedHash}`)
  }
  if (proposed.researchImport?.research_sha256 !== EXPECTED_RESEARCH_SHA) {
    fail('proposed research_sha256 mismatch')
  }

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
    if (!indexRow) fail('bod-norway missing from PORTS_MASTER_INDEX')
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

  const leakBlob = collectGuidePassengerLeakBlob(proposed)
  if (containsInternalResearchLeak(leakBlob)) fail('proposed guide has internal research leak')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  if (!fs.existsSync(htmlPath)) fail('missing bod-norway index.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) fail('expected noindex on baseline bod html')
  if (!html.includes('campaign=seadays-web-sbod-norway')) fail('expected existing Viator campaign on baseline html')

  fs.mkdirSync(EVIDENCE, { recursive: true })
  const prepManifest = {
    schema_version: 1,
    stage: 'stage89-bodo-candidate-prep',
    status: 'READY_FOR_OWNER_REVIEW',
    landing_slug: LANDING_SLUG,
    app_port_id: APP_PORT_ID,
    net_new_passenger_editorial: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    production_apply_permitted: false,
    candidate_apply_permitted: true,
    conditional_policy_clearance_ref: 'qa-evidence/stage89-bodo-candidate/STAGE89_POLICY_CLEARANCE.json',
    baseline_main: PRODUCTION_BASELINE_MAIN,
    baseline_live_passenger_editorial: 356,
    projected_passenger_editorial_if_merged: 357,
    research_main_pin: RESEARCH_MAIN_PIN,
    research_sha256: EXPECTED_RESEARCH_SHA,
    qa_verdict: 'PASS',
    proposed_guide_ref: PROPOSED_REF,
    proposed_content_hash: EXPECTED_PROPOSED_HASH,
    stage53_stage28_evidence_reused: true,
    historical_stage43_active_exclude: true,
    canonical_url: 'https://seadays.app/ports/bod-norway/',
    pilot_robots_before: 'noindex, follow',
    created_at_utc: new Date().toISOString(),
  }
  const bundleHash = crypto.createHash('sha256').update(JSON.stringify(prepManifest)).digest('hex')
  prepManifest.bundle_idempotency_hash = bundleHash

  fs.writeFileSync(path.join(EVIDENCE, 'STAGE89_PREP_MANIFEST.json'), `${JSON.stringify(prepManifest, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ ok: true, bundle_hash: bundleHash, projected: 357 }, null, 2))
}

main()

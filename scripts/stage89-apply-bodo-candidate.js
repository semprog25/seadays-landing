#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { replaceRobotsMeta } = require('./lib/adsenseIndexability')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { extractTravelerQuestions } = require('./lib/portResearchImport/extractMarkdownSections')
const { readResearchMarkdown } = require('./lib/portResearchImport/transformResearchToPublic')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate')
const PREP_MANIFEST = path.join(EVIDENCE, 'STAGE89_PREP_MANIFEST.json')
const LANDING_SLUG = 'bod-norway'
const APP_PORT_ID = 'bodo'

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE89_APPLY_STOP', message: msg }, null, 2))
  process.exit(42)
}

function mergeTravelerQuestionsFromResearch(compositeRoot, guide) {
  const body = readResearchMarkdown(compositeRoot, LANDING_SLUG)
  const travelerQuestions = extractTravelerQuestions(body)
  if (!travelerQuestions || !travelerQuestions.length) return guide
  guide.researchImport = { ...(guide.researchImport || {}), travelerQuestions }
  return guide
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (process.env.SEADAYS_STAGE89_BODO_CANDIDATE !== '1') {
    fail('set SEADAYS_STAGE89_BODO_CANDIDATE=1 for local candidate apply only')
  }
  if (!fs.existsSync(PREP_MANIFEST)) fail('run stage89-prepare-bodo-candidate.js first')
  const prep = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  if (prep.owner_publication_authorized === true || prep.production_apply_permitted === true) {
    fail('authorization flags must remain false on prep manifest')
  }
  if (prep.candidate_apply_permitted !== true) fail('candidate_apply_permitted must be true')

  const patchPath = path.join(EVIDENCE, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const sha = verifyResearchPortSha({
      researchRoot: compositeRoot,
      landingSlug: LANDING_SLUG,
      manifestRow: { landing_slug: LANDING_SLUG, sha256: prep.research_sha256 },
    })
    if (!sha.ok) fail(`research sha ${sha.reason}`)
  } finally {
    cleanup()
  }

  const guidesBefore = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guidesBefore)
  const prior = guidesBefore.byAppPortId?.[APP_PORT_ID]
  if (!prior) fail('missing bodo guide')
  if (usesPassengerEditorialLead(prior)) fail('bodo already passenger_editorial')

  const proposedPath = path.join(REPO, prep.proposed_guide_ref)
  const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
  const contentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
  if (contentHash !== prep.proposed_content_hash) fail('proposed content hash mismatch')

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  if (!dryRun) {
    fs.mkdirSync(path.join(rollbackDir, 'ports', LANDING_SLUG), { recursive: true })
    fs.mkdirSync(EVIDENCE, { recursive: true })
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'))
    fs.copyFileSync(path.join(REPO, 'ports', LANDING_SLUG, 'index.html'), path.join(rollbackDir, 'ports', LANDING_SLUG, 'index.html'))
  }

  const appliedAt = new Date().toISOString()
  let g = JSON.parse(JSON.stringify(proposed))
  const { compositeRoot: compositeRoot2, cleanup: cleanup2 } = resolveCompositeResearchRoot({
    landingRepoRoot: REPO,
    patchPath,
  })
  try {
    g = mergeTravelerQuestionsFromResearch(compositeRoot2, g)
  } finally {
    cleanup2()
  }

  g.researchImport = {
    ...(g.researchImport || {}),
    publication_tier: 'passenger_editorial',
    qa_verdict: 'PASS',
    research_sha256: prep.research_sha256,
    research_main_pin: prep.research_main_pin,
    stage89_bodo_conditional_candidate: true,
    stage89_preparation_bundle_hash: prep.bundle_idempotency_hash,
    stage53_proposed_guide_reused: true,
    candidate_applied_at_utc: appliedAt,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    conditional_policy_exception: true,
    not_publication_authorization: true,
  }

  const next = JSON.parse(JSON.stringify(guidesBefore))
  assignPublicPortGuideByAppPortId(next, {
    landingSlug: LANDING_SLUG,
    appPortId: APP_PORT_ID,
    guide: g,
    priorGuideAtSlot: prior,
  })
  removeStage65ExcludedGuideEntries(next)

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, landing_slug: LANDING_SLUG }, null, 2))
    return
  }

  writePublicPortGuidesFile(REPO, next)

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath)

  const genEnv = {
    ...process.env,
    SEADAYS_STAGE89_BODO_CANDIDATE: '1',
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  }
  execSync(`node scripts/generateBlogs.js --ports-only --only=${LANDING_SLUG}`, {
    cwd: REPO,
    stdio: 'inherit',
    env: genEnv,
  })

  if (!fs.existsSync(htmlPath)) fail('regen did not produce bod-norway index.html')
  let html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) {
    html = replaceRobotsMeta(html, 'noindex, follow')
    fs.writeFileSync(htmlPath, html, 'utf8')
  }
  if (!/campaign=seadays-web-sbod-norway/i.test(html)) {
    html = html.replace(/campaign=seadays-web-pbodo\b/gi, 'campaign=seadays-web-sbod-norway')
    if (!/campaign=seadays-web-sbod-norway/i.test(html)) {
      fail('could not preserve Viator campaign seadays-web-sbod-norway after regen')
    }
    fs.writeFileSync(htmlPath, html, 'utf8')
  }

  const applyReport = {
    applied_at_utc: appliedAt,
    landing_slug: LANDING_SLUG,
    app_port_id: APP_PORT_ID,
    bundle_hash: prep.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
    candidate_only: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    robots_after_apply: /noindex/i.test(html) ? 'noindex, follow' : 'index, follow',
    net_new_passenger_editorial: true,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8')

  const pubManifest = {
    schema_version: 1,
    stage: 'stage89-bodo-conditional-candidate',
    status: 'READY_FOR_OWNER_REVIEW',
    candidate_only: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    production_apply_permitted: false,
    slugs_approved: [],
    slugs_publication_candidate: [LANDING_SLUG],
    preparation_bundle_hash: prep.bundle_idempotency_hash,
    baseline_main: prep.baseline_main,
    baseline_live_passenger_editorial: 356,
    projected_passenger_editorial_if_merged: 357,
    created_at_utc: appliedAt,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'STAGE89_PUBLICATION_MANIFEST.json'), `${JSON.stringify(pubManifest, null, 2)}\n`, 'utf8')

  const pe = countPassengerEditorialGuides(loadPublicPortGuidesFile(REPO))
  console.log(JSON.stringify({ ok: true, passenger_editorial: pe, robots: applyReport.robots_after_apply }, null, 2))
}

main()

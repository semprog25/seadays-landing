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
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { replaceRobotsMeta } = require('./lib/adsenseIndexability')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage82-hamburg-graduation')
const PREP_MANIFEST = path.join(EVIDENCE, 'STAGE82_PREP_MANIFEST.json')
const LANDING_SLUG = 'hamburg-germany'
const APP_PORT_ID = 'hamburg'

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE82_APPLY_STOP', message: msg }, null, 2))
  process.exit(42)
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!fs.existsSync(PREP_MANIFEST)) fail('run stage82-prepare-hamburg-graduation.js first')
  const prep = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  if (prep.owner_publication_authorized === true || prep.production_apply_permitted === true) {
    fail('authorization flags must remain false on prep manifest')
  }

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
  if (!prior) fail('missing hamburg guide')
  if (usesPassengerEditorialLead(prior)) fail('hamburg already passenger_editorial')

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  if (!dryRun) {
    fs.mkdirSync(path.join(rollbackDir, 'ports', LANDING_SLUG), { recursive: true })
    fs.mkdirSync(EVIDENCE, { recursive: true })
    fs.copyFileSync(
      path.join(REPO, 'data/public-port-guides.json'),
      path.join(rollbackDir, 'public-port-guides.json')
    )
    fs.copyFileSync(
      path.join(REPO, 'ports', LANDING_SLUG, 'index.html'),
      path.join(rollbackDir, 'ports', LANDING_SLUG, 'index.html')
    )
  }

  const next = JSON.parse(JSON.stringify(guidesBefore))
  const appliedAt = new Date().toISOString()
  const proposedImport = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE, 'PROPOSED_RESEARCH_IMPORT.json'), 'utf8')
  )
  next.byAppPortId[APP_PORT_ID] = {
    ...prior,
    researchImport: {
      ...(prior.researchImport || {}),
      ...proposedImport,
      candidate_applied_at_utc: appliedAt,
      preparation_bundle_hash: prep.bundle_idempotency_hash,
    },
  }

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, landing_slug: LANDING_SLUG }, null, 2))
    return
  }

  writePublicPortGuidesFile(REPO, next)

  execSync(`SEADAYS_REGEN_PORT_SLUGS=${LANDING_SLUG} node scripts/regenerate-port-pages.js`, {
    cwd: REPO,
    stdio: 'inherit',
    env: {
      ...process.env,
      SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(REPO, '..', 'Seadays-trust-boundary'),
      VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
      VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
      VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
    },
  })

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  let html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) {
    html = replaceRobotsMeta(html, 'noindex, follow')
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
    upgrade_in_place: true,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8')

  const pubManifest = {
    schema_version: 1,
    stage: 'stage82-hamburg-graduation-candidate',
    status: 'READY_FOR_OWNER_REVIEW',
    candidate_only: true,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    production_apply_permitted: false,
    slugs_approved: [],
    slugs_publication_candidate: [LANDING_SLUG],
    preparation_bundle_hash: prep.bundle_idempotency_hash,
    baseline_main: prep.baseline_main,
    baseline_live_passenger_editorial: 355,
    projected_passenger_editorial_if_merged: 356,
    upgrade_in_place: true,
    created_at_utc: appliedAt,
  }
  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE82_PUBLICATION_MANIFEST.json'),
    `${JSON.stringify(pubManifest, null, 2)}\n`,
    'utf8'
  )

  const contentHash = crypto.createHash('sha256').update(stableStringify(next.byAppPortId[APP_PORT_ID])).digest('hex')
  console.log(
    JSON.stringify({ ok: true, content_hash: contentHash, robots: applyReport.robots_after_apply }, null, 2)
  )
}

main()

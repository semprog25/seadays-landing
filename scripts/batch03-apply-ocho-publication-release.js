#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')

const REPO = path.join(__dirname, '..')
const SLUG = 'ocho-rios-jamaica'
const APP_ID = 'ocho-rios'
const CLEARANCE = path.join(REPO, 'qa-evidence/publication-batch-03-ocho/BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json')
const CANDIDATE_GUIDE = path.join(
  REPO,
  'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied/byAppPortId.ocho-rios.json'
)
const CANDIDATE_HTML = path.join(
  REPO,
  'qa-evidence/batch03-kirkenes-ocho-candidate/candidate-applied/ports/ocho-rios-jamaica/index.html'
)
const ROLLBACK_ROOT = path.join(REPO, 'qa-evidence/publication-batch-03-ocho/rollback-pre-apply', SLUG)

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'BATCH03_OCHO_APPLY_STOP', message: msg }, null, 2))
  process.exit(42)
}

function ensureRollbackSnapshots() {
  fs.mkdirSync(path.join(ROLLBACK_ROOT, 'ports', SLUG), { recursive: true })
  const guidesPath = path.join(REPO, 'data/public-port-guides.json')
  const prodHtml = path.join(REPO, 'ports', SLUG, 'index.html')
  fs.copyFileSync(guidesPath, path.join(ROLLBACK_ROOT, 'public-port-guides.json'))
  if (fs.existsSync(prodHtml)) {
    fs.copyFileSync(prodHtml, path.join(ROLLBACK_ROOT, 'ports', SLUG, 'index.html'))
  }
}

function buildPromotedGuide(candidate, clearance) {
  const guide = JSON.parse(JSON.stringify(candidate))
  if (guide.size?.berthCount != null) fail('candidate berthCount must be null before promotion')
  if (!Array.isArray(guide.facts?.notableFeatures) || guide.facts.notableFeatures.length !== 0) {
    fail('candidate facts.notableFeatures must be empty')
  }
  const lockedAt = new Date().toISOString()
  guide.researchImport = {
    ...(guide.researchImport || {}),
    schema_version: 1,
    publication_tier: 'passenger_editorial',
    landing_slug: SLUG,
    research_sha256: clearance.ocho_rios_research_sha256,
    proposed_content_hash: clearance.ocho_rios_proposed_content_hash,
    qa_verdict: 'PASS',
    owner_factual_hold_cleared: true,
    owner_publication_authorized: true,
    owner_indexing_authorized: false,
    owner_approved: true,
    not_publication_authorization: false,
    batch03_preparation_only: false,
    batch03_ocho_publication_release: true,
    owner_factual_hold_cleared_at_utc: clearance.recorded_at_utc,
    owner_publication_authorized_at_utc: lockedAt,
    publication_policy_clearance_ref: 'qa-evidence/publication-batch-03-ocho/BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json',
    candidate_applied_at_utc: lockedAt,
  }
  return guide
}

function main() {
  if (process.env.SEADAYS_BATCH03_OCHO_PUBLICATION_RELEASE !== '1') {
    fail('set SEADAYS_BATCH03_OCHO_PUBLICATION_RELEASE=1 to apply Ocho Rios release')
  }
  if (!fs.existsSync(CLEARANCE)) fail('missing BATCH03_OCHO_PUBLICATION_POLICY_CLEARANCE.json')
  const clearance = JSON.parse(fs.readFileSync(CLEARANCE, 'utf8'))
  if (clearance.owner_factual_hold_cleared !== true || clearance.owner_publication_authorized !== true) {
    fail('clearance must authorize factual clearance and publication eligibility for Ocho only')
  }
  if (clearance.owner_indexing_authorized === true) fail('indexing must remain false')

  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_GUIDE, 'utf8'))
  const candidateHash = crypto.createHash('sha256').update(stableStringify(candidate)).digest('hex')
  if (candidateHash !== clearance.ocho_rios_proposed_content_hash) {
    fail(`candidate hash ${candidateHash} !== clearance ${clearance.ocho_rios_proposed_content_hash}`)
  }
  if (candidate.researchImport?.research_sha256 !== clearance.ocho_rios_research_sha256) {
    fail('research sha mismatch vs clearance')
  }
  if (!fs.existsSync(CANDIDATE_HTML)) fail('missing candidate html')

  ensureRollbackSnapshots()
  const guides = loadPublicPortGuidesFile(REPO)
  const prior = JSON.parse(JSON.stringify(guides.byAppPortId[APP_ID] || {}))
  const promoted = buildPromotedGuide(candidate, clearance)
  assignPublicPortGuideByAppPortId(guides, {
    landingSlug: SLUG,
    appPortId: APP_ID,
    guide: promoted,
    priorGuideAtSlot: prior,
  })
  writePublicPortGuidesFile(REPO, guides)

  const prodHtmlPath = path.join(REPO, 'ports', SLUG, 'index.html')
  fs.mkdirSync(path.dirname(prodHtmlPath), { recursive: true })
  fs.copyFileSync(CANDIDATE_HTML, prodHtmlPath)
  let html = fs.readFileSync(prodHtmlPath, 'utf8')
  if (!/noindex/i.test(html)) fail('promoted html must remain noindex until indexing authorization')
  if (/\"berthCount\":\s*2/.test(html)) fail('html must not expose legacy berth count')
  fs.writeFileSync(prodHtmlPath, html, 'utf8')

  const report = {
    schema_version: 1,
    slug: SLUG,
    app_port_id: APP_ID,
    applied_at_utc: new Date().toISOString(),
    candidate_content_hash: candidateHash,
    research_sha256: clearance.ocho_rios_research_sha256,
    rollback_ref: `qa-evidence/publication-batch-03-ocho/rollback-pre-apply/${SLUG}`,
    production_guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
    production_html_sha256: sha256File(prodHtmlPath),
  }
  fs.writeFileSync(
    path.join(REPO, 'qa-evidence/publication-batch-03-ocho/APPLY_REPORT.json'),
    `${JSON.stringify(report, null, 2)}\n`
  )
  console.log(JSON.stringify({ ok: true, ...report }, null, 2))
}

main()

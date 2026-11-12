#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')

const REPO = path.join(__dirname, '..')
const SLUG = 'tokyo-yokohama-japan'
const APP_ID = 'yokohama'
const CLEARANCE = path.join(
  REPO,
  'qa-evidence/publication-batch-04-tokyo/BATCH04_TOKYO_PUBLICATION_POLICY_CLEARANCE.json',
)
const CANDIDATE_GUIDE = path.join(
  REPO,
  'qa-evidence/content-repair-batch04/candidate-applied/byAppPortId.yokohama.json',
)
const CANDIDATE_HTML = path.join(
  REPO,
  'qa-evidence/content-repair-batch04/candidate-applied/ports/tokyo-yokohama-japan/index.html',
)
const ROLLBACK_ROOT = path.join(
  REPO,
  'qa-evidence/publication-batch-04-tokyo/rollback-pre-apply/tokyo-yokohama-japan',
)

function fail(msg) {
  console.error(JSON.stringify({ error: 'BATCH04_TOKYO_APPLY_STOP', message: msg }, null, 2))
  process.exit(42)
}

function ensureRollbackSnapshots() {
  fs.mkdirSync(path.join(ROLLBACK_ROOT, 'ports', SLUG), { recursive: true })
  const guidesPath = path.join(REPO, 'data/public-port-guides.json')
  const prodHtml = path.join(REPO, 'ports', SLUG, 'index.html')
  const rollbackGuides = path.join(ROLLBACK_ROOT, 'public-port-guides.json')
  if (!fs.existsSync(rollbackGuides)) {
    fs.copyFileSync(guidesPath, rollbackGuides)
  }
  const rollbackHtml = path.join(ROLLBACK_ROOT, 'ports', SLUG, 'index.html')
  if (!fs.existsSync(rollbackHtml) && fs.existsSync(prodHtml)) {
    fs.copyFileSync(prodHtml, rollbackHtml)
  }
}

function buildPromotedGuide(candidate, clearance) {
  const guide = JSON.parse(JSON.stringify(candidate))
  if (guide.size?.berthCount != null) fail('candidate berthCount must be null before promotion')
  if (guide.size?.terminalCount != null) fail('candidate terminalCount must be null before promotion')
  const lockedAt = new Date().toISOString()
  guide.researchImport = {
    ...(guide.researchImport || {}),
    schema_version: 1,
    publication_tier: 'passenger_editorial',
    landing_slug: SLUG,
    research_sha256: clearance.tokyo_yokohama_japan_research_sha256,
    proposed_content_hash: clearance.tokyo_yokohama_japan_proposed_content_hash,
    qa_verdict: 'PASS',
    owner_factual_hold_cleared: true,
    owner_publication_authorized: true,
    owner_indexing_authorized: false,
    owner_approved: true,
    not_publication_authorization: false,
    batch04_preparation_only: false,
    batch04_tokyo_publication_release: true,
    content_repair_batch04: true,
    owner_factual_hold_cleared_at_utc: clearance.recorded_at_utc,
    owner_publication_authorized_at_utc: lockedAt,
    publication_policy_clearance_ref:
      'qa-evidence/publication-batch-04-tokyo/BATCH04_TOKYO_PUBLICATION_POLICY_CLEARANCE.json',
    candidate_applied_at_utc: lockedAt,
  }
  delete guide.size
  delete guide.climate
  delete guide.facts
  return guide
}

function main() {
  if (process.env.SEADAYS_BATCH04_TOKYO_PUBLICATION_RELEASE !== '1') {
    fail('set SEADAYS_BATCH04_TOKYO_PUBLICATION_RELEASE=1 to apply Tokyo publication release')
  }
  if (!fs.existsSync(CLEARANCE)) fail('missing BATCH04_TOKYO_PUBLICATION_POLICY_CLEARANCE.json')
  const clearance = JSON.parse(fs.readFileSync(CLEARANCE, 'utf8'))
  if (clearance.owner_factual_hold_cleared !== true || clearance.owner_publication_authorized !== true) {
    fail('clearance must authorize factual clearance and publication for Tokyo only')
  }
  if (clearance.owner_indexing_authorized === true) fail('indexing must remain false')

  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_GUIDE, 'utf8'))
  const candidateHash = crypto.createHash('sha256').update(stableStringify(candidate)).digest('hex')
  if (candidateHash !== clearance.tokyo_yokohama_japan_proposed_content_hash) {
    fail(`candidate hash ${candidateHash} !== clearance ${clearance.tokyo_yokohama_japan_proposed_content_hash}`)
  }
  if (candidate.researchImport?.research_sha256 !== clearance.tokyo_yokohama_japan_research_sha256) {
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
  const html = fs.readFileSync(prodHtmlPath, 'utf8')
  if (!/noindex,\s*follow/i.test(html)) fail('promoted html must remain noindex,follow until indexing authorization')
  if (/\"berthCount\":\s*\d/.test(html)) fail('html must not expose berth count')
  if (/Quay LOA for TICT/i.test(html)) fail('html must not contain internal research markers')

  const { assertBatch04TokyoReleaseBinding } = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')
  assertBatch04TokyoReleaseBinding(REPO, guides)

  const report = {
    schema_version: 1,
    slug: SLUG,
    app_port_id: APP_ID,
    applied_at_utc: new Date().toISOString(),
    candidate_content_hash: candidateHash,
    clearance_ref: 'qa-evidence/publication-batch-04-tokyo/BATCH04_TOKYO_PUBLICATION_POLICY_CLEARANCE.json',
  }
  console.log(JSON.stringify({ ok: true, batch04_tokyo_publication_release: report }, null, 2))
}

main()

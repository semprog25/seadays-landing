#!/usr/bin/env node
'use strict'

/**
 * Apply frozen Batch 05 owner approvals → humanApproved, assets, catalog, port HTML.
 * Excludes NEEDS_GEO_REVIEW publication blockers (Dubai, Aberdeen) and existing humanApproved (Ålesund).
 *
 *   SEADAYS_PORT_IMAGE_STAGING_ROOT=/path/to/ports-directory-thumbnails-20261104 \
 *     node scripts/apply-destination-photo-batch-05-publication.js
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy')

const repoRoot = path.join(__dirname, '..')
const defaultStagingRoot = path.join(repoRoot, '..', 'ports-directory-thumbnails-20261104')
const stagingRoot = process.env.SEADAYS_PORT_IMAGE_STAGING_ROOT || defaultStagingRoot

const batch05LedgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-owner-review-v1-decisions.json')
const batch05PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-review-pairs.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json')
const manifestOutPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-scoped-release-manifest.json')
const reportOutPath = path.join(
  repoRoot,
  'qa-evidence',
  'port-images-batch05-20261113',
  'BATCH05_APPLY_REPORT.json'
)

const REVIEW_AT = '2026-11-13'
const REVIEW_BY = 'publication-prep-batch05'
const BATCH_ID = 'destination-photo-batch-05-missing-v1'

/** Owner-frozen but not cleared for publication while geo review is open */
const EXCLUDE_PUBLISH_SLUGS = new Set([
  'dubai-united-arab-emirates',
  'aberdeen-united-kingdom',
])
const SKIP_REPLACE_SLUGS = new Set(['alesund-norway'])

const stagingDir = path.join(stagingRoot, 'qa-evidence', 'destination-batch-05-20261106', 'staging')

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

function indexPairs(manifest) {
  const bySlug = {}
  for (const d of manifest.destinations || []) {
    bySlug[d.portSlug] = d
  }
  return bySlug
}

function localAssetPath(batchLabel, slug, provider, providerImageId) {
  const safeId = String(providerImageId).replace(/[^a-zA-Z0-9-]/g, '')
  return `/assets/img/ports-directory/ports/${slug}/destination-exterior-${batchLabel}-${provider}-${safeId}.webp`
}

function resolveStagingWebp(stagingFile) {
  const base = path.basename(String(stagingFile || '').replace(/^\.\//, ''))
  const full = path.join(stagingDir, base)
  if (!fs.existsSync(full)) throw new Error(`Missing staging webp: ${full}`)
  return full
}

function pickCandidate(dest, decision) {
  const slot = decision.decision === 'APPROVE_B' ? 'candidateB' : 'candidateA'
  const cand = dest[slot]
  if (!cand) throw new Error(`Missing ${slot} for ${decision.portSlug}`)
  if (String(cand.providerImageId) !== String(decision.selectedProviderImageId)) {
    throw new Error(`ID mismatch ${decision.portSlug}`)
  }
  return cand
}

function providerIdFields(cand) {
  if (cand.provider === 'unsplash') {
    return { unsplashPhotoIds: { directoryAndHero: cand.providerImageId } }
  }
  if (cand.provider === 'wikimedia') {
    return { wikimediaFileName: cand.providerImageId }
  }
  return { pexelsPhotoIds: { directoryAndHero: cand.providerImageId } }
}

function buildHumanApproved(slug, cand, batchId, webpUrl, ownerDecision) {
  const entry = {
    url: webpUrl,
    provider: cand.provider,
    providerImageId: cand.providerImageId,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    licenseTerms: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: cand.geographicEvidence,
    approvedAt: REVIEW_AT,
    approvedBy: REVIEW_BY,
    batchId,
    ownerDecision,
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: cand.geoStatus !== 'NEEDS_GEO_REVIEW',
    excludedFromPublicDirectoryRender: false,
  }
  if (cand.unsplashPhotoId) entry.unsplashPhotoId = cand.unsplashPhotoId
  if (cand.provider === 'wikimedia') {
    entry.attributionRequired = true
  }
  return entry
}

function buildOwnerPort(cand, batchId, webpUrl) {
  return {
    verificationStatus: 'OWNER_APPROVED',
    provider: cand.provider,
    batchId,
    directoryImageUrl: webpUrl,
    heroImageUrl: webpUrl,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    license: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: cand.geographicEvidence,
    ...providerIdFields(cand),
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: cand.geoStatus !== 'NEEDS_GEO_REVIEW',
    excludedFromPublicDirectoryRender: false,
    ownerApprovedAt: REVIEW_AT,
    ...(cand.provider === 'wikimedia' ? { attributionRequired: true } : {}),
  }
}

function copyAsset(srcWebp, destWebp) {
  fs.mkdirSync(path.dirname(destWebp), { recursive: true })
  fs.copyFileSync(srcWebp, destWebp)
}

function runNode(script, args = []) {
  const env = {
    ...process.env,
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  }
  execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env,
  })
}

function collectApprovedDecisions(ledger) {
  const rows = []
  for (const d of ledger.decisions || []) {
    if (d.decision !== 'APPROVE_A' && d.decision !== 'APPROVE_B') continue
    rows.push({ ...d, batchId: ledger.batchId, batchLabel: 'batch05' })
  }
  return rows
}

function main() {
  const ledger = loadJson(batch05LedgerPath)
  if (ledger.status !== 'DECISIONS_FROZEN') throw new Error('Batch 05 ledger not frozen')
  const review = loadJson(reviewPath)
  const owner = fs.existsSync(ownerPath) ? loadJson(ownerPath) : { version: 1, ports: {} }
  owner.ports = owner.ports || {}
  owner.policy = DESTINATION_POLICY_NOTE
  review.humanApproved = review.humanApproved || {}

  const destBySlug = indexPairs(loadJson(batch05PairsPath))
  const allApproved = collectApprovedDecisions(ledger)
  const applied = []
  const skipped = []

  for (const decision of allApproved) {
    if (EXCLUDE_PUBLISH_SLUGS.has(decision.portSlug)) {
      skipped.push({
        portSlug: decision.portSlug,
        reason: 'NEEDS_GEO_REVIEW_unresolved_owner_frozen_not_publication_cleared',
      })
      continue
    }
    if (SKIP_REPLACE_SLUGS.has(decision.portSlug)) {
      skipped.push({ portSlug: decision.portSlug, reason: 'skip_replace_existing_humanApproved' })
      continue
    }
    if (review.humanApproved[decision.portSlug]?.ownerVisuallyApproved) {
      skipped.push({ portSlug: decision.portSlug, reason: 'already_humanApproved' })
      continue
    }

    const dest = destBySlug[decision.portSlug]
    if (!dest) throw new Error(`No pair data for ${decision.portSlug}`)
    const cand = pickCandidate(dest, decision)
    const webpUrl = localAssetPath(
      decision.batchLabel,
      decision.portSlug,
      cand.provider,
      cand.providerImageId
    )
    const srcWebp = resolveStagingWebp(cand.stagingFile)
    const destWebp = path.join(repoRoot, webpUrl.replace(/^\//, ''))
    copyAsset(srcWebp, destWebp)

    review.humanApproved[decision.portSlug] = buildHumanApproved(
      decision.portSlug,
      cand,
      decision.batchId,
      webpUrl,
      decision.decision
    )
    owner.ports[decision.portSlug] = buildOwnerPort(cand, decision.batchId, webpUrl)
    applied.push({
      portSlug: decision.portSlug,
      batchId: decision.batchId,
      provider: cand.provider,
      providerImageId: cand.providerImageId,
      localAssetPath: webpUrl,
      stagingSource: srcWebp,
    })
  }

  saveJson(reviewPath, review)
  saveJson(ownerPath, owner)

  const slugs = applied.map((r) => r.portSlug)
  saveJson(manifestOutPath, {
    releaseId: 'ports-directory-batch05-photography',
    preparedAt: REVIEW_AT,
    description:
      'Frozen Batch 05 (15 owner decisions). Applies 12 ports: excludes Dubai/Aberdeen (NEEDS_GEO_REVIEW), Ålesund (existing humanApproved).',
    portSlugs: slugs,
    excludedFromPublication: [...EXCLUDE_PUBLISH_SLUGS],
    skippedSlugs: skipped,
    includeGlobs: [
      'data/destination-photo-batch-05-*.json',
      'data/destination-photo-batch-05-scoped-release-manifest.json',
      'data/ports-directory-image-review-state.json',
      'data/ports-directory-destination-owner-candidates.json',
      'data/destination-image-catalog.json',
      'assets/img/ports-directory/ports/*/destination-exterior-batch05-*.webp',
      'ports/index.html',
      ...slugs.map((s) => `ports/${s}/index.html`),
      'qa-evidence/port-images-batch05-20261113/**',
      'qa-evidence/destination-batch-05-20261106/BATCH05_DECISIONS_RECONCILIATION_REPORT.md',
      'scripts/apply-destination-photo-batch-05-publication.js',
      'scripts/test-port-images-batch05-publication.js',
      'scripts/test-destination-photo-batch-05-owner-decisions.js',
    ],
    excludeFromPr: ['ships/**', 'blog/**', 'data/public-port-guides.json'],
    appliedCount: applied.length,
  })

  saveJson(reportOutPath, {
    preparedAt: new Date().toISOString(),
    originMainBase: '00706a8fda0cd61e5d198bf518943c872f0abcae',
    ledgerFrozenAt: ledger.frozenAt,
    applied,
    skipped,
    totalApprovedInLedger: allApproved.length,
    humanApprovedCountLocal: Object.keys(review.humanApproved).length,
  })

  runNode('build-destination-image-catalog.js')
  runNode('regenerate-ports-index.js')

  if (slugs.length) {
    runNode('generateBlogs.js', ['--ports-only', `--only=${slugs.join(',')}`])
  }

  runNode('test-destination-photo-batch-05-owner-decisions.js')
  runNode('test-port-images-batch05-publication.js')
  runNode('test-destination-image-catalog.js')
  runNode('test-destination-image-source-policy.js')

  console.log(
    `[apply-batch05] applied=${applied.length} skipped=${skipped.length} slugs=${slugs.join(',')}`
  )
}

main()

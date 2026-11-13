#!/usr/bin/env node
'use strict'

/**
 * Apply frozen Batch 03 + Batch 04 owner approvals → humanApproved, assets, catalog.
 * Approved-but-unpublished only; skips slugs already humanApproved (e.g. owner-downloads Mumbai/Rotterdam).
 *
 *   SEADAYS_PORT_IMAGE_STAGING_ROOT=/path/to/thumbnails-worktree \
 *     node scripts/apply-destination-photo-batch-03-04-publication.js
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy')

const repoRoot = path.join(__dirname, '..')
const defaultStagingRoot = path.join(
  repoRoot,
  '..',
  'ports-directory-thumbnails-20261104'
)
const stagingRoot = process.env.SEADAYS_PORT_IMAGE_STAGING_ROOT || defaultStagingRoot

const batch03LedgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-03-owner-review-v1-decisions.json')
const batch03PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-03-review-pairs.json')
const batch04LedgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-04-owner-review-v1-decisions.json')
const batch04PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-04-review-pairs.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json')
const manifestOutPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-03-04-scoped-release-manifest.json'
)
const reportOutPath = path.join(
  repoRoot,
  'qa-evidence',
  'port-images-batch03-04-20261113',
  'BATCH03_04_APPLY_REPORT.json'
)

const REVIEW_AT = '2026-11-13'
const REVIEW_BY = 'publication-prep-batch03-04'
const SKIP_SLUGS = new Set([
  'rotterdam-netherlands',
  'mumbai-india',
  'le-havre-paris-france',
  'nice-france',
])
const GEO_REVIEW_SLUGS = new Set([])

const stagingDirs = {
  'destination-photo-batch-03-missing-v1': path.join(
    stagingRoot,
    'qa-evidence',
    'destination-batch-03-20261105',
    'staging'
  ),
  'destination-photo-batch-04-reject3-v1': path.join(
    stagingRoot,
    'qa-evidence',
    'destination-batch-04-20261106',
    'staging'
  ),
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

function indexPairs(manifests) {
  const bySlug = {}
  for (const m of manifests) {
    for (const d of m.destinations || []) {
      bySlug[d.portSlug] = { ...(bySlug[d.portSlug] || {}), ...d }
    }
  }
  return bySlug
}

function localAssetPath(batchLabel, slug, provider, providerImageId) {
  const safeId = String(providerImageId).replace(/[^a-zA-Z0-9-]/g, '')
  return `/assets/img/ports-directory/ports/${slug}/destination-exterior-${batchLabel}-${provider}-${safeId}.webp`
}

function resolveStagingWebp(batchId, stagingFile) {
  const dir = stagingDirs[batchId]
  if (!dir) throw new Error(`No staging dir for ${batchId}`)
  const base = path.basename(String(stagingFile || '').replace(/^\.\//, ''))
  const full = path.join(dir, base)
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

function buildHumanApproved(slug, cand, batchId, webpUrl, ownerDecision) {
  const needsGeo = GEO_REVIEW_SLUGS.has(slug) || cand.geoStatus === 'NEEDS_GEO_REVIEW'
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
    productionGeoVerified: !needsGeo,
    excludedFromPublicDirectoryRender: false,
  }
  if (cand.unsplashPhotoId) entry.unsplashPhotoId = cand.unsplashPhotoId
  if (needsGeo) {
    entry.providerGeoNeedsReview = true
    entry.geoReviewNote =
      slug === 'le-havre-paris-france'
        ? 'Batch 03 verification: generic marina — owner B retained'
        : 'Candidate geoStatus NEEDS_GEO_REVIEW — owner selection frozen'
  }
  return entry
}

function buildOwnerPort(slug, cand, batchId, webpUrl) {
  const needsGeo = GEO_REVIEW_SLUGS.has(slug) || cand.geoStatus === 'NEEDS_GEO_REVIEW'
  return {
    verificationStatus: needsGeo ? 'OWNER_APPROVED_GEO_REVIEW' : 'OWNER_APPROVED',
    provider: cand.provider,
    batchId,
    directoryImageUrl: webpUrl,
    heroImageUrl: webpUrl,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    license: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: cand.geographicEvidence,
    ...(cand.provider === 'unsplash'
      ? { unsplashPhotoIds: { directoryAndHero: cand.providerImageId } }
      : { pexelsPhotoIds: { directoryAndHero: cand.providerImageId } }),
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: !needsGeo,
    excludedFromPublicDirectoryRender: false,
    ownerApprovedAt: REVIEW_AT,
    ...(needsGeo ? { providerGeoNeedsReview: true } : {}),
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

function collectApprovedDecisions() {
  const b3 = loadJson(batch03LedgerPath)
  const b4 = loadJson(batch04LedgerPath)
  const rows = []
  for (const d of b3.decisions || []) {
    if (d.decision !== 'APPROVE_A' && d.decision !== 'APPROVE_B') continue
    rows.push({ ...d, batchId: b3.batchId, batchLabel: 'batch03' })
  }
  for (const d of b4.decisions || []) {
    if (d.decision !== 'APPROVE_A' && d.decision !== 'APPROVE_B') continue
    rows.push({ ...d, batchId: b4.batchId, batchLabel: 'batch04' })
  }
  return rows
}

function main() {
  const review = loadJson(reviewPath)
  const owner = fs.existsSync(ownerPath)
    ? loadJson(ownerPath)
    : { version: 1, ports: {} }
  owner.ports = owner.ports || {}
  owner.policy = DESTINATION_POLICY_NOTE
  review.humanApproved = review.humanApproved || {}

  const destBySlug = indexPairs([loadJson(batch03PairsPath), loadJson(batch04PairsPath)])
  const allApproved = collectApprovedDecisions()
  const applied = []
  const skipped = []

  for (const decision of allApproved) {
    if (SKIP_SLUGS.has(decision.portSlug)) {
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
    const srcWebp = resolveStagingWebp(decision.batchId, cand.stagingFile)
    const destWebp = path.join(repoRoot, webpUrl.replace(/^\//, ''))
    copyAsset(srcWebp, destWebp)

    review.humanApproved[decision.portSlug] = buildHumanApproved(
      decision.portSlug,
      cand,
      decision.batchId,
      webpUrl,
      decision.decision
    )
    owner.ports[decision.portSlug] = buildOwnerPort(
      decision.portSlug,
      cand,
      decision.batchId,
      webpUrl
    )
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
    releaseId: 'ports-directory-batch03-04-photography',
    preparedAt: REVIEW_AT,
    description:
      'Frozen Batch 03 (10 approvals, 8 new apply) + Batch 04 (3 apply). Excludes Mumbai/Rotterdam replace.',
    portSlugs: slugs,
    skippedSlugs: skipped,
    includeGlobs: [
      'data/destination-photo-batch-03-*.json',
      'data/destination-photo-batch-04-*.json',
      'data/destination-photo-batch-03-04-scoped-release-manifest.json',
      'data/ports-directory-image-review-state.json',
      'data/ports-directory-destination-owner-candidates.json',
      'data/destination-image-catalog.json',
      'assets/img/ports-directory/ports/*/destination-exterior-batch03-*.webp',
      'assets/img/ports-directory/ports/*/destination-exterior-batch04-*.webp',
      'ports/index.html',
      ...slugs.map((s) => `ports/${s}/index.html`),
      'qa-evidence/port-images-batch03-04-20261113/**',
      'scripts/apply-destination-photo-batch-03-04-publication.js',
      'scripts/reconcile-port-image-coverage.js',
      'scripts/test-port-images-batch03-04-publication.js',
    ],
    excludeFromPr: ['ships/**', 'blog/**', 'data/public-port-guides.json'],
    appliedCount: applied.length,
  })

  saveJson(reportOutPath, {
    preparedAt: new Date().toISOString(),
    originMainBase: 'd002a6a8e',
    applied,
    skipped,
    totalApprovedInLedger: allApproved.length,
  })

  runNode('build-destination-image-catalog.js')
  runNode('regenerate-ports-index.js')

  if (slugs.length) {
    runNode('generateBlogs.js', ['--ports-only', `--only=${slugs.join(',')}`])
  }

  runNode('test-destination-photo-batch-04-owner-decisions.js')
  runNode('test-port-images-batch03-04-publication.js')
  runNode('test-destination-image-catalog.js')
  runNode('test-destination-image-source-policy.js')

  console.log(
    `[apply-batch03-04] applied=${applied.length} skipped=${skipped.length} slugs=${slugs.join(',')}`
  )
}

main()

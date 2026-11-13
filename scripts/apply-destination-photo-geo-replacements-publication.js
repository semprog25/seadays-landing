#!/usr/bin/env node
'use strict'

/**
 * Publish owner-approved geo replacements: Aberdeen (Commons harbour A) and Le Havre (Batch 03 Pexels A).
 *
 *   SEADAYS_PORT_IMAGE_STAGING_ROOT=/path/to/ports-directory-thumbnails-20261104 \
 *     node scripts/apply-destination-photo-geo-replacements-publication.js
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy')

const repoRoot = path.join(__dirname, '..')
const stagingRoot =
  process.env.SEADAYS_PORT_IMAGE_STAGING_ROOT ||
  path.join(repoRoot, '..', 'ports-directory-thumbnails-20261104')
const stagingBatch05 = path.join(stagingRoot, 'qa-evidence', 'destination-batch-05-20261106', 'staging')
const stagingBatch03 = path.join(stagingRoot, 'qa-evidence', 'destination-batch-03-20261105', 'staging')

const REVIEW_AT = '2026-11-13'
const REVIEW_BY = 'geo-replacement-owner-authorized-20261113'
const GEO_MANIFEST = 'data/destination-photo-geo-replacements-v1-scoped-release-manifest.json'
const GEO_DECISIONS = 'data/destination-photo-geo-replacements-v1-owner-decisions.json'
const GEO_EVIDENCE = 'qa-evidence/geo-replacements-20261113/GEO_REPLACEMENTS_APPLY_REPORT.json'

const PORTS = {
  'aberdeen-united-kingdom': {
    batchId: 'destination-photo-batch-05-missing-v1',
    batchLabel: 'batch05',
    ownerDecision: 'OWNER_APPROVED_REPLACEMENT',
    stagingDir: stagingBatch05,
    stagingFile: 'aberdeen-united-kingdom-alt-A-harbour.webp',
    cand: {
      provider: 'wikimedia',
      providerImageId: 'Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg',
      sourcePageUrl:
        'https://commons.wikimedia.org/wiki/File:Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg',
      photographer: 'Graeme Smith',
      licenseUrl: 'https://creativecommons.org/licenses/by-sa/2.0/',
      licenseTerms: 'CC BY-SA 2.0 (attribution required; share-alike if adapted)',
      geographicEvidence:
        'Aberdeen Harbour — Commons/Exif ~57.146°N, 2.089°W; city harbour context (not a named cruise berth).',
    },
    superseded: {
      batchId: 'destination-photo-batch-05-missing-v1',
      ownerDecision: 'APPROVE_B',
      selectedCandidateId: 'pexels:5684661',
      manifestGeoStatus: 'NEEDS_GEO_REVIEW',
    },
  },
  'le-havre-paris-france': {
    batchId: 'destination-photo-batch-03-missing-v1',
    batchLabel: 'batch03',
    ownerDecision: 'APPROVE_A',
    pairPath: 'data/destination-photo-batch-03-review-pairs.json',
    stagingDir: stagingBatch03,
    slot: 'candidateA',
    superseded: {
      batchId: 'destination-photo-batch-03-missing-v1',
      ownerDecision: 'APPROVE_B',
      selectedCandidateId: 'pexels:11691091',
      manifestGeoStatus: 'NEEDS_GEO_REVIEW',
    },
  },
}

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

function localAssetPath(batchLabel, slug, provider, providerImageId) {
  const safeId = String(providerImageId).replace(/[^a-zA-Z0-9-]/g, '')
  return `/assets/img/ports-directory/ports/${slug}/destination-exterior-${batchLabel}-${provider}-${safeId}.webp`
}

function providerIdFields(cand) {
  if (cand.provider === 'wikimedia') {
    return { wikimediaFileName: cand.providerImageId }
  }
  return { pexelsPhotoIds: { directoryAndHero: cand.providerImageId } }
}

function buildHumanApproved(slug, spec, cand, webpUrl) {
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
    batchId: spec.batchId,
    ownerDecision: spec.ownerDecision,
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: true,
    geoReplacementEvidence: GEO_DECISIONS,
    supersededFrozenDecision: spec.superseded,
    excludedFromPublicDirectoryRender: false,
  }
  if (cand.provider === 'wikimedia') entry.attributionRequired = true
  return entry
}

function buildOwnerPort(spec, cand, webpUrl) {
  return {
    verificationStatus: 'OWNER_APPROVED',
    provider: cand.provider,
    batchId: spec.batchId,
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
    productionGeoVerified: true,
    geoReplacementEvidence: GEO_DECISIONS,
    supersededFrozenDecision: spec.superseded,
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
  execFileSync(process.execPath, [path.join(__dirname, script), ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
      VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
      VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
    },
  })
}

function updateBatch05Ledger() {
  const p = path.join(repoRoot, 'data', 'destination-photo-batch-05-owner-review-v1-decisions.json')
  const ledger = loadJson(p)
  ledger.ownerApprovedReplacements = ledger.ownerApprovedReplacements || []
  ledger.ownerApprovedReplacements.push({
    portSlug: 'aberdeen-united-kingdom',
    status: 'OWNER_APPROVED_REPLACEMENT',
    publishedAt: REVIEW_AT,
    supersedesFrozen: PORTS['aberdeen-united-kingdom'].superseded,
    publishedCandidateId: 'wikimedia:Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg',
    geographicStatus: 'VERIFIED',
  })
  const geo = (ledger.geographicResolution || []).find((g) => g.portSlug === 'aberdeen-united-kingdom')
  if (geo) {
    geo.supersededFrozenCandidateId = 'pexels:5684661'
    geo.selectedCandidateId = 'wikimedia:Aberdeen_Harbour_-_geograph.org.uk_-_3122252.jpg'
    geo.verdict = 'VERIFIED'
    geo.cityIdentity = 'Aberdeen Harbour, Aberdeen, United Kingdom'
    geo.cruiseTerminal = 'Harbour/city waterfront — not asserted as a named cruise berth.'
    geo.evidence =
      'Owner-approved Commons Harbour A (Graeme Smith, CC BY-SA 2.0). Exif/object location ~57.146°N, 2.089°W. Supersedes frozen pexels:5684661 (NEEDS_GEO_REVIEW).'
    geo.ownerApprovedReplacementAt = REVIEW_AT
  }
  ledger.geoReviewStillOpen = (ledger.geoReviewStillOpen || []).filter(
    (r) => r.portSlug !== 'aberdeen-united-kingdom',
  )
  saveJson(p, ledger)
}

function updateBatch03Ledger() {
  const p = path.join(repoRoot, 'data', 'destination-photo-batch-03-owner-review-v1-decisions.json')
  const ledger = loadJson(p)
  ledger.ownerApprovedReplacements = ledger.ownerApprovedReplacements || []
  ledger.ownerApprovedReplacements.push({
    portSlug: 'le-havre-paris-france',
    status: 'OWNER_APPROVED_REPLACEMENT',
    publishedAt: REVIEW_AT,
    supersedesFrozen: PORTS['le-havre-paris-france'].superseded,
    publishedOwnerDecision: 'APPROVE_A',
    publishedCandidateId: 'pexels:31781110',
    geographicStatus: 'VERIFIED',
  })
  ledger.geographicResolution = ledger.geographicResolution || []
  ledger.geographicResolution.push({
    portSlug: 'le-havre-paris-france',
    selectedCandidateId: 'pexels:31781110',
    supersededFrozenCandidateId: 'pexels:11691091',
    verdict: 'VERIFIED',
    cityIdentity: 'Le Havre, France',
    cruiseTerminal: 'City/estuary waterfront — not asserted as a named cruise terminal.',
    evidence:
      'Owner switch to Batch 03 Pexels A (Zarina Maizel). Pexels location Le Havre, France. Supersedes frozen pexels:11691091 geo hold.',
    ownerApprovedReplacementAt: REVIEW_AT,
  })
  saveJson(p, ledger)
}

function patchBatchScopedManifests(slugs) {
  const b05 = path.join(repoRoot, 'data', 'destination-photo-batch-05-scoped-release-manifest.json')
  if (fs.existsSync(b05)) {
    const m = loadJson(b05)
    m.excludedFromPublication = (m.excludedFromPublication || []).filter(
      (s) => s !== 'aberdeen-united-kingdom',
    )
    m.geoReplacementsPublished = m.geoReplacementsPublished || []
    if (slugs.includes('aberdeen-united-kingdom')) {
      m.geoReplacementsPublished.push({
        portSlug: 'aberdeen-united-kingdom',
        publishedAt: REVIEW_AT,
        manifest: GEO_MANIFEST,
      })
    }
    const skipped = m.skippedSlugs || []
    const idx = skipped.findIndex((s) => s.portSlug === 'aberdeen-united-kingdom')
    if (idx >= 0) {
      skipped[idx] = {
        portSlug: 'aberdeen-united-kingdom',
        reason: 'published_via_geo_replacement_owner_authorized',
      }
    }
    m.skippedSlugs = skipped
    saveJson(b05, m)
  }

  const b0304 = path.join(repoRoot, 'data', 'destination-photo-batch-03-04-scoped-release-manifest.json')
  if (fs.existsSync(b0304) && slugs.includes('le-havre-paris-france')) {
    const m = loadJson(b0304)
    m.excludedSlugs = (m.excludedSlugs || []).filter((e) => e.portSlug !== 'le-havre-paris-france')
    m.geoReplacementsPublished = m.geoReplacementsPublished || []
    m.geoReplacementsPublished.push({
      portSlug: 'le-havre-paris-france',
      publishedAt: REVIEW_AT,
      manifest: GEO_MANIFEST,
    })
    saveJson(b0304, m)
  }
}

function main() {
  const decisionsPath = path.join(repoRoot, GEO_DECISIONS)
  if (!fs.existsSync(decisionsPath)) {
    throw new Error(`Missing ${GEO_DECISIONS} — record owner approval first`)
  }
  const decisions = loadJson(decisionsPath)
  if (decisions.status !== 'OWNER_APPROVED_PUBLICATION_READY') {
    throw new Error(`Geo decisions status must be OWNER_APPROVED_PUBLICATION_READY (got ${decisions.status})`)
  }

  const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
  const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json')
  const review = loadJson(reviewPath)
  const owner = loadJson(ownerPath)
  review.humanApproved = review.humanApproved || {}
  owner.ports = owner.ports || {}
  owner.policy = DESTINATION_POLICY_NOTE

  const applied = []
  for (const slug of Object.keys(PORTS)) {
    const spec = PORTS[slug]
    if (review.humanApproved[slug]?.ownerVisuallyApproved) {
      throw new Error(`${slug} already humanApproved`)
    }
    const cand = spec.cand || (() => {
      const pairs = loadJson(path.join(repoRoot, spec.pairPath))
      const dest = pairs.destinations.find((d) => d.portSlug === slug)
      return dest[spec.slot]
    })()
    const webpUrl = localAssetPath(spec.batchLabel, slug, cand.provider, cand.providerImageId)
    const stagingBase = path.basename(spec.stagingFile || cand.stagingFile)
    const srcWebp = path.join(spec.stagingDir, stagingBase)
    if (!fs.existsSync(srcWebp)) throw new Error(`Missing staging webp: ${srcWebp}`)
    copyAsset(srcWebp, path.join(repoRoot, webpUrl.replace(/^\//, '')))

    review.humanApproved[slug] = buildHumanApproved(slug, spec, cand, webpUrl)
    owner.ports[slug] = buildOwnerPort(spec, cand, webpUrl)
    applied.push({ portSlug: slug, localAssetPath: webpUrl, providerImageId: cand.providerImageId })
  }

  saveJson(reviewPath, review)
  saveJson(ownerPath, owner)
  updateBatch05Ledger()
  updateBatch03Ledger()
  patchBatchScopedManifests(applied.map((a) => a.portSlug))

  const slugs = applied.map((a) => a.portSlug)
  saveJson(path.join(repoRoot, GEO_MANIFEST), {
    releaseId: 'ports-directory-geo-replacements-v1',
    preparedAt: REVIEW_AT,
    description: 'Owner-approved Aberdeen (Commons harbour A) and Le Havre (Batch 03 Pexels A).',
    portSlugs: slugs,
    baseMainSha: '8c94f38a292766b5b36aeb867e332b9de7669ba3',
    includeGlobs: [
      'data/destination-photo-geo-replacements-v1-*.json',
      'data/destination-photo-batch-05-owner-review-v1-decisions.json',
      'data/destination-photo-batch-03-owner-review-v1-decisions.json',
      'data/destination-photo-batch-05-scoped-release-manifest.json',
      'data/destination-photo-batch-03-04-scoped-release-manifest.json',
      'data/ports-directory-image-review-state.json',
      'data/ports-directory-destination-owner-candidates.json',
      'data/destination-image-catalog.json',
      `assets/img/ports-directory/ports/aberdeen-united-kingdom/destination-exterior-batch05-wikimedia-*.webp`,
      `assets/img/ports-directory/ports/le-havre-paris-france/destination-exterior-batch03-pexels-31781110.webp`,
      'ports/index.html',
      'ports/aberdeen-united-kingdom/index.html',
      'ports/le-havre-paris-france/index.html',
      'qa-evidence/geo-replacements-20261113/GEO_REPLACEMENTS_APPLY_REPORT.json',
      'scripts/apply-destination-photo-geo-replacements-publication.js',
      'scripts/test-port-images-geo-replacements-publication.js',
    ],
    excludeFromPr: ['ships/**', 'blog/**', 'data/public-port-guides.json', 'qa-evidence/geo-replacements-20261113/previews/**'],
    appliedCount: slugs.length,
  })

  saveJson(path.join(repoRoot, GEO_EVIDENCE), {
    preparedAt: new Date().toISOString(),
    originMainBase: '8c94f38a292766b5b36aeb867e332b9de7669ba3',
    applied,
    approvedBy: REVIEW_BY,
  })

  runNode('build-destination-image-catalog.js')
  runNode('regenerate-ports-index.js')
  runNode('generateBlogs.js', ['--ports-only', `--only=${slugs.join(',')}`])

  runNode('test-destination-image-catalog.js')
  runNode('test-destination-image-source-policy.js')
  runNode('test-port-images-geo-replacements-publication.js')

  console.log(`[apply-geo-replacements] applied=${slugs.length} ${slugs.join(',')}`)
}

main()

#!/usr/bin/env node
'use strict'

/**
 * Local-only: publish frozen Batch 05 Dubai B after geographicResolution VERIFIED evidence.
 * Does not touch Aberdeen or other ports.
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy')

const repoRoot = path.join(__dirname, '..')
const stagingRoot =
  process.env.SEADAYS_PORT_IMAGE_STAGING_ROOT ||
  path.join(repoRoot, '..', 'ports-directory-thumbnails-20261104')
const stagingDir = path.join(stagingRoot, 'qa-evidence', 'destination-batch-05-20261106', 'staging')

const slug = 'dubai-united-arab-emirates'
const REVIEW_AT = '2026-11-13'
const REVIEW_BY = 'geo-resolution-batch05-dubai'
const EVIDENCE =
  'qa-evidence/destination-batch-05-20261106/BATCH05_GEO_FLAG_RESOLUTION.md + ledger geographicResolution VERIFIED (Dubai Marina city card; Pexels location Dubai UAE)'

const ledgerPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-owner-review-v1-decisions.json')
const pairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-review-pairs.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json')

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
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

function main() {
  const ledger = loadJson(ledgerPath)
  const geo = (ledger.geographicResolution || []).find((g) => g.portSlug === slug)
  if (!geo || geo.verdict !== 'VERIFIED') {
    throw new Error('Dubai geographicResolution not VERIFIED — refuse apply')
  }
  const decision = (ledger.decisions || []).find((d) => d.portSlug === slug)
  if (!decision || decision.selectedCandidateId !== 'pexels:7168553') {
    throw new Error('Unexpected frozen Dubai decision')
  }

  const pairs = loadJson(pairsPath)
  const dest = pairs.destinations.find((d) => d.portSlug === slug)
  const cand = dest.candidateB
  const safeId = String(cand.providerImageId).replace(/[^a-zA-Z0-9-]/g, '')
  const webpUrl = `/assets/img/ports-directory/ports/${slug}/destination-exterior-batch05-${cand.provider}-${safeId}.webp`
  const srcWebp = path.join(stagingDir, path.basename(cand.stagingFile))
  if (!fs.existsSync(srcWebp)) throw new Error(`Missing staging: ${srcWebp}`)
  const destWebp = path.join(repoRoot, webpUrl.replace(/^\//, ''))
  fs.mkdirSync(path.dirname(destWebp), { recursive: true })
  fs.copyFileSync(srcWebp, destWebp)

  const review = loadJson(reviewPath)
  review.humanApproved = review.humanApproved || {}
  if (review.humanApproved[slug]?.ownerVisuallyApproved) {
    throw new Error('Dubai already humanApproved')
  }

  review.humanApproved[slug] = {
    url: webpUrl,
    provider: cand.provider,
    providerImageId: cand.providerImageId,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    licenseTerms: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: geo.cityIdentity || cand.geographicEvidence,
    approvedAt: REVIEW_AT,
    approvedBy: REVIEW_BY,
    batchId: ledger.batchId,
    ownerDecision: decision.decision,
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: true,
    geoResolutionEvidence: EVIDENCE,
    excludedFromPublicDirectoryRender: false,
  }

  const owner = loadJson(ownerPath)
  owner.ports = owner.ports || {}
  owner.policy = DESTINATION_POLICY_NOTE
  owner.ports[slug] = {
    verificationStatus: 'OWNER_APPROVED',
    provider: cand.provider,
    batchId: ledger.batchId,
    directoryImageUrl: webpUrl,
    heroImageUrl: webpUrl,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    license: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: geo.cityIdentity || cand.geographicEvidence,
    pexelsPhotoIds: { directoryAndHero: cand.providerImageId },
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: true,
    geoResolutionEvidence: EVIDENCE,
    excludedFromPublicDirectoryRender: false,
    ownerApprovedAt: REVIEW_AT,
  }

  saveJson(reviewPath, review)
  saveJson(ownerPath, owner)

  runNode('build-destination-image-catalog.js')
  runNode('regenerate-ports-index.js')
  runNode('generateBlogs.js', ['--ports-only', `--only=${slug}`])
  runNode('test-destination-image-catalog.js')
  runNode('test-destination-image-source-policy.js')

  console.log(`[apply-dubai-geo] OK ${webpUrl}`)
}

main()

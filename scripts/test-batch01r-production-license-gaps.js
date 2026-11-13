#!/usr/bin/env node
'use strict'

/**
 * Regression: Batch01r Nordic/US-Baltic ports — production license metadata bound to live heroes.
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const repoRoot = path.join(__dirname, '..')
const review = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-image-review-state.json'), 'utf8')
)
const catalog = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'destination-image-catalog.json'), 'utf8')
)

const SLUGS = [
  'copenhagen-denmark',
  'oslo-norway',
  'stockholm-sweden',
  'seattle-wa-united-states',
]

const EXPECTED_IDS = {
  'copenhagen-denmark': 35276893,
  'oslo-norway': 32991341,
  'stockholm-sweden': 37499978,
  'seattle-wa-united-states': 36486517,
}

const OWNER_VISUAL = {
  'copenhagen-denmark': true,
  'oslo-norway': true,
  'stockholm-sweden': true,
  'seattle-wa-united-states': true,
}

function catalogRow(slug) {
  return (catalog.records || []).find((r) => r.portSlug === slug)
}

for (const slug of SLUGS) {
  const ha = review.humanApproved[slug]
  assert(ha, `${slug}: humanApproved missing`)
  assert.strictEqual(ha.productionLicenseVerified, true, `${slug}: productionLicenseVerified`)
  assert.strictEqual(ha.ownerVisuallyApproved, OWNER_VISUAL[slug], `${slug}: ownerVisuallyApproved`)
  assert(String(ha.url || '').includes(`pexels-${EXPECTED_IDS[slug]}`), `${slug}: humanApproved url id`)

  const row = catalogRow(slug)
  assert(row, `${slug}: catalog row`)
  assert.strictEqual(row.verificationStatus, 'VERIFIED', `${slug}: catalog VERIFIED`)
  assert.strictEqual(String(row.imageId), String(EXPECTED_IDS[slug]), `${slug}: catalog imageId`)
  assert(row.licenseTerms.includes('Pexels'), `${slug}: licenseTerms`)

  const html = fs.readFileSync(path.join(repoRoot, 'ports', slug, 'index.html'), 'utf8')
  assert(html.includes(`batch01r-pexels-${EXPECTED_IDS[slug]}`), `${slug}: hero asset`)
  assert(html.includes('<figcaption>'), `${slug}: hero figcaption`)
  assert(html.includes(ha.photographer), `${slug}: photographer credit`)
  assert(html.includes('pexels.com/license'), `${slug}: license link`)
}

const stockholmGuide = fs.readFileSync(
  path.join(repoRoot, 'ports', 'stockholm-sweden', 'index.html'),
  'utf8',
)
assert(stockholmGuide.includes('--seo-hero-focal: 58% 32%;'), 'stockholm: hero focal')
const portsIndex = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8')
assert(
  portsIndex.includes('stockholm-sweden') && portsIndex.includes('object-position:50% 28%;'),
  'stockholm: directory object-position',
)

console.log('OK test-batch01r-production-license-gaps', { slugs: SLUGS.length })

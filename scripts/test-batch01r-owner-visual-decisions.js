#!/usr/bin/env node
'use strict'

/**
 * Batch01r owner visual decisions — ledger ↔ review-state alignment (metadata-only).
 */
const fs = require('fs')
const path = require('path')
const assert = require('assert')

const repoRoot = path.join(__dirname, '..')
const ledgerPath = path.join(repoRoot, 'data', 'destination-photo-batch01r-owner-decisions.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')

const ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'))
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))

assert.strictEqual(ledger.status, 'OWNER_DECISIONS_RECORDED')
assert.strictEqual(ledger.decisions.length, 4)
assert.strictEqual(ledger.ownerReportedCounts.APPROVE, 3)
assert.strictEqual(ledger.ownerReportedCounts.APPROVE_ADJUSTED_CROP, 1)
assert.strictEqual(ledger.ownerReportedCounts.NEEDS_FURTHER_REVIEW, 0)

const APPROVE_SLUGS = ['copenhagen-denmark', 'oslo-norway', 'seattle-wa-united-states']
const STOCKHOLM = 'stockholm-sweden'

let ownerVisualCount = 0
for (const v of Object.values(review.humanApproved || {})) {
  if (v.ownerVisuallyApproved === true) ownerVisualCount++
}
assert.strictEqual(ownerVisualCount, 55, 'ownerVisuallyApproved count after Stockholm +1')

for (const d of ledger.decisions) {
  const ha = review.humanApproved[d.portSlug]
  assert(ha, `${d.portSlug}: humanApproved missing`)
  assert.strictEqual(ha.providerImageId, d.providerImageId, `${d.portSlug}: image id`)
  assert.strictEqual(ha.url, d.assetPath, `${d.portSlug}: asset binding`)
  assert.strictEqual(ha.productionLicenseVerified, true, `${d.portSlug}: licence`)
  assert.strictEqual(ha.productionGeoVerified, true, `${d.portSlug}: geo`)
  assert.strictEqual(Boolean(ha.ownerVisuallyApproved), Boolean(d.ownerVisuallyApproved), `${d.portSlug}: visual flag`)
  assert.strictEqual(ha.ownerDecision, d.decision, `${d.portSlug}: ownerDecision`)
  assert.strictEqual(ha.ownerVisualReviewEvidence, 'data/destination-photo-batch01r-owner-decisions.json')
}

for (const slug of APPROVE_SLUGS) {
  const ha = review.humanApproved[slug]
  assert.strictEqual(ha.ownerVisuallyApproved, true, slug)
  assert.strictEqual(ha.approvedBy, 'owner-visual-review-batch01r-final', slug)
}

const st = review.humanApproved[STOCKHOLM]
assert.strictEqual(st.ownerVisuallyApproved, true, STOCKHOLM)
assert.strictEqual(st.ownerDecision, 'APPROVE_ADJUSTED_CROP', STOCKHOLM)
assert.strictEqual(st.priorOwnerDecision, 'NEEDS_FURTHER_REVIEW', STOCKHOLM)
assert.strictEqual(st.cropFocal?.hero?.x, 58)
assert.strictEqual(st.cropFocal?.hero?.y, 32)
assert.strictEqual(st.cropFocal?.directory?.y, 28)

console.log('OK test-batch01r-owner-visual-decisions', {
  ownerVisuallyApproved: ownerVisualCount,
  approve: APPROVE_SLUGS.length,
  stockholm: STOCKHOLM,
})

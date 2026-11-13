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
assert.strictEqual(ledger.ownerReportedCounts.NEEDS_FURTHER_REVIEW, 1)

const APPROVE_SLUGS = ['copenhagen-denmark', 'oslo-norway', 'seattle-wa-united-states']
const PENDING_SLUG = 'stockholm-sweden'

let ownerVisualCount = 0
for (const v of Object.values(review.humanApproved || {})) {
  if (v.ownerVisuallyApproved === true) ownerVisualCount++
}
assert.strictEqual(ownerVisualCount, 54, 'ownerVisuallyApproved count after +3')

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

const st = review.humanApproved[PENDING_SLUG]
assert.strictEqual(st.ownerVisuallyApproved, false, PENDING_SLUG)
assert.strictEqual(st.ownerDecision, 'NEEDS_FURTHER_REVIEW', PENDING_SLUG)
assert.strictEqual(st.approvedBy, 'production-license-verification-batch01r', PENDING_SLUG)

console.log('OK test-batch01r-owner-visual-decisions', {
  ownerVisuallyApproved: ownerVisualCount,
  approve: APPROVE_SLUGS.length,
  pending: PENDING_SLUG,
})

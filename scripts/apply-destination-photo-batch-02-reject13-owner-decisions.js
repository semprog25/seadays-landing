#!/usr/bin/env node
'use strict';

/**
 * Apply owner reject13 round-2 decisions to review state + owner candidates.
 *   node scripts/apply-destination-photo-batch-02-reject13-owner-decisions.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy');

const repoRoot = path.join(__dirname, '..');
const decisionsPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-reject13-decisions.json'
);
const pairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-reject13-review-pairs.json');
const v1DecisionsPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-v1-decisions.json'
);
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json');
const batchPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-candidates.json');

const REVIEW_AT = '2026-11-05';
const REVIEW_BY = 'owner-visual-review-batch02-reject13';

/** Owner approved visually; block automatic production geo verification. */
const PRODUCTION_GEO_BLOCK_SLUGS = new Set([
  'aruba-oranjestad-aruba',
  'barbados-bridgetown-barbados',
  'belize-city-belize',
  'colon-panama',
]);

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function saveJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8');
}

function pushSubstring(list, marker) {
  if (!marker || list.includes(marker)) return;
  list.push(marker);
}

function basenameMarkerFromUrl(webpUrl) {
  const base = path.basename(String(webpUrl || ''), '.webp');
  return base || '';
}

function findCandidate(dest, decision) {
  if (decision.decision === 'REJECT_BOTH') return null;
  const slot = decision.decision === 'APPROVE_B' ? 'candidateB' : 'candidateA';
  const cand = dest[slot];
  if (!cand) throw new Error(`Missing ${slot} for ${dest.portSlug}`);
  const id = String(cand.providerImageId);
  const want = String(decision.providerImageId);
  if (id !== want) {
    throw new Error(`ID mismatch ${dest.portSlug} expected ${want} got ${id}`);
  }
  return cand;
}

function rejectCandidate(review, slug, cand, reason) {
  review.rejectedOwnerReplacementPhotos = review.rejectedOwnerReplacementPhotos || {};
  review.rejectedOwnerReplacementPhotos[slug] = {
    batchId: 'destination-photo-batch-02-reject13-round2-v1',
    url: cand.localAssetPath,
    provider: cand.provider,
    providerImageId: cand.providerImageId,
    sourcePageUrl: cand.sourcePageUrl,
    rejectedAt: REVIEW_AT,
    rejectedBy: REVIEW_BY,
    reason,
  };
  pushSubstring(review.rejectedUrlSubstrings, basenameMarkerFromUrl(cand.localAssetPath));
}

function buildHumanApproved(slug, cand, geoBlocked) {
  const entry = {
    url: cand.localAssetPath,
    provider: cand.provider,
    providerImageId: cand.providerImageId,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    licenseTerms: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: cand.geographicEvidence,
    approvedAt: REVIEW_AT,
    approvedBy: REVIEW_BY,
    batchId: 'destination-photo-batch-02-reject13-round2-v1',
    ownerDecision: cand.slot === 'B' ? 'APPROVE_B' : 'APPROVE_A',
    productionLicenseVerified: true,
    productionGeoVerified: !geoBlocked,
  };
  if (cand.unsplashPhotoId) entry.unsplashPhotoId = cand.unsplashPhotoId;
  if (geoBlocked) {
    entry.geoVerificationNote =
      'Owner visual approval only — generic or weak provider location metadata; do not treat as geographically verified for production.';
  }
  return entry;
}

function buildOwnerPort(cand, geoBlocked) {
  return {
    verificationStatus: geoBlocked ? 'OWNER_APPROVED_GEO_PENDING' : 'OWNER_APPROVED',
    provider: cand.provider,
    batchId: 'destination-photo-batch-02-reject13-round2-v1',
    directoryImageUrl: cand.localAssetPath,
    heroImageUrl: cand.localAssetPath,
    sourcePageUrl: cand.sourcePageUrl,
    photographer: cand.photographer,
    license: cand.licenseTerms,
    licenseUrl: cand.licenseUrl,
    depictedDestination: cand.geographicEvidence,
    ...(cand.provider === 'unsplash'
      ? { unsplashPhotoIds: { directoryAndHero: cand.providerImageId } }
      : { pexelsPhotoIds: { directoryAndHero: cand.providerImageId } }),
    productionLicenseVerified: true,
    productionGeoVerified: !geoBlocked,
    ownerApprovedAt: REVIEW_AT,
    notes: geoBlocked
      ? 'Reject13 round-2 owner pick — production geo verification blocked pending stronger evidence.'
      : 'Reject13 round-2 owner approved with provider location evidence.',
  };
}

function runNode(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function main() {
  const decisionsDoc = loadJson(decisionsPath);
  const pairs = loadJson(pairsPath);
  const v1Decisions = loadJson(v1DecisionsPath);
  const review = loadJson(reviewPath);
  const owner = loadJson(ownerPath);
  const batch = loadJson(batchPath);

  review.rejectedUrlSubstrings = review.rejectedUrlSubstrings || [];
  review.humanApproved = review.humanApproved || {};
  owner.ports = owner.ports || {};
  owner.policy = DESTINATION_POLICY_NOTE;

  const destBySlug = Object.fromEntries((pairs.destinations || []).map((d) => [d.portSlug, d]));

  if (decisionsDoc.decisions.length !== 13) {
    throw new Error('Expected 13 decisions');
  }

  for (const decision of decisionsDoc.decisions) {
    const dest = destBySlug[decision.portSlug];
    if (!dest) throw new Error(`No pair row ${decision.portSlug}`);

    if (decision.decision === 'REJECT_BOTH') {
      if (dest.candidateA) {
        pushSubstring(
          review.rejectedUrlSubstrings,
          basenameMarkerFromUrl(dest.candidateA.localAssetPath)
        );
      }
      if (dest.candidateB) {
        pushSubstring(
          review.rejectedUrlSubstrings,
          basenameMarkerFromUrl(dest.candidateB.localAssetPath)
        );
      }
      review.rejectedOwnerReplacementPhotos[decision.portSlug] = {
        batchId: 'destination-photo-batch-02-reject13-round2-v1',
        url: dest.candidateA?.localAssetPath || dest.candidateB?.localAssetPath,
        provider: dest.candidateA?.provider || dest.candidateB?.provider,
        providerImageId:
          dest.candidateA?.providerImageId || dest.candidateB?.providerImageId,
        rejectedAt: REVIEW_AT,
        rejectedBy: REVIEW_BY,
        reason: 'owner-reject13-round2-both',
        alsoRejectedProviderImageId: dest.candidateB?.providerImageId,
      };
      delete review.humanApproved[decision.portSlug];
      owner.ports[decision.portSlug] = {
        verificationStatus: 'NEEDS_REVIEW',
        batchId: 'destination-photo-batch-02-reject3-round3-v1',
        notes: 'Reject13 round-2 REJECT_BOTH — awaiting round-3 gallery.',
      };
      continue;
    }

    const selected = findCandidate(dest, decision);
    const other = selected.slot === 'A' ? dest.candidateB : dest.candidateA;
    if (other) rejectCandidate(review, decision.portSlug, other, 'owner-reject13-round2-not-selected');

    const geoBlocked = PRODUCTION_GEO_BLOCK_SLUGS.has(decision.portSlug);
    review.humanApproved[decision.portSlug] = buildHumanApproved(
      decision.portSlug,
      selected,
      geoBlocked
    );
    owner.ports[decision.portSlug] = buildOwnerPort(selected, geoBlocked);

    const batchRow = (batch.candidates || []).find((c) => c.portSlug === decision.portSlug);
    if (batchRow) {
      batchRow.reject13OwnerSelection = {
        provider: selected.provider,
        providerImageId: selected.providerImageId,
        localAssetPath: selected.localAssetPath,
        appliedAt: REVIEW_AT,
      };
    }
  }

  decisionsDoc.appliedAt = new Date().toISOString();
  v1Decisions.reject13Round2AppliedAt = REVIEW_AT;

  saveJson(reviewPath, review);
  saveJson(ownerPath, owner);
  saveJson(batchPath, batch);
  saveJson(decisionsPath, decisionsDoc);
  saveJson(v1DecisionsPath, v1Decisions);

  runNode('test-destination-photo-batch-02-apply-reject13-decisions.js');
  runNode('test-destination-image-source-policy.js');

  console.log('[apply-reject13-decisions] applied 10 selections + 3 REJECT_BOTH');
}

main();

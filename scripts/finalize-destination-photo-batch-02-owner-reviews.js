#!/usr/bin/env node
'use strict';

/**
 * Reconcile all 25 Batch 02 owner selections → humanApproved + owner candidates + catalog.
 *   node scripts/finalize-destination-photo-batch-02-owner-reviews.js
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { DESTINATION_POLICY_NOTE } = require('./lib/destinationImageSourcePolicy');
const {
  getProviderGeoContradiction,
  isExcludedFromPublicDirectoryRender,
} = require('./lib/destinationPhotoBatch02GeoPolicy');

const repoRoot = path.join(__dirname, '..');
const v1ResolvedPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-v1-resolved-decisions.json'
);
const reject13Path = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-reject13-decisions.json'
);
const reject3Path = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-reject3-decisions.json'
);
const v1PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-review-pairs.json');
const r13PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-reject13-review-pairs.json');
const r3PairsPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-reject3-review-pairs.json');
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json');
const batchPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-candidates.json');
const finalManifestPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json');

const REVIEW_AT = '2026-11-05';
const REVIEW_BY = 'owner-visual-review-batch02-final';

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
  return path.basename(String(webpUrl || ''), '.webp') || '';
}

function indexPairs(manifests) {
  const bySlug = {};
  for (const m of manifests) {
    for (const d of m.destinations || []) {
      bySlug[d.portSlug] = { ...(bySlug[d.portSlug] || {}), ...d };
    }
  }
  return bySlug;
}

function pickCandidate(dest, decision) {
  const slot = decision.decision === 'APPROVE_B' ? 'candidateB' : 'candidateA';
  const cand = dest[slot];
  if (!cand) throw new Error(`Missing ${slot} for ${decision.portSlug}`);
  if (String(cand.provider) !== String(decision.provider)) {
    throw new Error(`Provider mismatch ${decision.portSlug}`);
  }
  if (String(cand.providerImageId) !== String(decision.providerImageId)) {
    throw new Error(
      `ID mismatch ${decision.portSlug} expected ${decision.providerImageId} got ${cand.providerImageId}`
    );
  }
  return cand;
}

function buildHumanApproved(slug, cand, decision, batchId) {
  const contradiction = getProviderGeoContradiction(slug);
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
    batchId,
    ownerDecision: decision.decision,
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: false,
  };
  if (cand.unsplashPhotoId) entry.unsplashPhotoId = cand.unsplashPhotoId;
  if (contradiction) {
    entry.providerGeoContradiction = contradiction;
    entry.excludedFromPublicDirectoryRender = true;
  } else {
    entry.excludedFromPublicDirectoryRender = false;
  }
  return entry;
}

function buildOwnerPort(slug, cand, batchId) {
  const contradiction = getProviderGeoContradiction(slug);
  return {
    verificationStatus: contradiction ? 'OWNER_APPROVED_GEO_CONTRADICTION' : 'OWNER_APPROVED',
    provider: cand.provider,
    batchId,
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
    ownerVisuallyApproved: true,
    productionLicenseVerified: true,
    productionGeoVerified: false,
    excludedFromPublicDirectoryRender: Boolean(contradiction),
    ...(contradiction ? { providerGeoContradiction: contradiction } : {}),
    ownerApprovedAt: REVIEW_AT,
  };
}

function rejectAlternate(review, slug, cand, reason, batchId) {
  if (!cand?.localAssetPath) return;
  pushSubstring(review.rejectedUrlSubstrings, basenameMarkerFromUrl(cand.localAssetPath));
  const key = `${slug}__${cand.providerImageId}`;
  review.rejectedOwnerReplacementPhotos = review.rejectedOwnerReplacementPhotos || {};
  if (!review.rejectedOwnerReplacementPhotos[key]) {
    review.rejectedOwnerReplacementPhotos[key] = {
      batchId,
      url: cand.localAssetPath,
      provider: cand.provider,
      providerImageId: cand.providerImageId,
      sourcePageUrl: cand.sourcePageUrl,
      rejectedAt: REVIEW_AT,
      rejectedBy: REVIEW_BY,
      reason,
    };
  }
}

function runNode(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: repoRoot,
    stdio: 'inherit',
  });
}

function main() {
  const v1Resolved = loadJson(v1ResolvedPath);
  const reject13 = loadJson(reject13Path);
  const reject3 = loadJson(reject3Path);
  const v1Pairs = loadJson(v1PairsPath);
  const r13Pairs = loadJson(r13PairsPath);
  const r3Pairs = loadJson(r3PairsPath);
  const review = loadJson(reviewPath);
  const owner = loadJson(ownerPath);
  const batch = loadJson(batchPath);

  review.rejectedUrlSubstrings = review.rejectedUrlSubstrings || [];
  review.humanApproved = review.humanApproved || {};
  owner.ports = owner.ports || {};
  owner.policy = DESTINATION_POLICY_NOTE;

  const destBySlug = indexPairs([v1Pairs, r13Pairs, r3Pairs]);

  const allDecisions = [
    ...v1Resolved.decisions.map((d) => ({ ...d, batchId: v1Resolved.batchId })),
    ...reject13.decisions
      .filter((d) => d.decision !== 'REJECT_BOTH')
      .map((d) => ({ ...d, batchId: reject13.batchId })),
    ...reject3.decisions.map((d) => ({ ...d, batchId: reject3.batchId })),
  ];

  if (allDecisions.length !== 25) {
    throw new Error(`Expected 25 final decisions, got ${allDecisions.length}`);
  }

  const slugs = new Set(allDecisions.map((d) => d.portSlug));
  if (slugs.size !== 25) throw new Error('Duplicate slug in final decisions');

  let reconciled = 0;
  const finalRows = [];

  for (const decision of allDecisions) {
    const dest = destBySlug[decision.portSlug];
    if (!dest) throw new Error(`No pair data ${decision.portSlug}`);
    const selected = pickCandidate(dest, decision);
    const other =
      decision.decision === 'APPROVE_B' ? dest.candidateA : dest.candidateB;
    rejectAlternate(review, decision.portSlug, other, 'batch02-final-not-selected', decision.batchId);

    const existing = review.humanApproved[decision.portSlug];
    const next = buildHumanApproved(decision.portSlug, selected, decision, decision.batchId);
    const needsWrite =
      !existing ||
      existing.ownerVisuallyApproved !== true ||
      String(existing.providerImageId) !== String(selected.providerImageId) ||
      existing.url !== selected.localAssetPath ||
      existing.productionGeoVerified !== next.productionGeoVerified ||
      Boolean(existing.excludedFromPublicDirectoryRender) !==
        Boolean(next.excludedFromPublicDirectoryRender);

    if (needsWrite) {
      review.humanApproved[decision.portSlug] = next;
      reconciled += 1;
    }

    owner.ports[decision.portSlug] = buildOwnerPort(
      decision.portSlug,
      selected,
      decision.batchId
    );

    finalRows.push({
      portSlug: decision.portSlug,
      decision: decision.decision,
      provider: selected.provider,
      providerImageId: selected.providerImageId,
      sourcePageUrl: selected.sourcePageUrl,
      localAssetPath: selected.localAssetPath,
      productionGeoVerified: next.productionGeoVerified,
      ownerVisuallyApproved: true,
      excludedFromPublicDirectoryRender: Boolean(next.excludedFromPublicDirectoryRender),
      batchId: decision.batchId,
    });
  }

  saveJson(finalManifestPath, {
    batchId: 'destination-photo-batch-02-final',
    finalizedAt: new Date().toISOString(),
    total: 25,
    selections: finalRows,
  });

  v1Resolved.appliedAt = new Date().toISOString();
  reject3.appliedAt = new Date().toISOString();

  saveJson(reviewPath, review);
  saveJson(ownerPath, owner);
  saveJson(v1ResolvedPath, v1Resolved);
  saveJson(reject3Path, reject3);

  runNode('build-destination-image-catalog.js');
  runNode('regenerate-ports-index.js');
  runNode('test-destination-photo-batch-02-final-approvals.js');
  runNode('test-destination-photo-batch-02-scoped-release.js');
  runNode('test-destination-image-source-policy.js');
  runNode('test-ports-directory.js');

  console.log(
    `[finalize-batch02] reconciled=${reconciled} humanApproved=${Object.keys(review.humanApproved).filter((s) => finalRows.some((r) => r.portSlug === s)).length}`
  );
}

main();

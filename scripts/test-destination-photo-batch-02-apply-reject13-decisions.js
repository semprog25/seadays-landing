#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const decisionsPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-reject13-decisions.json'
);
const v1DecisionsPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-review-v1-decisions.json'
);
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'));
const v1 = JSON.parse(fs.readFileSync(v1DecisionsPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));

assert(decisions.appliedAt, 'reject13 decisions must be applied');
assert(decisions.decisions.length === 13, '13 decisions frozen');
assert(v1.rejectBoth.length === 13, 'v1 reject list unchanged');
assert(v1.approved.length === 12, 'v1 approved list unchanged');

const finalPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json');
const finalSlugs = new Set(
  fs.existsSync(finalPath)
    ? JSON.parse(fs.readFileSync(finalPath, 'utf8')).selections.map((r) => r.portSlug)
    : []
);

const geoBlock = new Set([
  'curacao-willemstad-curacao',
  'costa-maya-mexico',
]);

let approveCount = 0;
for (const d of decisions.decisions) {
  if (d.decision === 'REJECT_BOTH') {
    if (finalSlugs.has(d.portSlug)) continue;
    assert(!review.humanApproved?.[d.portSlug], `no humanApproved ${d.portSlug}`);
    continue;
  }
  approveCount += 1;
  const ha = review.humanApproved?.[d.portSlug];
  assert(ha, `humanApproved missing ${d.portSlug}`);
  assert(String(ha.providerImageId) === String(d.providerImageId), `id bind ${d.portSlug}`);
  assert(ha.ownerVisuallyApproved === true, `owner visual ${d.portSlug}`);
  if (geoBlock.has(d.portSlug)) {
    assert(ha.excludedFromPublicDirectoryRender === true, `geo contradiction exclude ${d.portSlug}`);
  } else {
    assert(ha.excludedFromPublicDirectoryRender !== true, `eligible ${d.portSlug}`);
  }
}

assert(approveCount === 10, '10 approved ports');

console.log('OK test-destination-photo-batch-02-apply-reject13-decisions');

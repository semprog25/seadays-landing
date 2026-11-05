#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  PROVIDER_GEO_CONTRADICTIONS,
  isExcludedFromPublicDirectoryRender,
} = require('./lib/destinationPhotoBatch02GeoPolicy');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const repoRoot = path.join(__dirname, '..');
const explicitPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-explicit-selections.json'
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
const finalPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json');
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
const indexPath = path.join(repoRoot, 'ports', 'index.html');

const explicit = JSON.parse(fs.readFileSync(explicitPath, 'utf8'));
const reject13 = JSON.parse(fs.readFileSync(reject13Path, 'utf8'));
const reject3 = JSON.parse(fs.readFileSync(reject3Path, 'utf8'));
const finalDoc = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const indexHtml = fs.readFileSync(indexPath, 'utf8');

const expectedBySlug = Object.create(null);
for (const row of [...explicit.v1ApproveA, ...explicit.v1ApproveB]) {
  expectedBySlug[row.portSlug] = row;
}
for (const d of reject13.decisions) {
  if (d.decision === 'REJECT_BOTH') continue;
  expectedBySlug[d.portSlug] = {
    portSlug: d.portSlug,
    provider: d.provider,
    providerImageId: d.providerImageId,
  };
}
for (const d of reject3.decisions) {
  expectedBySlug[d.portSlug] = {
    portSlug: d.portSlug,
    provider: d.provider,
    providerImageId: d.providerImageId,
  };
}

assert(Object.keys(expectedBySlug).length === 25, '25 expected owner IDs');
assert(finalDoc.selections.length === 25, '25 final rows');

for (const [slug, exp] of Object.entries(expectedBySlug)) {
  const row = finalDoc.selections.find((r) => r.portSlug === slug);
  assert(row, `final row ${slug}`);
  assert(String(row.providerImageId) === String(exp.providerImageId), `id match ${slug}`);
  assert(String(row.provider) === String(exp.provider), `provider ${slug}`);
  const ha = review.humanApproved?.[slug];
  assert(ha?.ownerVisuallyApproved === true, `owner visual ${slug}`);
  assert(ha?.productionLicenseVerified === true, `licence ${slug}`);
  assert(ha?.productionGeoVerified === false, `no manufactured geo verified ${slug}`);
  if (isExcludedFromPublicDirectoryRender(slug)) {
    assert(ha.excludedFromPublicDirectoryRender === true, `excluded flag ${slug}`);
    assert(ha.providerGeoContradiction, `contradiction doc ${slug}`);
    assert(!indexHtml.includes(ha.url), `excluded tile not in index ${slug}`);
  } else {
    assert(ha.excludedFromPublicDirectoryRender !== true, `eligible render ${slug}`);
    assert(indexHtml.includes(row.localAssetPath), `index tile ${slug}`);
  }
}

const excludedSlugs = Object.keys(PROVIDER_GEO_CONTRADICTIONS);
assert(excludedSlugs.length === 2, 'two contradictions');

let eligible = 0;
for (const row of finalDoc.selections) {
  if (!isExcludedFromPublicDirectoryRender(row.portSlug)) eligible += 1;
}
assert(eligible === 23, '23 eligible public photos');

assert(!/owner-review|reject13-debug|image-review-label/i.test(indexHtml), 'no debug labels');

console.log(
  `OK test-destination-photo-batch-02-scoped-release ownerApproved=25 eligiblePublic=${eligible} excluded=${excludedSlugs.length}`
);

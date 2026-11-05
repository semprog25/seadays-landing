#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const repoRoot = path.join(__dirname, '..');
const finalPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json');
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
const v1Path = path.join(repoRoot, 'data', 'destination-photo-batch-02-owner-review-v1-decisions.json');
const explicitPath = path.join(
  repoRoot,
  'data',
  'destination-photo-batch-02-owner-explicit-selections.json'
);
const {
  isExcludedFromPublicDirectoryRender,
} = require('./lib/destinationPhotoBatch02GeoPolicy');

assert(fs.existsSync(finalPath), 'final approvals manifest missing');
const finalDoc = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'));
const v1 = JSON.parse(fs.readFileSync(v1Path, 'utf8'));
const explicit = JSON.parse(fs.readFileSync(explicitPath, 'utf8'));

assert(finalDoc.total === 25, '25 selections');
assert(finalDoc.selections.length === 25, '25 rows');

for (const row of finalDoc.selections) {
  const ha = review.humanApproved?.[row.portSlug];
  assert(ha, `humanApproved ${row.portSlug}`);
  assert(ha.url === row.localAssetPath, `url ${row.portSlug}`);
  assert(String(ha.providerImageId) === String(row.providerImageId), `id ${row.portSlug}`);
  assert(ha.ownerVisuallyApproved === true, `owner visual ${row.portSlug}`);
  assert(ha.productionLicenseVerified === true, `license ${row.portSlug}`);
  assert(ha.productionGeoVerified === false, `no manufactured geo ${row.portSlug}`);
  const excluded = isExcludedFromPublicDirectoryRender(row.portSlug);
  assert(Boolean(ha.excludedFromPublicDirectoryRender) === excluded, `exclusion ${row.portSlug}`);

  const disk = path.join(repoRoot, row.localAssetPath.replace(/^\//, ''));
  assert(fs.existsSync(disk), `webp ${row.portSlug}`);
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', disk], {
    encoding: 'utf8',
  });
  const w = Number(out.match(/pixelWidth: (\d+)/)?.[1]);
  const h = Number(out.match(/pixelHeight: (\d+)/)?.[1]);
  assert(w > h, `landscape ${row.portSlug}`);
}

for (const exp of [...explicit.v1ApproveA, ...explicit.v1ApproveB]) {
  const row = finalDoc.selections.find((r) => r.portSlug === exp.portSlug);
  assert(row, `explicit v1 row ${exp.portSlug}`);
  assert(String(row.providerImageId) === String(exp.providerImageId), `explicit v1 id ${exp.portSlug}`);
}

assert(v1.rejectBoth.length === 13, 'v1 reject history preserved');
assert(v1.approved.length === 12, 'v1 approved list preserved');

const indexHtml = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8');
for (const row of finalDoc.selections) {
  if (isExcludedFromPublicDirectoryRender(row.portSlug)) {
    assert(!indexHtml.includes(row.localAssetPath), `excluded not in index ${row.portSlug}`);
    continue;
  }
  assert(indexHtml.includes(row.localAssetPath), `index tile ${row.portSlug}`);
}

console.log('OK test-destination-photo-batch-02-final-approvals ownerApproved=25');

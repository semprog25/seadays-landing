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

/** Port slug → row from OWNER_DOWNLOADS_53_APPLY_REPORT (verified apply manifest). */
function loadOwnerDownloads53ApplyByPortSlug(root) {
  const applyPath = path.join(
    root,
    'qa-evidence',
    'owner-downloads-reconcile-20261106',
    'OWNER_DOWNLOADS_53_APPLY_REPORT.json'
  );
  if (!fs.existsSync(applyPath)) return new Map();
  const doc = JSON.parse(fs.readFileSync(applyPath, 'utf8'));
  const map = new Map();
  for (const r of Array.isArray(doc.rows) ? doc.rows : []) {
    if (r && r.type === 'port' && r.slug) map.set(String(r.slug).trim(), r);
  }
  return map;
}

function assertLandscapeWebp(absPath, label) {
  assert(fs.existsSync(absPath), `webp ${label}`);
  const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', absPath], {
    encoding: 'utf8',
  });
  const w = Number(out.match(/pixelWidth: (\d+)/)?.[1]);
  const h = Number(out.match(/pixelHeight: (\d+)/)?.[1]);
  assert(w > h, `landscape ${label}`);
}

/**
 * Batch 02 final manifest is historical evidence; `humanApproved.url` may later match
 * OWNER_DOWNLOADS_53 when ownerDownloadsApply + apply report prove the replacement.
 */
function hasVerifiedOwnerDownloads53Supersession(ha, batchRow, applyRow) {
  if (!ha || !batchRow || !applyRow) return false;
  if (!ha.ownerDownloadsApply || typeof ha.ownerDownloadsApply !== 'object') return false;
  if (String(applyRow.slug || '').trim() !== String(batchRow.portSlug || '').trim()) return false;
  if (String(applyRow.type || '') !== 'port') return false;
  if (String(applyRow.verification || '') !== 'HASH_OK') return false;
  const expectedUrl = String(applyRow.newAssetWebp || '').trim();
  if (!expectedUrl || String(ha.url || '').trim() !== expectedUrl) return false;
  const prev = String(applyRow.previousUrl || '').trim();
  if (prev && prev !== String(batchRow.localAssetPath || '').trim()) return false;
  const oda = ha.ownerDownloadsApply;
  if (String(oda.imageSlot || '').trim() !== `port:${batchRow.portSlug}`) return false;
  if (String(oda.sourceSha256 || '') !== String(applyRow.sha256 || '')) return false;
  if (String(oda.planSha256 || '') && String(applyRow.sha256 || '') !== String(oda.planSha256 || ''))
    return false;
  return true;
}

const applyByPortSlug = loadOwnerDownloads53ApplyByPortSlug(repoRoot);

assert(finalDoc.total === 25, '25 selections');
assert(finalDoc.selections.length === 25, '25 rows');

for (const row of finalDoc.selections) {
  const ha = review.humanApproved?.[row.portSlug];
  assert(ha, `humanApproved ${row.portSlug}`);
  assert(String(ha.providerImageId) === String(row.providerImageId), `id ${row.portSlug}`);
  assert(ha.ownerVisuallyApproved === true, `owner visual ${row.portSlug}`);
  assert(ha.productionLicenseVerified === true, `license ${row.portSlug}`);
  assert(ha.productionGeoVerified === false, `no manufactured geo ${row.portSlug}`);
  const excluded = isExcludedFromPublicDirectoryRender(row.portSlug);
  assert(Boolean(ha.excludedFromPublicDirectoryRender) === excluded, `exclusion ${row.portSlug}`);

  const applyRow = applyByPortSlug.get(row.portSlug);
  const supersededBy53 = hasVerifiedOwnerDownloads53Supersession(ha, row, applyRow);

  if (supersededBy53) {
    assert(ha.url === applyRow.newAssetWebp, `active url ${row.portSlug}`);
    const activeDisk = path.join(repoRoot, String(ha.url).replace(/^\//, ''));
    assertLandscapeWebp(activeDisk, `${row.portSlug} active`);
    const histDisk = path.join(repoRoot, row.localAssetPath.replace(/^\//, ''));
    assert(fs.existsSync(histDisk), `historical webp ${row.portSlug}`);
    assertLandscapeWebp(histDisk, `${row.portSlug} historical batch02`);
  } else {
    assert(ha.url === row.localAssetPath, `url ${row.portSlug}`);
    const disk = path.join(repoRoot, row.localAssetPath.replace(/^\//, ''));
    assertLandscapeWebp(disk, row.portSlug);
  }
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

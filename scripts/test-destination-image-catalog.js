#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { buildDestinationImageCatalog, VERIFICATION } = require('./lib/destinationImageCatalog');
const { isApprovedDestinationPhotographyUrl } = require('./lib/destinationImageSourcePolicy');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const repoRoot = path.join(__dirname, '..');
const catalog = buildDestinationImageCatalog(repoRoot, {
  ports: [{ slug: 'hamburg-germany', country: 'Germany', region: 'Northern Europe' }],
});

assert(catalog.records.length >= 1, 'expected catalog records from manifests');
const hamburg = catalog.records.filter((r) => r.portSlug === 'hamburg-germany');
assert(hamburg.length >= 1, 'Hamburg entries present');
assert(
  hamburg.some((r) => r.verificationStatus === VERIFICATION.VERIFIED),
  'Hamburg should include VERIFIED human-approved row'
);

for (const rec of catalog.records) {
  if (!rec.displayUrl || !rec.displayUrl.startsWith('http')) continue;
  if (rec.displayUrl.includes('wikimedia.org')) {
    assert(false, `destination catalog must not list wikimedia display URLs: ${rec.portSlug}`);
  }
  if (rec.role.includes('destination') || rec.role.includes('thumbnail')) {
    assert(
      isApprovedDestinationPhotographyUrl(rec.displayUrl) || rec.verificationStatus === VERIFICATION.REJECTED,
      `non-approved destination URL in catalog: ${rec.portSlug} ${rec.displayUrl}`
    );
  }
}

console.log('OK test-destination-image-catalog');

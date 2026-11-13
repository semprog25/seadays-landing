#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadVerifiedShipHeroUrlBySlug, resetPortsDirectoryImageCachesForTests } = require('./lib/portsDirectoryImageResolve');
const { validateCatalogImageRecordV1 } = require('./lib/catalogImage/validateCatalogImageRecord');

const repoRoot = path.join(__dirname, '..');
const manifest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/aida-ship-directory-thumbnails-20261113.json'), 'utf8')
);
const expected = manifest.ships.map((s) => s.slug);

resetPortsDirectoryImageCachesForTests();
const bySlug = loadVerifiedShipHeroUrlBySlug(repoRoot);
const harvest = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/wikimedia-harvest/local-verified-records.json'), 'utf8')
);

for (const slug of expected) {
  const url = bySlug[slug];
  assert(url && url.includes('hero-directory-aida-owner-20261113.webp'), `${slug} directory url`);
  const rel = url.replace('https://seadays.app', '');
  const disk = path.join(repoRoot, rel.replace(/^\//, ''));
  assert(fs.existsSync(disk), `${slug} webp on disk`);
  const rec = harvest.recordsByKey[`ship:image:hero:${slug}`];
  const validation = validateCatalogImageRecordV1(rec, { expectedCanonicalSlug: slug, expectedKind: 'ship' });
  assert(validation.ok, `${slug} record valid`);
}

const html = fs.readFileSync(path.join(repoRoot, 'ships/index.html'), 'utf8');
const catalogMatch = html.match(/id="shipsDirectoryCatalog">([\s\S]*?)<\/script>/);
assert(catalogMatch, 'catalog json');
const catalog = JSON.parse(catalogMatch[1]);
for (const slug of expected) {
  const row = catalog.find((s) => s.slug === slug);
  assert(row && row.imgUrl && row.imgUrl.includes(slug), `${slug} catalog imgUrl`);
}

console.log('OK test-aida-ship-directory-thumbnails-20261113', { ships: expected.length });

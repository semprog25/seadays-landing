#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { buildDestinationImageCatalog } = require('./lib/destinationImageCatalog');

const repoRoot = path.join(__dirname, '..');
const outPath = path.join(repoRoot, 'data', 'destination-image-catalog.json');

const ports = APP_ALL_PORTS.map((p) => ({
  slug: p.slug,
  country: p.country || '',
  region: p.region || '',
}));

const catalog = buildDestinationImageCatalog(repoRoot, { ports });
fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');

console.log(
  `[build-destination-image-catalog] ports=${catalog.portCatalogueSize} records=${catalog.recordCount} ` +
    `verified=${catalog.statusCounts.VERIFIED || 0} needs_review=${catalog.statusCounts.NEEDS_REVIEW || 0} ` +
    `missing=${catalog.statusCounts.MISSING || 0} rejected=${catalog.statusCounts.REJECTED || 0}`
);
console.log(`[build-destination-image-catalog] wrote ${path.relative(repoRoot, outPath)}`);

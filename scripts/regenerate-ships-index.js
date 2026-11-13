#!/usr/bin/env node
'use strict';

/**
 * Regenerate /ships/index.html with Wikimedia hero thumbnails from local harvest manifest.
 *
 * Usage:
 *   node scripts/regenerate-ships-index.js
 */

const fs = require('fs');
const path = require('path');
const { buildShipsIndexHtml } = require('./generateBlogs');
const { buildSeoShipRecords } = require('./lib/seoShipPortPages');
const { allShips: APP_ALL_SHIPS } = require('./lib/appCruiseDataset');
const { enrichSeoShipsForDirectoryIndex } = require('./lib/portsDirectoryImageResolve');

const repoRoot = path.join(__dirname, '..');
const indexPath = path.join(repoRoot, 'ships/index.html');

function extractFeaturedGuidesFromExisting() {
  if (!fs.existsSync(indexPath)) return '';
  const html = fs.readFileSync(indexPath, 'utf8');
  const m = html.match(/<div class="featured-guides-grid">([\s\S]*?)<\/div>\s*<\/section>/);
  return m ? m[1].trim() : '';
}

function main() {
  const activeShips = APP_ALL_SHIPS.filter((s) => !s.status || s.status === 'active');
  const seoShips = buildSeoShipRecords(activeShips);
  enrichSeoShipsForDirectoryIndex(seoShips, { repoRoot });
  const withPhotos = seoShips.filter((s) => String(s.directoryImageUrl || '').trim()).length;
  const html = buildShipsIndexHtml({
    ships: seoShips,
    articles: [],
    featuredGuideCardsHtml: extractFeaturedGuidesFromExisting(),
  });
  fs.writeFileSync(indexPath, html, 'utf8');
  console.log(
    `[regenerate-ships-index] wrote ships/index.html ships=${seoShips.length} withPhotos=${withPhotos}`
  );
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'ships/index.html'), 'utf8');
const clientSrc = require('./lib/shipsDirectoryClient')();

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const catalogMatch = html.match(
  /<script type="application\/json" id="shipsDirectoryCatalog">([\s\S]*?)<\/script>/
);
assert(catalogMatch, 'ships catalog JSON block present');
const catalog = JSON.parse(catalogMatch[1]);
assert(Array.isArray(catalog) && catalog.length >= 280, 'catalog has full ship list');

const domCards = (html.match(/id="directoryGrid"[^>]*>[\s\S]*?<\/div>/) || [''])[0];
const cardTagsInGrid = (domCards.match(/class="seo-grid-card directory-card/g) || []).length;
assert(cardTagsInGrid === 0, 'directory grid must start empty in HTML (client renders cards)');

assert(html.includes('id="shipsLoadMore"'), 'load more control present');
assert(html.includes('id="shipsLoadMoreWrap"'), 'load more wrapper present');

assert(clientSrc.includes('SHIP_PAGE_SIZE = 6'), 'page size is 6');
assert(clientSrc.includes('grid.replaceChildren()'), 'client rebuilds grid DOM');
assert(clientSrc.includes('matched.slice(0, shownLen)'), 'only visible slice rendered');
assert(clientSrc.includes('visibleCount = SHIP_PAGE_SIZE'), 'resets page size on filter/search');
assert(clientSrc.includes('bindHorizontalWheelScroll(popularLinePills)'), 'line carousel wheel helper');

console.log(`OK test-ships-directory-progressive (catalog=${catalog.length} ships)`);

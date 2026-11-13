#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'ships/index.html'), 'utf8');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const catalogMatch = html.match(
  /<script type="application\/json" id="shipsDirectoryCatalog">([\s\S]*?)<\/script>/
);
assert(catalogMatch, 'ships catalog JSON present');
const catalog = JSON.parse(catalogMatch[1]);
assert(catalog.length >= 280, 'expected full ship catalogue in JSON');

const clientModule = require('./lib/shipsDirectoryClient.js');
const client = clientModule();

assert(!html.includes('id="primaryPills"'), 'legacy multi-row line pills removed');
assert(!html.includes('id="subpillWrap"'), 'secondary ship pill row removed');
assert(html.includes('id="shipsReset"'), 'All ships reset control present');
assert(html.includes('id="filterLine"'), 'cruise line select present');
assert(html.includes('id="popularLinePills"'), 'popular line scroller present');
assert(html.includes('ships-popular-lines-wrap'), 'scroll fade affordance wrapper');
assert(html.includes('scrollbar-width: none'), 'popular lines hide native scrollbar');
assert(!html.includes('ships-popular-lines::-webkit-scrollbar { height: 6px'), 'no visible webkit scrollbar height');
assert(html.includes('id="shipsResultsMeta"'), 'results meta present');
assert(html.includes('Search ships or cruise lines'), 'search placeholder');
assert(html.includes('View ship guide →'), 'ship card CTA copy');

assert(client.includes("state.line = '__all__'"), 'default line is all ships');
assert(!client.includes('applyFilter(initialGroup'), 'must not pre-filter first cruise line');
assert(client.includes('shipsDirV2'), 'URL history state for ships directory');
assert(client.includes('SHIP_PAGE_SIZE = 6'), 'progressive page size');
assert(html.includes('directory-crawl-fallback'), 'noscript crawl fallback present');
const noscriptBlock = (html.match(/<noscript>[\s\S]*?<\/noscript>/i) || [''])[0];
const noscriptLinks = noscriptBlock.match(/href="\/ships\//g);
assert(noscriptLinks && noscriptLinks.length >= catalog.length, 'noscript lists all ship canonical links');

console.log(`OK test-ships-directory-filter (${catalog.length} ships in catalog)`);

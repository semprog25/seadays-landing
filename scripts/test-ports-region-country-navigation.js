#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'ports/index.html'), 'utf8');
const clientModule = require('./lib/portsDirectoryIndex.client.js');
const clientSrc = clientModule().replace(/^\(function\(\)\{/, '').replace(/\}\)\(\);$/, '');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

assert(html.includes('id="filterRegion"'), 'region <select> fallback in filter bar');
assert(html.includes('id="filterCountry"'), 'country <select> fallback in filter bar');
assert(html.includes('id="portsDirectoryCountryImages"'), 'country images manifest injected');
assert(html.includes('country-card-media'), 'country card photo styles in index');

const scriptMatch = html.match(
  /<script type="application\/json" id="portsDirectoryCountryImages">([\s\S]*?)<\/script>/
);
assert(scriptMatch, 'country images JSON block');
const countryImages = JSON.parse(scriptMatch[1]);
assert(typeof countryImages === 'object', 'country images parse');

const germanyCards = (html.match(/data-country="germany"/g) || []).length;
assert(germanyCards >= 6, 'expected at least 6 Germany port cards in HTML');

function countNorthernEuropeGermany(htmlText) {
  const re =
    /data-country="germany"[^>]*data-region="(Northern Europe|North Sea|Scandinavia|Arctic)"/g;
  let n = 0;
  let m;
  while ((m = re.exec(htmlText))) n += 1;
  const re2 =
    /data-region="(Northern Europe|North Sea|Scandinavia|Arctic)"[^>]*data-country="germany"/g;
  while ((m = re2.exec(htmlText))) n += 1;
  return n;
}

const neGermany = countNorthernEuropeGermany(html);
assert(neGermany === 6, `Northern Europe pool should include 6 Germany ports, got ${neGermany}`);

assert(!clientSrc.includes('needsCountrySubregionStep'), 'client must not gate on subregion step');
assert(clientSrc.includes('function portsResultsActive'), 'portsResultsActive helper');
assert(
  clientSrc.includes("state.country && state.country !== '__all__'") &&
    clientSrc.includes('return true'),
  'selecting a country activates port results'
);

assert(clientSrc.includes('function returnToAllRegions'), 'returnToAllRegions helper');
assert(clientSrc.includes('Back to regions'), 'back to regions label');
assert(
  clientSrc.includes('returnToAllRegions()') || clientSrc.includes('returnToAllRegions({'),
  'returnToAllRegions used for country reset'
);
assert(clientSrc.includes('clearRegionSelection()'), 'clears region when returning to gallery');
assert(clientSrc.includes('resetBtn.hidden'), 'clear-filters button shown only when filters active');

console.log('OK test-ports-region-country-navigation');

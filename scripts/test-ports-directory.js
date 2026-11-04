'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  DEFAULT_FEATURED_SLUGS,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_FEATURED_SIZE,
  buildPortsIndexHtml,
  loadRegionImageManifest,
} = require('./lib/portsDirectoryIndex');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'ports/index.html');
const html = fs.readFileSync(indexPath, 'utf8');

assert.ok(html.includes('directory-hero--compact'), 'compact hero class');
assert.ok(!html.includes('directory-hero-art'), 'oversized hero art removed');
assert.ok(html.includes('directory-section--search'), 'search-first section');
assert.ok(html.includes('id="portSearch"'), 'port search input');
assert.ok(html.includes('id="resultsMeta"'), 'results meta');
assert.ok(html.includes('aria-live="polite"'), 'aria-live on results');
assert.ok(html.includes('id="browseAllPorts"'), 'browse all control');
assert.ok(html.includes('id="directoryLoadMore"'), 'load more control');
assert.ok(html.includes('<noscript>'), 'noscript crawl fallback');
assert.ok(html.includes('directory-crawl-list'), 'crawl link list');
assert.ok(!html.includes('>Sort: Popular<'), 'Popular sort removed');
assert.ok(html.includes('directory-card-image'), 'image-first cards');
assert.ok(html.includes('region-card-image'), 'region image cards');

const featuredInHtml = (html.match(/data-featured="1"/g) || []).length;
assert.strictEqual(featuredInHtml, DEFAULT_FEATURED_SLUGS.length, 'featured card count');
DEFAULT_FEATURED_SLUGS.forEach((slug) => {
  assert.ok(
    html.includes(`data-item="${slug}"`) && html.includes(`data-featured="1"`),
    `featured slug present: ${slug}`
  );
});

assert.match(html, /rel="canonical" href="https:\/\/seadays\.app\/ports\/"/);
const cardCount = (html.match(/class="seo-grid-card directory-card"/g) || []).length;
assert.ok(cardCount >= 400, 'directory grid has crawlable cards');

const overrides = JSON.parse(
  fs.readFileSync(path.join(root, 'data/landing-cruise-content-overrides.json'), 'utf8')
);
assert.ok(
  overrides.ports['skagen-denmark'].description.includes('northernmost town'),
  'Skagen override'
);
assert.ok(
  overrides.ports['la-paz-mexico'].description.includes('Baja California Sur'),
  'La Paz override'
);
assert.ok(
  html.includes('Skagen is Denmark&#39;s northernmost town') ||
    html.includes("Skagen is Denmark's northernmost town"),
  'Skagen blurb on directory'
);
assert.ok(html.includes('La Paz is the capital of Baja California Sur'), 'La Paz blurb on directory');

assert.strictEqual(DIRECTORY_PAGE_SIZE, 24);
assert.strictEqual(DIRECTORY_FEATURED_SIZE, 12);

const regionImages = loadRegionImageManifest(root);
assert.ok(Object.keys(regionImages).length >= 5, 'region image manifest');

const sampleHtml = buildPortsIndexHtml({
  ports: [
    {
      slug: 'test-port',
      displayName: 'Test Port',
      country: 'Testland',
      region: 'Test Region',
      searchAliases: 'test',
      hasBookableExperiences: true,
      directoryBlurb: 'Short blurb.',
    },
  ],
  indexStyles: '',
  analyticsHeadHtml: '',
  runtimeGuardScript: '',
  regionImages: { 'Test Region': 'https://seadays.app/example.jpg' },
});
assert.ok(sampleHtml.includes('directory-hero--compact'), 'builder smoke');

console.log('ports directory v2 tests: ok');

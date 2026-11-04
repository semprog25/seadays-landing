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
assert.ok(html.includes('region-card--text-first') || html.includes('region-card-media'), 'region cards');
assert.ok(html.includes('region-scroll-hint'), 'region scroll hint');
assert.ok(!html.includes('region-card-image region-card-image--placeholder'), 'no oversized region image placeholders');

const featuredInHtml = (html.match(/data-featured="1"/g) || []).length;
assert.strictEqual(featuredInHtml, DEFAULT_FEATURED_SLUGS.length, 'featured card count');
DEFAULT_FEATURED_SLUGS.forEach((slug) => {
  assert.ok(
    html.includes(`data-item="${slug}"`) && html.includes(`data-featured="1"`),
    `featured slug present: ${slug}`
  );
});

assert.match(html, /rel="canonical" href="https:\/\/seadays\.app\/ports\/"/);
const cardCount = (html.match(/class="seo-grid-card directory-card[^"]*"/g) || []).length;
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

const skagenPage = fs.readFileSync(path.join(root, 'ports/skagen-denmark/index.html'), 'utf8');
const laPazPage = fs.readFileSync(path.join(root, 'ports/la-paz-mexico/index.html'), 'utf8');
assert.ok(html.includes('data-item="skagen-denmark"'), 'Skagen in directory grid');
assert.ok(html.includes('data-item="la-paz-mexico"'), 'La Paz in directory grid');
assert.ok(!skagenPage.includes('Fossil Group'), 'Skagen guide: no watch brand bleed');
assert.ok(skagenPage.includes('northernmost town'), 'Skagen guide: Danish town copy');
assert.ok(!laPazPage.includes('capital of Bolivia'), 'La Paz guide: no Bolivia bleed');
assert.ok(laPazPage.includes('Baja California Sur'), 'La Paz guide: Baja copy');

const portCardImgRe = /<img class="directory-card-image[^"]*" src="([^"]+)"/g;
let verifiedPortPhotos = 0;
let blogMisuse = 0;
let match;
while ((match = portCardImgRe.exec(html))) {
  const src = match[1];
  if (src.includes('blog-images/materialized')) blogMisuse += 1;
  else verifiedPortPhotos += 1;
}
assert.strictEqual(blogMisuse, 0, 'port cards must not use generic blog imagery');

const textFirstCount = (html.match(/directory-card--text-first/g) || []).length;
assert.ok(textFirstCount >= cardCount - verifiedPortPhotos - 1, 'text-first cards where no photo');

let featuredVerified = 0;
let featuredTextFirst = 0;
for (const slug of DEFAULT_FEATURED_SLUGS) {
  const needle = `data-item="${slug}"`;
  const idx = html.indexOf(needle);
  assert.ok(idx !== -1, `featured slug in grid: ${slug}`);
  const slice = html.slice(idx, idx + 1400);
  if (slice.includes('<img class="directory-card-image')) featuredVerified += 1;
  else if (slice.includes('directory-card--text-first')) featuredTextFirst += 1;
}
assert.strictEqual(featuredVerified + featuredTextFirst, DEFAULT_FEATURED_SLUGS.length);
assert.ok(featuredVerified >= 1, 'at least one verified port photo (e.g. Hamburg)');
assert.ok(featuredTextFirst >= 1, 'text-first cards where no port photo exists');

console.log(
  `[coverage] cards=${cardCount} verifiedPortPhotos=${verifiedPortPhotos} textFirst=${textFirstCount} featuredPhotos=${featuredVerified} featuredTextFirst=${featuredTextFirst} htmlBytes=${Buffer.byteLength(html, 'utf8')}`
);

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
  regionImages: { 'Test Region': { imageUrl: 'https://seadays.app/example.jpg', alt: 'Test' } },
});
assert.ok(sampleHtml.includes('directory-hero--compact'), 'builder smoke');

console.log('ports directory v2 tests: ok');

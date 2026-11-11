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
  resolveDirectoryPorts,
} = require('./lib/portsDirectoryIndex');
const { buildPortAliasRedirectMap } = require('./lib/portBrowseAliases');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const {
  loadLandingCruiseContentOverrides,
  applyPortContentOverride,
} = require('./lib/landingCruiseContentOverrides');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'ports/index.html');
const html = fs.readFileSync(indexPath, 'utf8');

assert.ok(html.includes('directory-hero--compact'), 'compact hero class');
assert.ok(!html.includes('directory-hero-art'), 'oversized hero art removed');
assert.ok(html.includes('directory-section--search'), 'search-first section');
assert.ok(html.includes('id="portSearch"'), 'port search input');
assert.ok(html.includes('id="filterRegion"'), 'keyboard-accessible region select');
assert.ok(html.includes('id="filterCountry"'), 'keyboard-accessible country select');
assert.ok(html.includes('id="resultsMeta"'), 'results meta');
assert.ok(html.includes('aria-live="polite"'), 'aria-live on results');
assert.ok(html.includes('id="directoryReset"'), 'clear filters control');
assert.ok(html.includes('Clear filters'), 'clear filters label');
assert.ok(html.includes('id="browseAllPorts"'), 'browse all control');
assert.ok(html.includes('id="directoryLoadMore"'), 'load more control');
assert.ok(html.includes('<noscript>'), 'noscript crawl fallback');
assert.ok(html.includes('directory-crawl-list'), 'crawl link list');
assert.ok(!html.includes('>Sort: Popular<'), 'Popular sort removed');
assert.ok(html.includes('directory-card-image'), 'image-first cards');
assert.ok(html.includes('region-card-media'), 'region cards with media');
assert.ok(html.includes('region-scroll-hint'), 'region scroll hint');
assert.ok(!html.includes('region-card-image region-card-image--placeholder'), 'no oversized region image placeholders');

const regionBrowseStart = html.indexOf('id="regionBrowse"');
const regionBrowseEnd = html.indexOf('id="countryBrowseSection"');
const regionBrowseHtml =
  regionBrowseStart >= 0 && regionBrowseEnd > regionBrowseStart
    ? html.slice(regionBrowseStart, regionBrowseEnd)
    : html;
assert.ok(
  !regionBrowseHtml.includes('region-card--text-first'),
  'priority region browse cards must all show thumbnails'
);
const regionPexelsInBrowse = (regionBrowseHtml.match(/region-card-image" src="https:\/\/images\.pexels\.com/g) || [])
  .length;
const regionOwnerAssetsInBrowse = (regionBrowseHtml.match(
  /region-card-image" src="\/assets\/img\/ports-directory\/regions\//g
) || []).length;
assert.ok(
  regionPexelsInBrowse + regionOwnerAssetsInBrowse >= 10,
  'region browse uses photography (owner assets or Pexels)'
);

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
const cruiseContentOverrides = loadLandingCruiseContentOverrides();
const fullPortRawList = APP_ALL_PORTS.map((p) => {
  const slug = String(p.slug || '').trim();
  const country = p.country || '';
  const label = String(p.name || '').trim();
  const portName =
    country && label.toLowerCase().endsWith(`, ${String(country).toLowerCase()}`)
      ? label.slice(0, -2 - String(country).length).trim()
      : label || slug;
  const base = {
    id: slug,
    slug,
    portName,
    country,
    region: p.region || '',
    description: '',
    highlights: [],
    rating: null,
    reviewCount: null,
  };
  return applyPortContentOverride(base, cruiseContentOverrides.ports[slug]);
});
const { directoryPorts } = resolveDirectoryPorts(buildSeoPortRecords(fullPortRawList));
const expectedDirectoryCardCount = directoryPorts.length;
assert.strictEqual(
  cardCount,
  expectedDirectoryCardCount,
  `directory grid card count (aliases excluded): expected ${expectedDirectoryCardCount}, got ${cardCount}`
);

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
assert.ok(
  skagenPage.includes('northernmost cruise stop'),
  'Skagen guide: passenger editorial northernmost cruise stop copy'
);
assert.ok(!laPazPage.includes('capital of Bolivia'), 'La Paz guide: no Bolivia bleed');
assert.ok(laPazPage.includes('Baja California Sur'), 'La Paz guide: Baja copy');

const gridBlockMatch = html.match(/id="directoryGrid">([\s\S]*?)<\/div>\s*<div class="directory-load-more-wrap"/i);
const gridHtml = gridBlockMatch ? gridBlockMatch[1] : html;

const portCardImgRe = /<img class="directory-card-image[^"]*" src="([^"]+)"/g;
let verifiedPortPhotos = 0;
let blogMisuse = 0;
let match;
while ((match = portCardImgRe.exec(gridHtml))) {
  const src = match[1];
  if (src.includes('blog-images/materialized')) blogMisuse += 1;
  else if (src.includes('seadays-no-image.webp')) {
    /* decorative placeholder — not a verified destination photo */
  } else verifiedPortPhotos += 1;
}
assert.strictEqual(blogMisuse, 0, 'port cards must not use generic blog imagery');

assert(!html.includes('Photo pending'), 'public ports index must not show Photo pending');
assert(!html.includes('directory-coverage-note'), 'public ports index must not show coverage note');
assert(!html.includes('directoryCoverageNote'), 'public ports index must not show coverage note id');

const listRowCount = (gridHtml.match(/directory-port-list-item/g) || []).length;
const photoTileCount = (gridHtml.match(/data-verified-photo="1"/g) || []).length;
assert.strictEqual(photoTileCount, verifiedPortPhotos, 'photo tile count matches verified images');

const verifiedSrcRe = /<img class="directory-card-image[^"]*" src="([^"]+)"/g;
let missingVerifiedAssets = [];
while ((match = verifiedSrcRe.exec(gridHtml))) {
  const src = match[1];
  if (src.includes('seadays-no-image.webp')) continue;
  const rel = src.replace(/^\//, '');
  if (!fs.existsSync(path.join(root, rel))) missingVerifiedAssets.push(src);
}
assert.strictEqual(
  missingVerifiedAssets.length,
  0,
  `verified port photo assets must exist on disk: ${missingVerifiedAssets.slice(0, 5).join(', ')}`
);

assert.strictEqual(listRowCount, 0, 'directory uses card grid only, no list rows');
assert.ok(
  html.includes('seadays-no-image.webp'),
  'ports index references owner no-photo placeholder asset'
);
const reviewPromoCount = (html.match(/Want the full reviews\?/g) || []).length;
assert.strictEqual(reviewPromoCount, 1, 'exactly one review promotion on ports index');
assert.ok(
  (gridHtml.match(/directory-card-media--neutral/g) || []).length >= cardCount - photoTileCount - 1,
  'ports without verified photos use neutral card media with no-photo image'
);

let featuredVerified = 0;
let featuredTextFirst = 0;
for (const slug of DEFAULT_FEATURED_SLUGS) {
  const needle = `data-item="${slug}"`;
  const idx = html.indexOf(needle);
  assert.ok(idx !== -1, `featured slug in grid: ${slug}`);
  const slice = html.slice(idx, idx + 1400);
  if (slice.includes('<img class="directory-card-image')) featuredVerified += 1;
  else if (slice.includes('directory-card-media--neutral')) featuredVerified += 1;
  else if (slice.includes('directory-port-list-item')) featuredTextFirst += 1;
}
assert.strictEqual(featuredVerified + featuredTextFirst, DEFAULT_FEATURED_SLUGS.length);
assert.ok(featuredVerified >= 1, 'at least one featured port card (photo or neutral media)');
assert.strictEqual(featuredTextFirst, 0, 'featured ports must not use list rows');

console.log(
  `[coverage] cards=${cardCount} verifiedPortPhotos=${verifiedPortPhotos} listRows=${listRowCount} photoTiles=${photoTileCount} featuredPhotos=${featuredVerified} featuredListRows=${featuredTextFirst} htmlBytes=${Buffer.byteLength(html, 'utf8')}`
);

assert.strictEqual(DIRECTORY_PAGE_SIZE, 24);
assert.strictEqual(DIRECTORY_FEATURED_SIZE, 12);

const regionImages = loadRegionImageManifest(root);
assert.ok(Object.keys(regionImages).length >= 12, 'region image manifest covers priority regions');

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

const gridStart = html.indexOf('id="directoryGrid"');
const gridEnd = html.indexOf('id="directoryLoadMore"');
const directoryGridHtml =
  gridStart >= 0 && gridEnd > gridStart ? html.slice(gridStart, gridEnd) : html;
const aliasCardsInGrid = Object.keys(buildPortAliasRedirectMap()).filter((slug) =>
  directoryGridHtml.includes(`data-item="${slug}"`)
);
assert.strictEqual(
  aliasCardsInGrid.length,
  0,
  `redirect aliases must not appear in browse grid: ${aliasCardsInGrid.join(', ')}`
);

console.log('ports directory v2 tests: ok');

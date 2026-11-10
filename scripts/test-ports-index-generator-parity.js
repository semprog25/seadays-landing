#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');
const { buildPortAliasRedirectMap } = require('./lib/portBrowseAliases');
const { resolveDirectoryPorts } = require('./lib/portsDirectoryIndex');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { loadLandingCruiseContentOverrides, applyPortContentOverride } = require('./lib/landingCruiseContentOverrides');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function normalizePortsIndexHtml(html) {
  return String(html || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readMarkers(html) {
  return {
    verified: (html.match(/data-verified-photo="1"/g) || []).length,
    bookable: (html.match(/data-bookable="1"/g) || []).length,
    items: (html.match(/data-item="/g) || []).length,
    devPreview: html.includes('seadays-dev-preview'),
    reviewPromo: (html.match(/Want the full reviews/g) || []).length,
    guardNoPhoto: html.includes("var FB='/assets/img/ports-directory/seadays-no-image.webp'"),
  };
}

function extractDirectoryItemSlugs(html) {
  const slugs = [];
  const re = /data-item="([^"]+)"/g;
  let match;
  while ((match = re.exec(String(html || '')))) {
    slugs.push(match[1]);
  }
  return slugs;
}

/** Same catalogue + alias rules as regenerate-ports-index (browse grid identity only). */
function expectedDirectoryCatalog(repoRoot) {
  const cruiseContentOverrides = loadLandingCruiseContentOverrides();
  const indexPath = path.join(repoRoot, 'ports', 'index.html');
  const existingRatings = new Map();
  if (fs.existsSync(indexPath)) {
    const html = fs.readFileSync(indexPath, 'utf8');
    const re =
      /href="\/ports\/([^"]+)\/"[^>]*class="seo-grid-card directory-card"[^>]*>([\s\S]*?)<\/a>/g;
    let match;
    while ((match = re.exec(html))) {
      const slug = match[1];
      const body = match[2];
      const num = body.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
      if (num) existingRatings.set(slug, Number(num[1]));
    }
  }
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
      rating: existingRatings.get(slug) || null,
      reviewCount: null,
    };
    return applyPortContentOverride(base, cruiseContentOverrides.ports[slug]);
  });
  const seoPorts = buildSeoPortRecords(fullPortRawList);
  const { directoryPorts, aliasToCanonical } = resolveDirectoryPorts(seoPorts);
  const visibleSlugSet = new Set(directoryPorts.map((p) => String(p.slug || '').trim()));
  return {
    cataloguePortCount: seoPorts.length,
    visibleCardCount: directoryPorts.length,
    visibleSlugSet,
    aliasToCanonical,
    redirectAliasMap: buildPortAliasRedirectMap(),
  };
}

function assertDirectoryGridIdentity(html, label, expected) {
  const slugs = extractDirectoryItemSlugs(html);
  assert(slugs.length === expected.visibleCardCount, `${label}: card count ${slugs.length} !== ${expected.visibleCardCount}`);
  const slugSet = new Set(slugs);
  assert(slugSet.size === slugs.length, `${label}: duplicate data-item slugs in grid`);
  for (const slug of expected.visibleSlugSet) {
    assert(slugSet.has(slug), `${label}: missing canonical browse card ${slug}`);
  }
  for (const slug of slugSet) {
    assert(expected.visibleSlugSet.has(slug), `${label}: unexpected browse card ${slug}`);
  }
  for (const alias of Object.keys(expected.redirectAliasMap)) {
    assert(!slugSet.has(alias), `${label}: redirect alias must not be a card: ${alias}`);
  }
  for (const canon of new Set(Object.values(expected.redirectAliasMap))) {
    if (expected.visibleSlugSet.has(canon)) continue;
    assert(
      !APP_ALL_PORTS.some((p) => String(p.slug || '') === canon),
      `${label}: redirect target ${canon} missing from catalogue`
    );
  }
}

const sourceRoot = path.join(__dirname, '..');
const repoNodeModules = path.join(sourceRoot, 'node_modules');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-ports-parity-'));
const repoRoot = tempRoot;

execFileSync('rsync', ['-a', '--exclude', 'node_modules', '--exclude', '.git', `${sourceRoot}/`, `${repoRoot}/`], {
  stdio: 'pipe',
});
if (!fs.existsSync(repoNodeModules)) {
  console.error('FAIL: run npm ci so node_modules exists before parity test');
  process.exit(1);
}
fs.symlinkSync(repoNodeModules, path.join(repoRoot, 'node_modules'));

const indexPath = path.join(repoRoot, 'ports', 'index.html');
const env = { ...process.env, SEADAYS_PORTS_INDEX_ONLY: '1' };

try {
  execFileSync('node', ['scripts/regenerate-ports-index.js'], { cwd: repoRoot, stdio: 'pipe', env });
  const regen1 = fs.readFileSync(indexPath, 'utf8');
  execFileSync('node', ['scripts/regenerate-ports-index.js'], { cwd: repoRoot, stdio: 'pipe', env });
  const regen2 = fs.readFileSync(indexPath, 'utf8');
  assert(normalizePortsIndexHtml(regen1) === normalizePortsIndexHtml(regen2), 'regenerate twice must match');

  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env,
    maxBuffer: 25 * 1024 * 1024,
  });
  const gen1 = fs.readFileSync(indexPath, 'utf8');
  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env,
    maxBuffer: 25 * 1024 * 1024,
  });
  const gen2 = fs.readFileSync(indexPath, 'utf8');
  assert(normalizePortsIndexHtml(gen1) === normalizePortsIndexHtml(gen2), 'generateBlogs --ports-only twice must match');

  const expected = expectedDirectoryCatalog(repoRoot);
  const mRegen = readMarkers(regen2);
  const mGen = readMarkers(gen2);
  assert(mRegen.verified === mGen.verified, `verified photos regen=${mRegen.verified} gen=${mGen.verified}`);
  assert(mRegen.bookable === mGen.bookable, `bookable flags regen=${mRegen.bookable} gen=${mGen.bookable}`);
  assert(
    mRegen.items === mGen.items && mRegen.items === expected.visibleCardCount,
    `port items regen=${mRegen.items} gen=${mGen.items} expected=${expected.visibleCardCount} ` +
      `(catalogue=${expected.cataloguePortCount} browse-hidden-aliases=${Object.keys(expected.aliasToCanonical).length})`
  );
  assert(!mRegen.devPreview && !mGen.devPreview, 'no dev preview markers');
  assert(mRegen.reviewPromo === 1 && mGen.reviewPromo === 1, 'single review promo');
  assert(mRegen.guardNoPhoto && mGen.guardNoPhoto, 'directory runtime guard uses seadays-no-image fallback');

  assertDirectoryGridIdentity(regen2, 'regenerate', expected);
  assertDirectoryGridIdentity(gen2, 'generateBlogs', expected);

  assert(
    normalizePortsIndexHtml(regen2) === normalizePortsIndexHtml(gen2),
    'regenerate and generateBlogs --ports-only must produce identical ports/index.html'
  );

  console.log('OK test-ports-index-generator-parity', {
    regen: mRegen,
    gen: mGen,
    expected: {
      cataloguePortCount: expected.cataloguePortCount,
      visibleCardCount: expected.visibleCardCount,
      browseHiddenAliases: Object.keys(expected.aliasToCanonical).length,
      seoRedirectAliases: Object.keys(expected.redirectAliasMap).length,
    },
    tempRoot,
  });
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

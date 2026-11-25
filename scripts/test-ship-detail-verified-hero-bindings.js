#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { loadVerifiedShipHeroBySlug, resetPortsDirectoryImageCachesForTests } = require('./lib/portsDirectoryImageResolve');

const repoRoot = path.join(__dirname, '..');
const AIDA_MANIFEST = path.join(repoRoot, 'data/aida-ship-directory-thumbnails-20261113.json');

function readShipGuideHtml(slug) {
  const filePath = path.join(repoRoot, 'ships', slug, 'index.html');
  assert(fs.existsSync(filePath), `missing ship guide ${slug}`);
  return fs.readFileSync(filePath, 'utf8');
}

function extractPrimaryShipPhotoSrc(html) {
  const figMatch = html.match(/<figure class="seo-hero">[\s\S]*?<img[^>]+src="([^"]+)"/);
  if (figMatch) return { kind: 'licensed-hero', src: figMatch[1] };
  const heroMatch = html.match(/<img class="seo-hero-img"[^>]+src="([^"]+)"/);
  if (heroMatch) return { kind: 'plain-hero', src: heroMatch[1] };
  const visualMatch = html.match(/<img class="seo-visual-img"[^>]+src="([^"]+)"/);
  if (visualMatch) return { kind: 'visual-fallback', src: visualMatch[1] };
  return { kind: 'none', src: '' };
}

resetPortsDirectoryImageCachesForTests();
const verifiedBySlug = loadVerifiedShipHeroBySlug(repoRoot);
const aidaSlugs = JSON.parse(fs.readFileSync(AIDA_MANIFEST, 'utf8')).ships.map((s) => s.slug);

const mismatches = [];
const placeholderGuides = [];

for (const [slug, entry] of Object.entries(verifiedBySlug)) {
  if (!fs.existsSync(path.join(repoRoot, 'ships', slug, 'index.html'))) continue;
  const html = readShipGuideHtml(slug);
  const photo = extractPrimaryShipPhotoSrc(html);
  const expectedUrl = entry.url;
  const usesPlaceholder =
    /Cruise%20planner\.jpg|Websitehomebucket\/Cruise/i.test(html) &&
    !html.includes(expectedUrl.replace('https://seadays.app', ''));
  if (photo.kind === 'visual-fallback' || photo.kind === 'none' || usesPlaceholder) {
    placeholderGuides.push(slug);
  }
  if (!html.includes(expectedUrl) && !html.includes(expectedUrl.replace('https://seadays.app', ''))) {
    mismatches.push({ slug, expectedUrl, photo });
  }
}

for (const slug of aidaSlugs) {
  const html = readShipGuideHtml(slug);
  const entry = verifiedBySlug[slug];
  assert(entry && entry.url, `${slug} verified harvest`);
  assert(html.includes('hero-directory-aida-owner-20261113.webp'), `${slug} guide hero webp`);
  assert(html.includes('<figure class="seo-hero">'), `${slug} licensed hero figure`);
  assert(!html.includes('Websitehomebucket/Cruise%20planner.jpg'), `${slug} no planner placeholder in visual panel`);
}

assert.strictEqual(
  mismatches.length,
  0,
  `verified directory photo missing from guide: ${JSON.stringify(mismatches.slice(0, 8), null, 2)}`
);

console.log('OK test-ship-detail-verified-hero-bindings', {
  verifiedShips: Object.keys(verifiedBySlug).length,
  aidaChecked: aidaSlugs.length,
  priorPlaceholderGuides: placeholderGuides.length,
});
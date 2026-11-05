'use strict';

const fs = require('fs');
const path = require('path');
const {
  pickBlogArticlesForEntity,
  pickArticleImage,
  extractArticleCardImageFromHtml,
} = require('./seoShipPortPages');

const DEFAULT_FAVICON =
  'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function blogRelPath(slug) {
  return `/blog/${slug}/`;
}

function loadArticleStubsFromDisk(repoRoot) {
  const blogRoot = path.join(repoRoot, 'blog');
  if (!fs.existsSync(blogRoot)) return [];
  const out = [];
  for (const slug of fs.readdirSync(blogRoot)) {
    const p = path.join(blogRoot, slug, 'index.html');
    if (!fs.existsSync(p)) continue;
    let html;
    try {
      html = fs.readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    if (/noindex/i.test(html) && html.match(/<meta name="robots" content="[^"]*noindex/i)) continue;
    const titleRaw = (html.match(/<h1>([^<]+)<\/h1>/i) || [])[1] || slug;
    const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
    const img = extractArticleCardImageFromHtml(html);
    out.push({
      slug,
      title: titleRaw.replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
      excerpt: desc,
      seoDescription: desc,
      thumbnailUrl: img || '',
      heroImageUrl: img || '',
      author: 'SeaDays',
    });
  }
  return out;
}

function pickPortGuideArticlesForDirectory(seoPorts, articles) {
  const regionGroups = new Map();
  for (const port of seoPorts || []) {
    const region = String(port.region || '').trim() || 'Other';
    if (!regionGroups.has(region)) regionGroups.set(region, []);
    regionGroups.get(region).push(port);
  }
  const regionPills = [...regionGroups.entries()]
    .map(([region, list]) => ({ region, count: list.length }))
    .sort((a, b) => (b.count - a.count) || a.region.localeCompare(b.region));
  const topRegionTokens = regionPills.slice(0, 8).map((x) => x.region);
  return pickBlogArticlesForEntity(articles, ['cruise ports', 'shore days', ...topRegionTokens], 6).slice(0, 6);
}

function buildGuideCardImgTag(url, alt) {
  const src = String(url || '').trim() || DEFAULT_FAVICON;
  return (
    `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" width="420" height="240" ` +
    `class="guide-card-image img-loading" data-img-source="featured-guide" data-img-type="supabase" ` +
    `loading="lazy" decoding="async" onerror="this.onerror=null;this.src='${DEFAULT_FAVICON}'" ` +
    `onload="this.classList.remove('img-loading')">`
  );
}

function buildPortsDirectoryFeaturedGuideCardsHtml(seoPorts, articles) {
  const picked = pickPortGuideArticlesForDirectory(seoPorts, articles);
  const out = [];
  for (const a of picked) {
    if (!a || !a.slug) continue;
    const imgUrl = pickArticleImage(a) || DEFAULT_FAVICON;
    out.push(
      `<a class="guide-card" href="${blogRelPath(escapeHtml(a.slug))}">` +
        `${buildGuideCardImgTag(imgUrl, a.title || 'SeaDays guide')}` +
        `<div class="guide-card-body">` +
          `<p class="guide-card-title">${escapeHtml(a.title || 'SeaDays guide')}</p>` +
          `<p class="guide-card-meta">Read in the SeaDays blog</p>` +
        `</div>` +
      `</a>`
    );
  }
  return out.join('\n');
}

function resolvePortsDirectoryFeaturedGuideCardsHtml({ repoRoot, seoPorts, articles = null }) {
  const list = Array.isArray(articles) && articles.length ? articles : loadArticleStubsFromDisk(repoRoot);
  return buildPortsDirectoryFeaturedGuideCardsHtml(seoPorts, list);
}

module.exports = {
  loadArticleStubsFromDisk,
  pickPortGuideArticlesForDirectory,
  buildPortsDirectoryFeaturedGuideCardsHtml,
  resolvePortsDirectoryFeaturedGuideCardsHtml,
};

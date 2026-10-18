'use strict';

/**
 * Shared publication / Organization schema constants for SeaDays editorial pages.
 * Homepage index.html defines the canonical Organization @id; articles reference it.
 */

const PUBLISHER_BASE_URL = 'https://seadays.app';
const ORGANIZATION_ID = `${PUBLISHER_BASE_URL}/#organization`;
const PUBLISHER_NAME = 'SeaDays';
const PUBLISHER_LOGO_URL = `${PUBLISHER_BASE_URL}/logo.png`;

const fs = require('fs');
const path = require('path');

const SITE_AUTHOR_PATH = path.join(__dirname, '..', '..', 'data', 'editorial-author.json');
let siteAuthorCache;

/**
 * The one byline used on every post (data/editorial-author.json).
 * Returns null when no named author is configured, which keeps the
 * "Published by SeaDays" brand byline.
 */
function loadSiteAuthor() {
  if (siteAuthorCache !== undefined) return siteAuthorCache;
  siteAuthorCache = null;
  try {
    const raw = JSON.parse(fs.readFileSync(SITE_AUTHOR_PATH, 'utf8'));
    const name = String((raw && raw.name) || '').trim();
    if (name) {
      const url = String(raw.url || '/about.html').trim();
      siteAuthorCache = {
        name,
        url,
        absoluteUrl: /^https?:/i.test(url) ? url : `${PUBLISHER_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`,
      };
    }
  } catch {
    siteAuthorCache = null;
  }
  return siteAuthorCache;
}

function resolveSiteAuthor(siteAuthor) {
  return siteAuthor === undefined ? loadSiteAuthor() : siteAuthor;
}

function escapeHtmlText(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getSiteAuthorJsonLd(siteAuthor) {
  return { '@type': 'Person', name: siteAuthor.name, url: siteAuthor.absoluteUrl };
}

const GENERIC_AUTHOR_TOKENS = new Set([
  'anonymous',
  'seadays',
  'seaday',
  'seastories',
  'portside',
  'admin',
  'editor',
  'staff',
]);

function normalizeAuthorToken(name) {
  return String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '');
}

function isGenericBrandAuthor(name) {
  const token = normalizeAuthorToken(name);
  if (!token) return true;
  return GENERIC_AUTHOR_TOKENS.has(token);
}

function getPublisherJsonLd() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: PUBLISHER_NAME,
    url: `${PUBLISHER_BASE_URL}/`,
    logo: { '@type': 'ImageObject', url: PUBLISHER_LOGO_URL },
  };
}

function getBrandAuthorJsonLd() {
  return {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: PUBLISHER_NAME,
    url: `${PUBLISHER_BASE_URL}/`,
  };
}

function getPersonAuthorJsonLd(name) {
  const trimmed = String(name || '').trim();
  if (!trimmed) return getBrandAuthorJsonLd();
  return { '@type': 'Person', name: trimmed };
}

function buildArticleAuthorJsonLd(article, siteAuthor) {
  const site = resolveSiteAuthor(siteAuthor);
  if (site) return getSiteAuthorJsonLd(site);
  const name = String(article && article.author ? article.author : '').trim();
  if (isGenericBrandAuthor(name)) return getBrandAuthorJsonLd();
  return getPersonAuthorJsonLd(name);
}

function articleAuthorDisplayName(article, siteAuthor) {
  const site = resolveSiteAuthor(siteAuthor);
  if (site) return site.name;
  const name = String(article && article.author ? article.author : '').trim();
  if (isGenericBrandAuthor(name)) return PUBLISHER_NAME;
  return name;
}

function articleAuthorBylineLabel(article, siteAuthor) {
  const site = resolveSiteAuthor(siteAuthor);
  if (site) return `By ${site.name}`;
  const name = articleAuthorDisplayName(article, null);
  if (isGenericBrandAuthor(article && article.author)) {
    return `Published by ${name}`;
  }
  return `By ${name}`;
}

/** Inner HTML for <span class="author">: a link to the author profile when one is configured. */
function articleAuthorBylineHtml(article, siteAuthor) {
  const site = resolveSiteAuthor(siteAuthor);
  if (site) return `By <a href="${escapeHtmlText(site.url)}" rel="author">${escapeHtmlText(site.name)}</a>`;
  return escapeHtmlText(articleAuthorBylineLabel(article, null));
}

function fixArticleJsonLdObject(data, canonicalUrl, siteAuthor) {
  if (!data || data['@type'] !== 'Article') return data;
  const site = resolveSiteAuthor(siteAuthor);
  const authorName = data.author && data.author.name ? data.author.name : '';
  if (isGenericBrandAuthor(authorName) || (data.author && data.author['@type'] === 'Organization')) {
    data.author = getBrandAuthorJsonLd();
  } else if (data.author && data.author['@type'] === 'Person' && data.author.name) {
    data.author = getPersonAuthorJsonLd(data.author.name);
  } else if (data.author && data.author['@id'] === ORGANIZATION_ID) {
    data.author = getBrandAuthorJsonLd();
  }
  if (site) data.author = getSiteAuthorJsonLd(site);
  data.publisher = getPublisherJsonLd();
  if (canonicalUrl) {
    data.mainEntityOfPage = { '@type': 'WebPage', '@id': canonicalUrl };
  }
  return data;
}

module.exports = {
  PUBLISHER_BASE_URL,
  ORGANIZATION_ID,
  PUBLISHER_NAME,
  PUBLISHER_LOGO_URL,
  GENERIC_AUTHOR_TOKENS,
  isGenericBrandAuthor,
  getPublisherJsonLd,
  getBrandAuthorJsonLd,
  getPersonAuthorJsonLd,
  buildArticleAuthorJsonLd,
  articleAuthorDisplayName,
  articleAuthorBylineLabel,
  articleAuthorBylineHtml,
  fixArticleJsonLdObject,
  loadSiteAuthor,
  getSiteAuthorJsonLd,
};

'use strict';

/**
 * Shared publication / Organization schema constants for SeaDays editorial pages.
 * Homepage index.html defines the canonical Organization @id; articles reference it.
 */

const PUBLISHER_BASE_URL = 'https://seadays.app';
const ORGANIZATION_ID = `${PUBLISHER_BASE_URL}/#organization`;
const PUBLISHER_NAME = 'SeaDays';
const PUBLISHER_LOGO_URL = `${PUBLISHER_BASE_URL}/logo.png`;

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

function buildArticleAuthorJsonLd(article) {
  const name = String(article && article.author ? article.author : '').trim();
  if (isGenericBrandAuthor(name)) return getBrandAuthorJsonLd();
  return getPersonAuthorJsonLd(name);
}

function articleAuthorDisplayName(article) {
  const name = String(article && article.author ? article.author : '').trim();
  if (isGenericBrandAuthor(name)) return PUBLISHER_NAME;
  return name;
}

function articleAuthorBylineLabel(article) {
  const name = articleAuthorDisplayName(article);
  if (isGenericBrandAuthor(article && article.author)) {
    return `Published by ${name}`;
  }
  return `By ${name}`;
}

function fixArticleJsonLdObject(data, canonicalUrl) {
  if (!data || data['@type'] !== 'Article') return data;
  const authorName = data.author && data.author.name ? data.author.name : '';
  if (isGenericBrandAuthor(authorName) || (data.author && data.author['@type'] === 'Organization')) {
    data.author = getBrandAuthorJsonLd();
  } else if (data.author && data.author['@type'] === 'Person' && data.author.name) {
    data.author = getPersonAuthorJsonLd(data.author.name);
  } else if (data.author && data.author['@id'] === ORGANIZATION_ID) {
    data.author = getBrandAuthorJsonLd();
  }
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
  fixArticleJsonLdObject,
};

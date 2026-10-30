'use strict';

const {
  resolveCatalogAdaptationDisclosure,
  pickPublicCatalogAttribution,
} = require('./catalogImageAdaptationDisclosure');

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildCatalogAttributionHtml(payload) {
  const attr = pickPublicCatalogAttribution(payload.attribution || {});
  const commons = payload.commons || {};
  const creator = String(attr.creator || '').trim();
  const license = String(attr.license || '').trim();
  const licenseUrl = String(attr.licenseUrl || '').trim();
  const commonsUrl = String(commons.pageUrl || '').trim();
  if (!creator || !license || !licenseUrl || !commonsUrl) return '';

  const creatorHtml = attr.creatorUrl
    ? `<a href="${escapeHtml(attr.creatorUrl)}" rel="noopener noreferrer">${escapeHtml(creator)}</a>`
    : escapeHtml(creator);
  const commonsFile = String(commons.file || '').trim();
  const commonsHtml = commonsFile
    ? `<span class="catalog-attribution-filename">${escapeHtml(commonsFile)}</span> · <a href="${escapeHtml(commonsUrl)}" rel="noopener noreferrer">Wikimedia Commons file page</a>`
    : `<a href="${escapeHtml(commonsUrl)}" rel="noopener noreferrer">Wikimedia Commons</a>`;
  const licenseHtml = `<a href="${escapeHtml(licenseUrl)}" rel="noopener noreferrer">${escapeHtml(license)}</a>`;
  const adaptationText = resolveCatalogAdaptationDisclosure(attr);
  const changesHtml = adaptationText
    ? `<dt>Changes</dt><dd>${escapeHtml(adaptationText)}</dd>`
    : '';

  return (
    `<dl class="catalog-attribution">` +
    `<dt>Creator</dt><dd>${creatorHtml}</dd>` +
    `<dt>Source</dt><dd>${commonsHtml}</dd>` +
    `<dt>License</dt><dd>${licenseHtml}</dd>` +
    changesHtml +
    `</dl>`
  );
}

function buildCatalogMockBannerHtml(label) {
  return (
    `<p class="catalog-mock-preview-banner" role="status">` +
    `${escapeHtml(label)}` +
    `</p>`
  );
}

function buildCatalogVerifiedBannerHtml(label) {
  return (
    `<p class="catalog-verified-preview-banner" role="status">` +
    `${escapeHtml(label)}` +
    `</p>`
  );
}

/** 3:2 frame, object-fit cover — preview-only CSS class hooks. */
function buildCatalogPreviewFigureHtml(hero, options) {
  if (!hero || !hero.payload) return '';
  const roleNote = options?.roleLabel
    ? `<p class="catalog-preview-role">${escapeHtml(options.roleLabel)}</p>`
    : '';
  const attribution = buildCatalogAttributionHtml(hero.payload);
  return (
    `<figure class="seo-hero catalog-mock-figure">` +
    `<div class="catalog-preview-frame">` +
    `<img class="seo-hero-img catalog-preview-img" src="${escapeHtml(hero.displayUrl)}" alt="${escapeHtml(hero.alt)}" width="1200" height="800" loading="eager" decoding="async">` +
    `</div>` +
    roleNote +
    attribution +
    `</figure>`
  );
}

const CATALOG_PREVIEW_STYLE = `
.catalog-mock-preview-banner, .catalog-verified-preview-banner { margin: 0 0 16px; padding: 10px 14px; border-radius: 12px; border: 1px dashed rgba(255,196,0,0.55); background: rgba(255,196,0,0.12); color: #ffe082; font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
.catalog-preview-frame { width: 100%; aspect-ratio: 3 / 2; overflow: hidden; border-radius: 16px; background: rgba(255,255,255,0.06); margin: 0 0 10px; }
.catalog-preview-frame .catalog-preview-img { width: 100%; height: 100%; max-height: none; margin: 0; object-fit: cover; display: block; }
.catalog-preview-role { margin: 0 0 8px; font-size: 12px; color: rgba(255,255,255,0.72); }
.catalog-attribution { margin: 0 0 18px; font-size: 12px; line-height: 1.45; color: rgba(255,255,255,0.62); display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; }
.catalog-attribution dt { font-weight: 700; color: rgba(255,255,255,0.78); margin: 0; }
.catalog-attribution dd { margin: 0; }
.catalog-attribution a { color: rgba(255,255,255,0.88); }
.catalog-mock-terminal-block, .catalog-verified-terminal-block { margin: 18px 0 24px; padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.03); }
`;

module.exports = {
  escapeHtml,
  buildCatalogAttributionHtml,
  buildCatalogMockBannerHtml,
  buildCatalogVerifiedBannerHtml,
  buildCatalogPreviewFigureHtml,
  CATALOG_PREVIEW_STYLE,
};

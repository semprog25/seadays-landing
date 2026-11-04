'use strict';

const fs = require('fs');
const path = require('path');
const {
  validateCatalogImageRecordV1,
  isCatalogImageRecordDisplayable,
} = require('./catalogImage/validateCatalogImageRecord');
const { pickPublicCatalogAttribution } = require('./catalogImage/catalogImageAdaptationDisclosure');

const REPO_ROOT = path.join(__dirname, '..', '..');

let bindingsFile = null;
let kvRecords = null;

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function terminalIdentityKey(terminal, portAppId) {
  const country = String(terminal?.country_id || '').trim().toLowerCase();
  const port = String(portAppId || '').trim().toLowerCase();
  const slug = String(terminal?.slug || '').trim().toLowerCase();
  if (!country || !port || !slug) return '';
  return `${country}/${port}/${slug}`;
}

function loadBindings(repoRoot = REPO_ROOT) {
  if (bindingsFile) return bindingsFile;
  const filePath = path.join(repoRoot, 'data', 'terminal-verified-image-bindings.json');
  bindingsFile = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return bindingsFile;
}

function loadKvRecords(repoRoot = REPO_ROOT) {
  if (kvRecords) return kvRecords;
  const filePath = path.join(
    repoRoot,
    'data',
    'catalog-image-verified-fixtures',
    'kv-records-by-key.json'
  );
  kvRecords = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  return kvRecords;
}

function resetTerminalImageCachesForTests() {
  bindingsFile = null;
  kvRecords = null;
}

function resolveTerminalVerifiedImage(terminal, portAppId, repoRoot = REPO_ROOT) {
  const identity = terminalIdentityKey(terminal, portAppId);
  if (!identity) return null;
  let bindings;
  try {
    bindings = loadBindings(repoRoot);
  } catch {
    return null;
  }
  const binding = bindings.bindings && bindings.bindings[identity];
  if (!binding || !binding.catalogKvKey) return null;
  const expectedSlug = String(binding.terminalSlug || identity.split('/').pop()).toLowerCase();
  if (String(terminal.slug || '').toLowerCase() !== expectedSlug) return null;

  const record = loadKvRecords(repoRoot)[binding.catalogKvKey];
  if (!record || String(record.status) !== 'verified') return null;
  const validation = validateCatalogImageRecordV1(record, {});
  if (!validation.ok || !validation.record || !isCatalogImageRecordDisplayable(record)) return null;

  const media = record.media || {};
  const url = String(media.thumbUrl || media.url || '').trim();
  if (!url.startsWith('https://')) return null;

  const width = Number(media.width);
  const height = Number(media.height);
  return {
    identity,
    catalogKvKey: binding.catalogKvKey,
    url,
    alt: String(media.alt || terminal.name || 'Cruise terminal').trim(),
    width: Number.isFinite(width) && width > 0 ? width : 1200,
    height: Number.isFinite(height) && height > 0 ? height : 800,
    attribution: record.attribution || {},
    commons: record.commons || {},
  };
}

function buildTerminalCardPhotoHtml(image) {
  if (!image || !image.url) return '';
  const attr = pickPublicCatalogAttribution(image.attribution || {});
  const creator = String(attr.creator || '').trim();
  const license = String(attr.license || '').trim();
  const licenseUrl = String(attr.licenseUrl || '').trim();
  const caption =
    creator && license && licenseUrl
      ? `Photo: ${creator} / <a href="${escapeHtml(licenseUrl)}" rel="noopener noreferrer">${escapeHtml(license)}</a>`
      : '';
  return (
    `<figure class="pg-terminal-card-photo">` +
    `<img src="${escapeHtml(image.url)}" alt="${escapeHtml(image.alt)}" width="${escapeHtml(String(image.width))}" height="${escapeHtml(String(image.height))}" loading="lazy" decoding="async">` +
    (caption ? `<figcaption>${caption}</figcaption>` : '') +
    `</figure>`
  );
}

module.exports = {
  terminalIdentityKey,
  resolveTerminalVerifiedImage,
  buildTerminalCardPhotoHtml,
  resetTerminalImageCachesForTests,
};

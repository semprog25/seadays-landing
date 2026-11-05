'use strict';

const fs = require('fs');
const path = require('path');

const PEXELS_HOST = 'images.pexels.com';

/** Must stay aligned with PRIORITY_REGION_DEFS keys in portsDirectoryIndex.js */
const PRIORITY_REGION_KEYS = [
  'Mediterranean',
  'Caribbean',
  'Northern Europe',
  'Baltic',
  'Fjords',
  'British Isles',
  'Alaska',
  'Asia',
  '__virt_anz__',
  '__virt_na__',
  'Atlantic',
  'South America',
  'Middle East',
  'Private Island',
];

let mergedCache = null;

function resetPortsDirectoryRegionImageCachesForTests() {
  mergedCache = null;
}

function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function isSiteAssetImageUrl(url) {
  const s = String(url || '').trim();
  return s.startsWith('/assets/img/ports-directory/') && !s.includes('..');
}

function isHttpsImageUrl(url) {
  const s = String(url || '').trim();
  if (isSiteAssetImageUrl(s)) return true;
  if (!s.startsWith('https://')) return false;
  if (s.includes('seadaysfav.png')) return false;
  return true;
}

function isPexelsRegionUrl(url) {
  try {
    return new URL(String(url).trim()).hostname === PEXELS_HOST;
  } catch {
    return false;
  }
}

function isOwnerProvidedRegionEntry(entry) {
  return entry && String(entry.source || '').trim() === 'owner-provided';
}

function normalizeRegionEntry(entry) {
  if (!entry || typeof entry !== 'object') return null;
  const imageUrl = String(entry.imageUrl || '').trim();
  if (!isHttpsImageUrl(imageUrl)) return null;
  const source = String(entry.source || '').trim() || (isPexelsRegionUrl(imageUrl) ? 'pexels' : '');
  if (source === 'pexels' && !isPexelsRegionUrl(imageUrl)) return null;
  if (source === 'owner-provided' && !isOwnerProvidedRegionEntry({ ...entry, source })) return null;
  if (source !== 'pexels' && source !== 'owner-provided') return null;
  return {
    imageUrl,
    alt: String(entry.alt || '').trim(),
    source,
    attribution: entry.attribution && typeof entry.attribution === 'object' ? entry.attribution : undefined,
    pexelsPhotoId: entry.pexelsPhotoId,
  };
}

/**
 * Region browse cards: owner-provided overrides, then Pexels-only defaults.
 * Destination directory tiles use Pexels/Unsplash/owner assets only (see destinationImageSourcePolicy.js).
 */
function loadRegionImageManifest(repoRoot) {
  if (mergedCache) return mergedCache;

  const pexelsPath = path.join(repoRoot, 'data', 'ports-directory-region-images-pexels.json');
  const providedPath = path.join(repoRoot, 'data', 'ports-directory-region-images-provided.json');

  const pexelsPayload = readJsonFile(pexelsPath);
  const providedPayload = readJsonFile(providedPath);
  const pexelsRegions =
    pexelsPayload?.regions && typeof pexelsPayload.regions === 'object' ? pexelsPayload.regions : {};
  const providedRegions =
    providedPayload?.regions && typeof providedPayload.regions === 'object'
      ? providedPayload.regions
      : {};

  const merged = Object.create(null);
  const priorityKeys = new Set(PRIORITY_REGION_KEYS);

  for (const key of priorityKeys) {
    if (providedRegions[key]) {
      const provided = normalizeRegionEntry({
        ...providedRegions[key],
        source: 'owner-provided',
      });
      if (provided && provided.source === 'owner-provided') {
        merged[key] = provided;
        continue;
      }
    }
    const pexels = normalizeRegionEntry(pexelsRegions[key]);
    if (pexels && pexels.source === 'pexels') {
      merged[key] = pexels;
    }
  }

  mergedCache = merged;
  return merged;
}

function listRegionImageCoverage(repoRoot) {
  const manifest = loadRegionImageManifest(repoRoot);
  const provided = [];
  const pexels = [];
  const missing = [];
  for (const key of PRIORITY_REGION_KEYS) {
    const entry = manifest[key];
    if (!entry?.imageUrl) {
      missing.push(key);
      continue;
    }
    if (entry.source === 'owner-provided') provided.push(key);
    else pexels.push(key);
  }
  return { provided, pexels, missing, manifest };
}

/**
 * Region browse card image for any catalogue region (priority or additional).
 * Priority: manifest entry → full pexels catalogue → first verified port photo in region.
 */
function resolveCatalogRegionBrowseImage(regionKey, repoRoot, directoryPorts, verifiedBySlug) {
  const key = String(regionKey || '').trim();
  if (!key) return null;
  const manifest = loadRegionImageManifest(repoRoot);
  if (manifest[key]?.imageUrl) return manifest[key];

  const pexelsPath = path.join(repoRoot, 'data', 'ports-directory-region-images-pexels.json');
  const pexelsPayload = readJsonFile(pexelsPath);
  const pexelsRegions =
    pexelsPayload?.regions && typeof pexelsPayload.regions === 'object'
      ? pexelsPayload.regions
      : {};
  const pexelsDirect = normalizeRegionEntry(pexelsRegions[key]);
  if (pexelsDirect?.imageUrl) return pexelsDirect;

  const REGION_PEXELS_ALIAS = {
    Scandinavia: 'Northern Europe',
    'North Sea': 'Northern Europe',
    Lofoten: 'Fjords',
    'Southern Norway': 'Fjords',
    Scotland: 'British Isles',
    'Northern Ireland': 'British Isles',
  };
  const aliasKey = REGION_PEXELS_ALIAS[key];
  if (aliasKey && manifest[aliasKey]?.imageUrl) {
    return {
      ...manifest[aliasKey],
      alt: `${key} cruise region`,
    };
  }

  return null;
}

function compareRegionPortLabel(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

module.exports = {
  loadRegionImageManifest,
  listRegionImageCoverage,
  resolveCatalogRegionBrowseImage,
  resetPortsDirectoryRegionImageCachesForTests,
  isPexelsRegionUrl,
  isSiteAssetImageUrl,
};

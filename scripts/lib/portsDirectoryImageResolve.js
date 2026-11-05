'use strict';

const fs = require('fs');
const path = require('path');
const { assessPortDirectoryThumbnail, loadReviewState } = require('./directoryThumbnailQuality');
const {
  isApprovedDestinationPhotographyUrl,
  isCatalogRecordApprovedForDestinationDisplay,
} = require('./destinationImageSourcePolicy');
const { isExcludedFromPublicDirectoryRender } = require('./destinationPhotoBatch02GeoPolicy');
const {
  validateCatalogImageRecordV1,
  isCatalogImageRecordDisplayable,
} = require('./catalogImage/validateCatalogImageRecord');
const { parseFocalPercent } = require('./ownerImagePresentation');

const DESTINATION_KV_PREFIX = 'port:image:destination:';
const SHIP_HERO_KV_PREFIX = 'ship:image:hero:';

function readJsonFileHarvest(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function reviewStateRejectedCommons(repoRoot) {
  const filePath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
  if (!fs.existsSync(filePath)) return [];
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return Array.isArray(payload.rejectedCommonsFiles) ? payload.rejectedCommonsFiles : [];
  } catch {
    return [];
  }
}

let verifiedDestinationUrlBySlugCache = null;
let verifiedShipHeroUrlBySlugCache = null;
let destinationOwnerCandidatesCache = null;
let destinationOwnerPortEntriesCache = null;

function resetPortsDirectoryImageCachesForTests() {
  verifiedDestinationUrlBySlugCache = null;
  destinationOwnerCandidatesCache = null;
  destinationOwnerPortEntriesCache = null;
  verifiedShipHeroUrlBySlugCache = null;
}

function readDestinationOwnerPayload(repoRoot) {
  const filePath = path.join(
    repoRoot,
    'data',
    'ports-directory-destination-owner-candidates.json'
  );
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function loadDestinationOwnerPortEntryBySlug(repoRoot) {
  if (destinationOwnerPortEntriesCache) return destinationOwnerPortEntriesCache;
  const map = Object.create(null);
  const payload = readDestinationOwnerPayload(repoRoot);
  const ports =
    payload?.ports && typeof payload.ports === 'object' ? payload.ports : {};
  for (const [slug, entry] of Object.entries(ports)) {
    if (!entry || typeof entry !== 'object') continue;
    map[slug] = entry;
  }
  destinationOwnerPortEntriesCache = map;
  return map;
}

function loadDestinationOwnerCandidatesBySlug(repoRoot) {
  if (destinationOwnerCandidatesCache) return destinationOwnerCandidatesCache;
  const map = Object.create(null);
  const ports = loadDestinationOwnerPortEntryBySlug(repoRoot);
  for (const [slug, entry] of Object.entries(ports)) {
    if (String(entry.verificationStatus || '') !== 'NEEDS_REVIEW') continue;
    const url = String(entry.directoryImageUrl || '').trim();
    if (!url.startsWith('/assets/') && !url.startsWith('https://')) continue;
    map[slug] = url;
  }
  destinationOwnerCandidatesCache = map;
  return map;
}

function extractOgImageFromPortPage(repoRoot, slug) {
  const pagePath = path.join(repoRoot, 'ports', slug, 'index.html');
  if (!fs.existsSync(pagePath)) return '';
  const html = fs.readFileSync(pagePath, 'utf8');
  const og =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  let url = og ? String(og[1]).trim() : '';
  if (!url || url.includes('seadaysfav.png')) {
    const hero = html.match(/class="seo-hero-img"\s+src="([^"]+)"/i);
    if (hero) url = String(hero[1]).trim();
  }
  return url;
}

function loadVerifiedPortDestinationUrlBySlug(repoRoot) {
  if (verifiedDestinationUrlBySlugCache) return verifiedDestinationUrlBySlugCache;
  const map = Object.create(null);
  const filePath = path.join(
    repoRoot,
    'data',
    'catalog-image-verified-fixtures',
    'kv-records-by-key.json'
  );
  if (!fs.existsSync(filePath)) {
    verifiedDestinationUrlBySlugCache = map;
    return map;
  }
  let records;
  try {
    records = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    verifiedDestinationUrlBySlugCache = map;
    return map;
  }
  for (const [key, raw] of Object.entries(records)) {
    if (!key.startsWith(DESTINATION_KV_PREFIX)) continue;
    const slug = key.slice(DESTINATION_KV_PREFIX.length).trim();
    if (!slug) continue;
    if (!raw || String(raw.status) !== 'verified') continue;
    const validation = validateCatalogImageRecordV1(raw, {});
    if (!validation.ok || !validation.record || !isCatalogImageRecordDisplayable(raw)) continue;
    const entitySlug = String(raw.entity?.canonicalSlug || slug).trim();
    if (entitySlug && entitySlug !== slug) continue;
    const media = raw.media || {};
    const url = String(media.thumbUrl || media.url || '').trim();
    if (!url.startsWith('https://') || url.includes('seadaysfav.png')) continue;
    if (!isCatalogRecordApprovedForDestinationDisplay(raw)) continue;
    const quality = assessPortDirectoryThumbnail(url, {
      slug,
      commonsFile: raw?.commons?.file,
      alt: raw?.media?.alt,
      categories: raw?.commons?.categories,
    }, repoRoot);
    if (!quality.ok) continue;
    map[slug] = url;
  }
  const harvestPath = path.join(repoRoot, 'data', 'wikimedia-harvest', 'local-verified-records.json');
  const harvestPayload = readJsonFileHarvest(harvestPath);
  const harvestRecords =
    harvestPayload?.recordsByKey && typeof harvestPayload.recordsByKey === 'object'
      ? harvestPayload.recordsByKey
      : {};
  for (const [key, raw] of Object.entries(harvestRecords)) {
    if (!key.startsWith(DESTINATION_KV_PREFIX)) continue;
    const slug = key.slice(DESTINATION_KV_PREFIX.length).trim();
    if (!slug || map[slug]) continue;
    if (!raw || String(raw.status) !== 'verified') continue;
    const validation = validateCatalogImageRecordV1(raw, {});
    if (!validation.ok || !isCatalogImageRecordDisplayable(raw)) continue;
    const media = raw.media || {};
    const url = String(media.thumbUrl || media.url || '').trim();
    if (!url.startsWith('https://') || url.includes('seadaysfav.png')) continue;
    if (!isCatalogRecordApprovedForDestinationDisplay(raw)) continue;
    const quality = assessPortDirectoryThumbnail(url, {
      slug,
      commonsFile: raw?.commons?.file,
      alt: raw?.media?.alt,
      categories: raw?.commons?.categories,
    }, repoRoot);
    if (!quality.ok) continue;
    map[slug] = url;
  }
  verifiedDestinationUrlBySlugCache = map;
  return map;
}

function resolveDirectoryImageUrl(port, portGuide, repoRoot, verifiedBySlug) {
  const slug = port?.slug ? String(port.slug).trim() : '';
  const review = loadReviewState(repoRoot);
  if (slug && review.humanApproved?.[slug]) {
    const approved = review.humanApproved[slug];
    if (approved.excludedFromPublicDirectoryRender || isExcludedFromPublicDirectoryRender(slug)) {
      return '';
    }
    const approvedUrl = String(approved.url || '').trim();
    if (approvedUrl) {
      const approvedQuality = assessPortDirectoryThumbnail(approvedUrl, { slug }, repoRoot);
      if (approvedQuality.ok) return approvedUrl;
    }
  }

  const ownerCandidates = loadDestinationOwnerCandidatesBySlug(repoRoot);
  const ownerPreview =
    slug && ownerCandidates[slug] ? String(ownerCandidates[slug]).trim() : '';
  if (ownerPreview) {
    const ownerQuality = assessPortDirectoryThumbnail(ownerPreview, { slug }, repoRoot);
    if (ownerQuality.ok) return ownerPreview;
  }

  const verified =
    verifiedBySlug && slug ? String(verifiedBySlug[slug] || '').trim() : '';
  if (verified) {
    const verifiedQuality = assessPortDirectoryThumbnail(verified, { slug }, repoRoot);
    if (verifiedQuality.ok) return verified;
  }

  const heroUrl = portGuide?.hero?.url ? String(portGuide.hero.url).trim() : '';
  if (heroUrl && !heroUrl.includes('seadaysfav.png')) {
    const heroQuality = assessPortDirectoryThumbnail(heroUrl, { slug }, repoRoot);
    if (heroQuality.ok) return heroUrl;
  }
  const fromRecord = String(port.image_url || '').trim();
  if (fromRecord && !fromRecord.includes('seadaysfav.png')) {
    const recordQuality = assessPortDirectoryThumbnail(fromRecord, { slug }, repoRoot);
    if (recordQuality.ok) return fromRecord;
  }
  const fromPage = slug ? extractOgImageFromPortPage(repoRoot, slug) : '';
  if (fromPage && !fromPage.includes('seadaysfav.png')) {
    const pageQuality = assessPortDirectoryThumbnail(fromPage, { slug }, repoRoot);
    if (pageQuality.ok && isApprovedDestinationPhotographyUrl(fromPage)) return fromPage;
  }
  return '';
}

/**
 * Approved destination URL for directory tiles and port guide heroes (not terminal infra).
 */
function resolveApprovedPortDestinationDisplayUrl({ slug, repoRoot, portGuide, portImageUrl }) {
  const verifiedBySlug = loadVerifiedPortDestinationUrlBySlug(repoRoot);
  const url = resolveDirectoryImageUrl(
    { slug },
    portGuide,
    repoRoot,
    verifiedBySlug
  );
  if (url) return url;
  const fromPort = String(portImageUrl || '').trim();
  if (fromPort && isApprovedDestinationPhotographyUrl(fromPort)) {
    const q = assessPortDirectoryThumbnail(fromPort, { slug }, repoRoot);
    if (q.ok) return fromPort;
  }
  return '';
}

function enrichSeoPortsForDirectoryIndex(
  seoPorts,
  { repoRoot, slugToAppPortId, publicGuidesByAppPortId = {} }
) {
  const verifiedBySlug = loadVerifiedPortDestinationUrlBySlug(repoRoot);
  const ownerEntries = loadDestinationOwnerPortEntryBySlug(repoRoot);
  for (const port of seoPorts) {
    const appPortId = slugToAppPortId[port.slug] || '';
    const portGuide =
      (appPortId && publicGuidesByAppPortId[appPortId]) || null;
    port.directoryImageUrl = resolveDirectoryImageUrl(
      port,
      portGuide,
      repoRoot,
      verifiedBySlug
    );
    const ownerEntry = port?.slug ? ownerEntries[port.slug] : null;
    const focal = ownerEntry?.cropFocal?.directory;
    const objectPosition = parseFocalPercent(focal);
    if (objectPosition) port.directoryImageObjectPosition = objectPosition;
  }
  return seoPorts;
}

function loadVerifiedShipHeroUrlBySlug(repoRoot) {
  if (verifiedShipHeroUrlBySlugCache) return verifiedShipHeroUrlBySlugCache;
  const map = Object.create(null);
  const harvestPath = path.join(repoRoot, 'data', 'wikimedia-harvest', 'local-verified-records.json');
  const harvestPayload = readJsonFileHarvest(harvestPath);
  const harvestRecords =
    harvestPayload?.recordsByKey && typeof harvestPayload.recordsByKey === 'object'
      ? harvestPayload.recordsByKey
      : {};
  for (const [key, raw] of Object.entries(harvestRecords)) {
    if (!key.startsWith(SHIP_HERO_KV_PREFIX)) continue;
    const slug = key.slice(SHIP_HERO_KV_PREFIX.length).trim();
    if (!slug) continue;
    if (!raw || String(raw.status) !== 'verified') continue;
    const validation = validateCatalogImageRecordV1(raw, {});
    if (!validation.ok || !isCatalogImageRecordDisplayable(raw)) continue;
    const entitySlug = String(raw.entity?.canonicalSlug || slug).trim();
    if (entitySlug && entitySlug !== slug) continue;
    const media = raw.media || {};
    const url = String(media.thumbUrl || media.url || '').trim();
    if (!url.startsWith('https://') || url.includes('seadaysfav.png')) continue;
    const commonsFile = String(raw.commons?.file || '').trim();
    if (
      commonsFile &&
      reviewStateRejectedCommons(repoRoot).some(
        (name) => name.toLowerCase() === commonsFile.toLowerCase()
      )
    ) {
      continue;
    }
    if (/commons\/5\/56\/Cruise_ships\.jpg/i.test(url) || /\/Cruise_ships\.jpg/i.test(url)) {
      continue;
    }
    map[slug] = url;
  }
  verifiedShipHeroUrlBySlugCache = map;
  return map;
}

function enrichSeoShipsForDirectoryIndex(seoShips, { repoRoot }) {
  const verifiedBySlug = loadVerifiedShipHeroUrlBySlug(repoRoot);
  for (const ship of seoShips) {
    const url = ship?.slug ? String(verifiedBySlug[ship.slug] || '').trim() : '';
    ship.directoryImageUrl = url;
  }
  return seoShips;
}

module.exports = {
  extractOgImageFromPortPage,
  loadVerifiedPortDestinationUrlBySlug,
  loadVerifiedShipHeroUrlBySlug,
  loadDestinationOwnerCandidatesBySlug,
  loadDestinationOwnerPortEntryBySlug,
  resolveDirectoryImageUrl,
  enrichSeoPortsForDirectoryIndex,
  enrichSeoShipsForDirectoryIndex,
  resetPortsDirectoryImageCachesForTests,
  resolveApprovedPortDestinationDisplayUrl,
};

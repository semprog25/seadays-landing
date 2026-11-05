'use strict';

/**
 * Permanent destination photography policy (ports/regions/countries/guides):
 * Pexels + Unsplash (+ owner-imported assets under /assets/img/ports-directory/) only.
 * Wikimedia Commons is never used for decorative destination photography.
 * Ship heroes and verified port terminal infrastructure photos are handled elsewhere.
 */

const PEXELS_IMAGE_HOST = 'images.pexels.com';
const UNSPLASH_IMAGE_HOSTS = new Set(['images.unsplash.com', 'plus.unsplash.com']);
const OWNER_ASSET_PREFIX = '/assets/img/ports-directory/';

const DESTINATION_POLICY_NOTE =
  'Destination photography: Pexels and Unsplash primary; Pixabay optional script-time fallback (assets downloaded under /assets/img/ports-directory/ only — no Pixabay CDN hotlinks). Wikimedia is not used for region/country/port destination heroes or directory tiles. Terminal infrastructure photos in port guides may remain verified Wikimedia.';

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function parseHttpsHost(url) {
  try {
    return new URL(String(url).trim()).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function isWikimediaCommonsUrl(url) {
  const host = parseHttpsHost(url);
  return host === 'upload.wikimedia.org' || host.endsWith('.wikimedia.org');
}

function isPexelsImageUrl(url) {
  return parseHttpsHost(url) === PEXELS_IMAGE_HOST;
}

function isUnsplashImageUrl(url) {
  return UNSPLASH_IMAGE_HOSTS.has(parseHttpsHost(url));
}

function isOwnerPortsDirectoryAssetUrl(url) {
  const s = String(url || '').trim();
  return s.startsWith(OWNER_ASSET_PREFIX) && !s.includes('..');
}

/**
 * @param {string} url
 * @returns {boolean}
 */
function isApprovedDestinationPhotographyUrl(url) {
  const s = String(url || '').trim();
  if (!s || s.includes('seadaysfav.png')) return false;
  if (isOwnerPortsDirectoryAssetUrl(s)) return true;
  if (!s.startsWith('https://')) return false;
  if (isWikimediaCommonsUrl(s)) return false;
  return isPexelsImageUrl(s) || isUnsplashImageUrl(s);
}

/**
 * @param {string} url
 * @returns {string}
 */
function destinationPhotographyRejectReason(url) {
  const s = String(url || '').trim();
  if (!s) return 'empty_url';
  if (isWikimediaCommonsUrl(s)) return 'policy_no_wikimedia_destination';
  if (s.startsWith('https://') && !isApprovedDestinationPhotographyUrl(s)) {
    return 'policy_destination_pexels_unsplash_or_owner_only';
  }
  if (s.startsWith('http://')) return 'policy_https_required';
  return '';
}

/**
 * Catalog KV records for port destination heroes must not surface Wikimedia URLs in UI.
 * @param {object} record
 * @returns {boolean}
 */
function isCatalogRecordApprovedForDestinationDisplay(record) {
  if (!record || typeof record !== 'object') return false;
  const role = String(record.role || 'destinationHero').trim();
  if (role === 'portInfrastructure') return false;
  const media = record.media || {};
  const url = String(media.thumbUrl || media.url || '').trim();
  return isApprovedDestinationPhotographyUrl(url);
}

/**
 * Owner inbox files must look like Pexels/Unsplash downloads (no Wikimedia renames).
 * @param {string} basename
 * @returns {boolean}
 */
function isAllowedOwnerDestinationSourceBasename(basename) {
  const base = String(basename || '').trim();
  if (!base || !/\.(jpe?g|webp|png)$/i.test(base)) return false;
  if (/wikimedia|commons/i.test(base)) return false;
  if (/^pexels-/i.test(base)) return true;
  if (/^Hamburg-pexels-/i.test(base)) return true;
  if (/^unsplash-/i.test(base)) return true;
  if (/^photo-\d+-unsplash/i.test(base)) return true;
  if (/^pixabay-/i.test(base)) return true;
  if (/destination-exterior-batch02-r3-pixabay-/i.test(base)) return true;
  return false;
}

module.exports = {
  DESTINATION_POLICY_NOTE,
  OWNER_ASSET_PREFIX,
  isWikimediaCommonsUrl,
  isPexelsImageUrl,
  isUnsplashImageUrl,
  isOwnerPortsDirectoryAssetUrl,
  isApprovedDestinationPhotographyUrl,
  destinationPhotographyRejectReason,
  isCatalogRecordApprovedForDestinationDisplay,
  isAllowedOwnerDestinationSourceBasename,
};

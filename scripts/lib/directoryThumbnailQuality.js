'use strict';

/**
 * Heuristic quality gate for /ports/ directory thumbnails (not ships).
 * Rejects people/ship-dominant/posters/maps/scans and known bad harvest picks.
 */

const fs = require('fs');
const path = require('path');
const {
  isApprovedDestinationPhotographyUrl,
  destinationPhotographyRejectReason,
} = require('./destinationImageSourcePolicy');

let blocklistCache = null;
let reviewStateCache = null;

function loadReviewState(repoRoot) {
  if (reviewStateCache) return reviewStateCache;
  const filePath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json');
  const empty = {
    humanApproved: {},
    rejectedOwnerBatchPhotos: {},
    rejectedCommonsFiles: [],
    rejectedUrlSubstrings: [],
  };
  if (!fs.existsSync(filePath)) {
    reviewStateCache = empty;
    return empty;
  }
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    reviewStateCache = {
      humanApproved:
        payload.humanApproved && typeof payload.humanApproved === 'object'
          ? payload.humanApproved
          : {},
      rejectedOwnerBatchPhotos:
        payload.rejectedOwnerBatchPhotos && typeof payload.rejectedOwnerBatchPhotos === 'object'
          ? payload.rejectedOwnerBatchPhotos
          : {},
      rejectedCommonsFiles: Array.isArray(payload.rejectedCommonsFiles)
        ? payload.rejectedCommonsFiles
        : [],
      rejectedUrlSubstrings: Array.isArray(payload.rejectedUrlSubstrings)
        ? payload.rejectedUrlSubstrings
        : [],
    };
  } catch {
    reviewStateCache = empty;
  }
  return reviewStateCache;
}

function resetDirectoryThumbnailQualityCachesForTests() {
  blocklistCache = null;
  reviewStateCache = null;
}

function loadBlocklist(repoRoot) {
  if (blocklistCache) return blocklistCache;
  const filePath = path.join(repoRoot, 'data', 'ports-directory-thumbnail-blocklist.json');
  const empty = { slugs: [], urls: [] };
  if (!fs.existsSync(filePath)) {
    blocklistCache = empty;
    return empty;
  }
  try {
    const payload = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    blocklistCache = {
      slugs: Array.isArray(payload.slugs) ? payload.slugs : [],
      urls: Array.isArray(payload.urls) ? payload.urls : [],
    };
  } catch {
    blocklistCache = empty;
  }
  return blocklistCache;
}

function decodeHaystack(url, meta = {}) {
  let pathPart = String(url || '');
  try {
    pathPart = decodeURIComponent(new URL(url).pathname);
  } catch {
    /* keep raw */
  }
  const commons = String(meta.commonsFile || meta.commons?.file || '').trim();
  const alt = String(meta.alt || meta.media?.alt || '').trim();
  return `${pathPart} ${commons} ${alt}`.toLowerCase();
}

const BAD_SUBSTRINGS = [
  'dpla',
  '1280px-thumbnail.jpeg',
  'poster',
  'magazine',
  'cover_art',
  'cover-art',
  'advertisement',
  'advert',
  'nautical_chart',
  'nautical chart',
  '_chart',
  '-chart-',
  '/chart',
  ' map ',
  '_map.',
  '-map-',
  '/map_',
  'scanned',
  'scan_',
  'illustration',
  'drawing',
  'logo',
  'children',
  ' child',
  'child_',
  'kids',
  'baby',
  'portrait',
  'wedding',
  'selfie',
  'parade',
  'demonstration',
  'anti-terrorism',
  'harbor_shield',
  'safety_boat',
  'shipyard',
  'cochin_shipyard',
  'ship_building',
  'launching',
  'postcard',
  'stamp',
  'brochure',
  'lifeboat',
  'life_boat',
  ' tender',
  '_tender',
  'docked_at',
  'docked_in',
  'aerial_shot',
  'cruise_terminal',
  'cruise_center',
  'harbour-',
  'harbor-',
  'flags.jpg',
  '_flags',
];

const SHIP_DOMINANT_REGEX = [
  /cruise[_\s-]?ship/i,
  /cruise[_\s-]?ships/i,
  /cruise[_\s-]?liner/i,
  /ocean[_\s-]?liner/i,
  /\bms[_\s-][a-z]/i,
  /\bmv[_\s-][a-z]/i,
  /aidabella/i,
  /majesty[_\s-]?of/i,
  /silver[_\s-]?wind/i,
  /maistrato/i,
  /kloster[_\s-]?cruise/i,
  /marella[_\s-]?explorer/i,
  /blue[_\s-]?star/i,
  /liners[_\s-]?at/i,
  /ships[_\s-]?in[_\s-]?port/i,
  /ship[_\s-]?in[_\s-]?port/i,
  /cruise[_\s-]?ships[_\s-]?in/i,
  /bow[_\s-]?of[_\s-]?the/i,
  /stern[_\s-]?of/i,
  /docked[_\s-]?cruise/i,
  /passenger[_\s-]?ship/i,
  /ferry.*cruise/i,
  /tui[_\s-]?ship/i,
  /costa[_\s-]?fortuna/i,
  /norwegian[_\s-]?epic/i,
  /oasis[_\s-]?of[_\s-]?the/i,
  /symphony[_\s-]?of[_\s-]?the/i,
  /harmony[_\s-]?of[_\s-]?the/i,
  /westerdam/i,
  /noordam/i,
  /zuiderdam/i,
  /rotterdam.*cruise/i,
  /lifeboat/i,
  /\(ship/i,
  /%28ship/i,
  /harbour.*ship/i,
  /harbor.*ship/i,
  /docked_at/i,
  /docked_in/i,
  /aerial.*cruise/i,
  /cruise_ships\.jpg/i,
  /cruiseships/i,
  /mein[_\s-]?schiff/i,
  /imo[_\s-]?\d{5,}/i,
  /_%28imo/i,
];

const REGION_BAD_SUBSTRINGS = [
  ...BAD_SUBSTRINGS,
  'cruise',
  'ship',
  'liner',
  'ferry',
  'yacht',
  'boat tour',
];

function isBlockedSlugOrUrl(slug, url, repoRoot) {
  const block = loadBlocklist(repoRoot);
  if (slug && block.slugs.includes(slug)) return 'blocklist_slug';
  const u = String(url || '').trim();
  if (u && block.urls.some((entry) => u.includes(entry) || entry.includes(u))) return 'blocklist_url';
  return '';
}

function assessPortDirectoryThumbnail(url, meta = {}, repoRoot = '') {
  const slug = String(meta.slug || '').trim();
  const u = String(url || '').trim();
  const root = repoRoot || path.join(__dirname, '..', '..');
  const review = loadReviewState(root);

  if (slug && review.humanApproved[slug]) {
    const approved = review.humanApproved[slug];
    const approvedUrl = String(approved.url || '').trim();
    if (approvedUrl && u === approvedUrl && isApprovedDestinationPhotographyUrl(approvedUrl)) {
      return { ok: true, reason: 'human_approved' };
    }
  }

  const commonsFile = String(meta.commonsFile || meta.commons?.file || '').trim();
  if (
    commonsFile &&
    review.rejectedCommonsFiles.some(
      (name) => name.toLowerCase() === commonsFile.toLowerCase()
    )
  ) {
    return { ok: false, reason: 'review_rejected_commons_file' };
  }

  for (const sub of review.rejectedUrlSubstrings) {
    if (sub && u.toLowerCase().includes(String(sub).toLowerCase())) {
      return { ok: false, reason: `review_rejected_url:${sub}` };
    }
  }

  if (!u) return { ok: false, reason: 'empty_url' };
  if (u.includes('seadaysfav.png')) return { ok: false, reason: 'placeholder' };

  // Owner-imported Pexels/Unsplash derivatives override slug blocklist (legacy Wikimedia demotions).
  if (isApprovedDestinationPhotographyUrl(u) && u.startsWith('/assets/img/ports-directory/')) {
    return { ok: true, reason: 'owner_asset' };
  }

  const blocked = isBlockedSlugOrUrl(slug, url, root);
  if (blocked) return { ok: false, reason: blocked };

  const policyReject = destinationPhotographyRejectReason(u);
  if (policyReject) return { ok: false, reason: policyReject };

  const hay = decodeHaystack(u, meta);
  for (const bad of BAD_SUBSTRINGS) {
    if (hay.includes(bad)) return { ok: false, reason: `keyword:${bad.trim()}` };
  }
  for (const re of SHIP_DOMINANT_REGEX) {
    if (re.test(hay)) return { ok: false, reason: `ship_pattern:${re.source.slice(0, 40)}` };
  }

  const categories = meta.categories || meta.commons?.categories;
  if (Array.isArray(categories)) {
    const catHay = categories.join(' ').toLowerCase();
    if (/\bpeople\b/.test(catHay) || /\bchildren\b/.test(catHay) || /\bportraits?\b/.test(catHay)) {
      return { ok: false, reason: 'commons_category_people' };
    }
  }

  return { ok: true, reason: 'ok' };
}

function assessRegionBrowseThumbnail(url, meta = {}) {
  const u = String(url || '').trim();
  if (!u) return { ok: false, reason: 'empty_url' };
  const hay = decodeHaystack(u, meta);
  for (const bad of REGION_BAD_SUBSTRINGS) {
    if (hay.includes(bad)) return { ok: false, reason: `region_keyword:${bad.trim()}` };
  }
  return { ok: true, reason: 'ok' };
}

function filterVerifiedPortUrl(slug, url, record, repoRoot) {
  const meta = {
    slug,
    commonsFile: record?.commons?.file,
    alt: record?.media?.alt,
    categories: record?.commons?.categories,
  };
  return assessPortDirectoryThumbnail(url, meta, repoRoot);
}

module.exports = {
  assessPortDirectoryThumbnail,
  assessRegionBrowseThumbnail,
  filterVerifiedPortUrl,
  loadBlocklist,
  loadReviewState,
  resetDirectoryThumbnailQualityCachesForTests,
};

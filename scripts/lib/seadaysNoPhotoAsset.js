'use strict';

/** Owner-supplied decorative placeholder — not destination photography. */
const SEADAYS_NO_PHOTO_WEBP_PATH = '/assets/img/ports-directory/seadays-no-image.webp';

/** Country-browse navigation chrome only — not destination photography. */
const SEADAYS_BACK_TO_REGIONS_CARD_WEBP_PATH =
  '/assets/img/ports-directory/ui/back-to-regions-card-owner.webp';

const SEADAYS_NO_PHOTO_INTRINSIC = { width: 1035, height: 780 };

function isSeadaysNoPhotoPlaceholderUrl(url) {
  const s = String(url || '').trim();
  if (!s) return false;
  return s === SEADAYS_NO_PHOTO_WEBP_PATH || s.endsWith('/seadays-no-image.webp');
}

function isSeadaysBackToRegionsNavigationUrl(url) {
  const s = String(url || '').trim();
  return s === SEADAYS_BACK_TO_REGIONS_CARD_WEBP_PATH;
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Directory / related-destination card media when no approved photo exists.
 */
function buildNoPhotoDirectoryMediaHtml() {
  const { width, height } = SEADAYS_NO_PHOTO_INTRINSIC;
  return (
    `<span class="directory-card-media directory-card-media--neutral" aria-hidden="true">` +
    `<img class="directory-card-image directory-card-image--no-photo" src="${SEADAYS_NO_PHOTO_WEBP_PATH}" alt="" ` +
    `width="${width}" height="${height}" loading="lazy" decoding="async" data-img-source="no-photo-placeholder">` +
    `</span>`
  );
}

/**
 * Region / country browse card thumbnail when no regional photo is configured.
 */
function buildNoPhotoRegionOrCountryMediaHtml(imageClass) {
  const { width, height } = SEADAYS_NO_PHOTO_INTRINSIC;
  const base = String(imageClass || 'region-card-image').trim();
  return (
    `<span class="region-card-media">` +
    `<img class="${escapeHtml(base)} ${escapeHtml(base)}--no-photo" src="${SEADAYS_NO_PHOTO_WEBP_PATH}" alt="" ` +
    `width="${width}" height="${height}" loading="lazy" decoding="async" aria-hidden="true" data-img-source="no-photo-placeholder">` +
    `</span>`
  );
}

function buildNoPhotoCountryCardMediaHtml() {
  const { width, height } = SEADAYS_NO_PHOTO_INTRINSIC;
  return (
    `<span class="country-card-media">` +
    `<img class="country-card-image country-card-image--no-photo" src="${SEADAYS_NO_PHOTO_WEBP_PATH}" alt="" ` +
    `width="${width}" height="${height}" loading="lazy" decoding="async" aria-hidden="true" data-img-source="no-photo-placeholder">` +
    `</span>`
  );
}

const NO_PHOTO_OBJECT_FIT_CSS = `
/* Full-bleed owner placeholder in the 16:10 slot (absolute sizing avoids intrinsic height clipping). */
.directory-card-media--neutral .directory-card-image--no-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
  object-position: center;
  padding: 0;
  box-sizing: border-box;
  background: transparent;
}
.region-card-media:has(.region-card-image--no-photo),
.country-card-media:has(.country-card-image--no-photo) {
  aspect-ratio: 16 / 10;
}
.region-card-media:has(.region-card-image--no-photo)::after,
.country-card-media:has(.country-card-image--no-photo)::after {
  display: none;
}
.region-card-media .region-card-image--no-photo,
.country-card-media .country-card-image--no-photo {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  aspect-ratio: auto;
  object-fit: cover;
  object-position: center;
  padding: 0;
  box-sizing: border-box;
  background: transparent;
}
`;

module.exports = {
  SEADAYS_NO_PHOTO_WEBP_PATH,
  SEADAYS_BACK_TO_REGIONS_CARD_WEBP_PATH,
  SEADAYS_NO_PHOTO_INTRINSIC,
  isSeadaysNoPhotoPlaceholderUrl,
  isSeadaysBackToRegionsNavigationUrl,
  buildNoPhotoDirectoryMediaHtml,
  buildNoPhotoRegionOrCountryMediaHtml,
  buildNoPhotoCountryCardMediaHtml,
  NO_PHOTO_OBJECT_FIT_CSS,
};

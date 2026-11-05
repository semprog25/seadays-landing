'use strict';

const { isApprovedDestinationPhotographyUrl } = require('./destinationImageSourcePolicy');
const { objectPositionStyle, parseFocalPercent } = require('./ownerImagePresentation');

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const DESTINATION_CARD_NEUTRAL_MEDIA =
  `<span class="directory-card-media directory-card-media--neutral" aria-hidden="true"></span>`;

function buildDirectoryCardImageStyleAttr(objectPosition) {
  if (objectPosition && typeof objectPosition === 'object') {
    const pos = objectPositionStyle(objectPosition);
    return pos ? ` style="${pos}"` : '';
  }
  const pos =
    typeof objectPosition === 'string' && objectPosition.trim()
      ? objectPosition.trim()
      : parseFocalPercent(objectPosition);
  return pos ? ` style="object-position:${pos};"` : '';
}

/**
 * @param {{ imgUrl: string, alt: string, objectPosition?: string|object, loading?: string, imgClassExtra?: string }} media
 */
function buildDestinationCardMediaHtml(media) {
  const url = String(media?.imgUrl || '').trim();
  if (!url || !isApprovedDestinationPhotographyUrl(url)) {
    return { html: DESTINATION_CARD_NEUTRAL_MEDIA, hasPhoto: false };
  }
  const alt = String(media?.alt || 'Cruise destination').trim();
  const loading = media?.loading === 'eager' ? 'eager' : 'lazy';
  const extraClass = media?.imgClassExtra ? ` ${media.imgClassExtra}` : '';
  const focalAttr = buildDirectoryCardFocalDataAttr(media?.objectPosition);
  return {
    hasPhoto: true,
    html:
      `<img class="directory-card-image img-loading${extraClass}" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" ` +
      `width="1280" loading="${loading}" decoding="async" data-img-source="directory"${focalAttr} ` +
      `onload="this.classList.remove('img-loading')">`,
  };
}

/** Preserve focal metadata for QA/hero without cover-cropping directory thumbnails. */
function buildDirectoryCardFocalDataAttr(objectPosition) {
  if (objectPosition && typeof objectPosition === 'object') {
    const pos = parseFocalPercent(objectPosition);
    return pos ? ` data-directory-focal="${escapeHtml(pos)}"` : '';
  }
  const pos =
    typeof objectPosition === 'string' && objectPosition.trim()
      ? objectPosition.trim()
      : parseFocalPercent(objectPosition);
  return pos ? ` data-directory-focal="${escapeHtml(pos)}"` : '';
}

/**
 * Shared destination card anchor (directory grid + related destinations).
 */
function buildDestinationDirectoryCardHtml(options) {
  const href = String(options?.href || '#').trim();
  const title = String(options?.title || '').trim();
  const meta = String(options?.meta || '').trim();
  const hint = String(options?.hint || 'Open port guide →').trim();
  const dataAttrs = String(options?.dataAttrs || '').trim();
  const extraClasses = String(options?.extraClasses || '').trim();
  const blurbHtml = options?.blurbHtml || '';
  const bookableHtml = options?.bookableHtml || '';
  const ratingHtml = options?.ratingHtml || '';
  const bottomHintInRow = options?.bottomHintInRow !== false;

  const media = buildDestinationCardMediaHtml({
    imgUrl: options?.imgUrl,
    alt: options?.alt || title,
    objectPosition: options?.objectPosition,
    loading: options?.loading,
  });

  const cardClass =
    `seo-grid-card directory-card directory-card--with-photo${extraClasses ? ` ${extraClasses}` : ''}`.trim();

  const metaBlock = meta ? `<span class="seo-grid-card-meta">${escapeHtml(meta)}</span>` : '';
  const bottomBlock = bottomHintInRow
    ? `<span class="seo-grid-card-bottom">${ratingHtml}<span class="seo-grid-card-hint">${escapeHtml(hint)}</span></span>`
    : ratingHtml
      ? `<span class="seo-grid-card-bottom">${ratingHtml}</span>`
      : `<span class="seo-grid-card-hint">${escapeHtml(hint)}</span>`;

  return (
    `<a href="${escapeHtml(href)}" class="${cardClass}"${dataAttrs ? ` ${dataAttrs}` : ''}>` +
    media.html +
    `<span class="directory-card-body">` +
    `<span class="seo-grid-card-title">${escapeHtml(title)}</span>` +
    metaBlock +
    blurbHtml +
    bookableHtml +
    bottomBlock +
    `</span></a>`
  );
}

const DESTINATION_DIRECTORY_CARD_CSS = `
.directory-card-media--neutral { display: block; width: 100%; aspect-ratio: 16 / 10; min-height: 120px; background: radial-gradient(ellipse 85% 65% at 50% 18%, rgba(255,0,51,0.1), transparent 58%), linear-gradient(165deg, rgba(255,255,255,0.07) 0%, rgba(10,10,12,0.98) 52%, rgba(255,0,51,0.06) 100%); border-bottom: 1px solid rgba(255,255,255,0.06); }
.directory-card-image { width: 100%; height: auto; max-width: 100%; aspect-ratio: unset; object-fit: contain; object-position: center; display: block; background: transparent; flex-shrink: 0; vertical-align: middle; }
.directory-card--with-photo { display: flex; flex-direction: column; min-width: 0; height: auto; align-self: start; }
.directory-card-body { display: flex; flex-direction: column; gap: 6px; padding: 15px 16px 16px; flex: 1 1 auto; min-width: 0; }
.directory-card-body .seo-grid-card-title { overflow-wrap: break-word; word-break: normal; }
.directory-card-body .seo-grid-card-meta { display: block; margin-top: 2px; }
.directory-card-body .seo-grid-card-hint { display: block; margin-top: 8px; font-size: 12px; font-weight: 700; color: rgba(255,255,255,0.55); }
.seo-grid-card-bottom { display: flex; align-items: flex-end; justify-content: space-between; gap: 10px; margin-top: auto; padding-top: 6px; flex-wrap: wrap; }
`;

module.exports = {
  DESTINATION_CARD_NEUTRAL_MEDIA,
  DESTINATION_DIRECTORY_CARD_CSS,
  buildDestinationCardMediaHtml,
  buildDestinationDirectoryCardHtml,
  buildDirectoryCardFocalDataAttr,
};

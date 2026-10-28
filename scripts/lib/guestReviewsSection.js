'use strict';

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function hasRatedGuestReviews(entity) {
  const rating = typeof entity?.rating === 'number' ? entity.rating : Number(entity?.rating);
  const reviewCount =
    typeof entity?.reviewCount === 'number' ? entity.reviewCount : Number(entity?.reviewCount);
  if (!Number.isFinite(rating) || rating <= 0) return false;
  if (!Number.isFinite(reviewCount) || reviewCount <= 0) return false;
  return true;
}

function formatGuestReviewRating(rating) {
  const n = typeof rating === 'number' ? rating : Number(rating);
  if (!Number.isFinite(n) || n <= 0) return null;
  return (Math.round(Math.min(5, n) * 10) / 10).toFixed(1);
}

function buildStarGlyphsFromRating(numeric) {
  const n = Number(numeric);
  const rounded = !Number.isFinite(n) ? 0 : Math.min(5, Math.max(0, Math.round(n)));
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= rounded ? '★' : '☆';
  return s;
}

/**
 * Guest Reviews block for ship/port detail pages. Uses live aggregate fields only; never invents data.
 */
function buildGuestReviewsSectionHtml(entity) {
  const labelName = String(entity?.name || 'this page').trim();
  if (hasRatedGuestReviews(entity)) {
    const display = formatGuestReviewRating(entity.rating);
    const count = Math.round(Number(entity.reviewCount));
    const stars = buildStarGlyphsFromRating(entity.rating);
    const reviewLabel = count === 1 ? '1 guest review' : `${count} guest reviews`;
    return (
      `<section class="guest-reviews" id="guest-reviews" aria-labelledby="guest-reviews-heading">` +
      `<h2 id="guest-reviews-heading">Guest reviews</h2>` +
      `<p class="guest-reviews-summary">` +
      `<span class="guest-reviews-stars" role="img" aria-label="Average rating ${escapeHtml(display)} out of 5 from ${count} guest reviews on ${escapeHtml(labelName)}">${stars}</span>` +
      `<span class="guest-reviews-meta"><strong>${escapeHtml(display)}</strong> · ${escapeHtml(reviewLabel)}</span>` +
      `</p>` +
      `<p class="guest-reviews-note">Ratings come from verified guest submissions in the SeaDays app.</p>` +
      `</section>`
    );
  }
  return (
    `<section class="guest-reviews" id="guest-reviews" aria-labelledby="guest-reviews-heading">` +
    `<h2 id="guest-reviews-heading">Guest reviews</h2>` +
    `<p class="guest-reviews-empty">No guest reviews yet.</p>` +
    `<p class="guest-reviews-cta">Sailed on ${escapeHtml(labelName)}? Share your experience in SeaDays after your cruise.</p>` +
    `<p class="guest-reviews-cta"><a class="guest-reviews-download" href="/download/">Get SeaDays</a></p>` +
    `</section>`
  );
}

const GUEST_REVIEWS_SECTION_CSS = `
.guest-reviews { margin: 28px 0 32px; padding: 20px 22px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); }
.guest-reviews h2 { margin: 0 0 12px; font-size: 22px; }
.guest-reviews-summary { display: flex; flex-wrap: wrap; align-items: center; gap: 10px 14px; margin: 0 0 8px; font-size: 17px; color: rgba(255,255,255,0.9); }
.guest-reviews-stars { color: #f5c518; letter-spacing: 0.06em; font-size: 18px; }
.guest-reviews-meta strong { font-weight: 800; color: #fff; }
.guest-reviews-note, .guest-reviews-empty, .guest-reviews-cta { margin: 0 0 10px; font-size: 16px; line-height: 1.65; color: rgba(255,255,255,0.82); }
.guest-reviews-download { color: var(--neon-red); font-weight: 700; text-decoration: none; }
.guest-reviews-download:hover { text-decoration: underline; }
@media (max-width: 720px) { .guest-reviews-summary { flex-direction: column; align-items: flex-start; } }
`;

module.exports = {
  buildGuestReviewsSectionHtml,
  hasRatedGuestReviews,
  formatGuestReviewRating,
  GUEST_REVIEWS_SECTION_CSS,
};

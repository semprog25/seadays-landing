'use strict';

/**
 * Idempotent mid-article AdSense slot insertion for SeaDays blog HTML.
 * Blog articles only. No Auto Ads. Manual responsive unit.
 */

const { ADSENSE_CLIENT_ID, ADSENSE_ARTICLE_MID_SLOT, isAdSenseConfigured } = require('./adsenseConfig');

const AD_SLOT_CLASS = 'seadays-ad-slot';
const AD_PLACEMENT = 'article-mid';
/** Skip thin bodies — need enough editorial content for a natural mid-article unit. */
const MIN_BODY_WORDS = 400;
/** Require at least this many H2 section headings before considering a slot. */
const MIN_H2_COUNT = 2;

const EXISTING_SLOT_RE =
  /<aside\b[^>]*\bseadays-ad-slot\b[^>]*>[\s\S]*?<\/aside>/gi;

function stripExistingAdSlots(bodyHtml) {
  if (!bodyHtml || typeof bodyHtml !== 'string') return bodyHtml || '';
  return bodyHtml.replace(EXISTING_SLOT_RE, '');
}

function countWordsFromHtml(html) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return 0;
  return text.split(' ').filter(Boolean).length;
}

function findH2Matches(bodyHtml) {
  const re = /<h2\b[^>]*>/gi;
  const matches = [];
  let m;
  while ((m = re.exec(bodyHtml)) !== null) {
    matches.push({ index: m.index, length: m[0].length });
  }
  return matches;
}

/**
 * Insert index: after ≥2 H2 sections, near ~40% of body length, snapped to a clean boundary.
 * @returns {number} index into bodyHtml, or -1 if no suitable placement
 */
function findArticleMidInsertIndex(bodyHtml) {
  const h2s = findH2Matches(bodyHtml);
  if (h2s.length < MIN_H2_COUNT) return -1;

  const target = Math.floor(bodyHtml.length * 0.4);

  // Prefer inserting immediately before an H2 that is at/after the 3rd heading and ~40%.
  if (h2s.length >= 3) {
    const minIndex = h2s[2].index;
    for (let i = 2; i < h2s.length; i++) {
      if (h2s[i].index >= Math.max(target, minIndex)) return h2s[i].index;
    }
    return h2s[h2s.length - 1].index;
  }

  // Exactly two H2s: insert inside the second section after content, near 40% when possible.
  const secondH2 = h2s[1].index;
  const searchFrom = Math.max(secondH2, target);
  const slice = bodyHtml.slice(searchFrom);
  const pClose = slice.search(/<\/p>/i);
  if (pClose >= 0) return searchFrom + pClose + '</p>'.length;

  // Fallback: after two </p> following the second H2
  const afterSecond = bodyHtml.slice(secondH2);
  const re = /<\/p>/gi;
  let count = 0;
  let pos = 0;
  let m;
  while ((m = re.exec(afterSecond)) !== null && count < 2) {
    count += 1;
    pos = m.index + m[0].length;
  }
  if (pos > 0) return secondH2 + pos;
  return -1;
}

function buildAdSlotHtml(clientId, slotId) {
  const client = String(clientId || '').trim();
  const slot = String(slotId || '').trim();
  return (
    `<aside class="${AD_SLOT_CLASS}" data-ad-placement="${AD_PLACEMENT}" aria-label="Advertisement">` +
    `<ins class="adsbygoogle"` +
    ` style="display:block"` +
    ` data-ad-client="${client}"` +
    ` data-ad-slot="${slot}"` +
    ` data-ad-format="auto"` +
    ` data-full-width-responsive="true"` +
    `></ins>` +
    `</aside>`
  );
}

/**
 * CSS for reserved mid-article unit (CLS). Applied in article page styles.
 * Height reserved only when slot is marked ready (advertising consent granted).
 */
function getAdSlotCss() {
  return `
.article-body aside.${AD_SLOT_CLASS}{display:none;margin:0;padding:0;border:0;border-radius:0;background:transparent;min-height:0;overflow:hidden;}
.article-body aside.${AD_SLOT_CLASS}.seadays-ad-slot--ready{display:block;margin:28px 0;min-height:250px;}
.article-body aside.${AD_SLOT_CLASS}.seadays-ad-slot--inactive{display:none;min-height:0;margin:0;}
.article-body aside.${AD_SLOT_CLASS} .adsbygoogle{display:block;min-height:0;}
.article-body aside.${AD_SLOT_CLASS}.seadays-ad-slot--ready .adsbygoogle{min-height:90px;}
@media (max-width:600px){
  .article-body aside.${AD_SLOT_CLASS}.seadays-ad-slot--ready{min-height:100px;}
  .article-body aside.${AD_SLOT_CLASS}.seadays-ad-slot--ready .adsbygoogle{min-height:80px;}
}
`.trim();
}

/**
 * Insert at most one mid-article slot. Idempotent. No-op when AdSense is not configured
 * or the body is too short / lacks enough H2 structure.
 *
 * @param {string} bodyHtml
 * @param {{ clientId?: string, slotId?: string, force?: boolean }} [opts]
 * @returns {string}
 */
function insertArticleMidAdSlot(bodyHtml, opts = {}) {
  let html = stripExistingAdSlots(bodyHtml);
  const clientId = (opts.clientId != null ? opts.clientId : ADSENSE_CLIENT_ID).trim();
  const slotId = (opts.slotId != null ? opts.slotId : ADSENSE_ARTICLE_MID_SLOT).trim();
  const configured = opts.force === true
    ? /^ca-pub-\d{10,}$/.test(clientId) && /^\d{5,}$/.test(slotId)
    : isAdSenseConfigured();

  if (!configured) return html;
  if (countWordsFromHtml(html) < MIN_BODY_WORDS) return html;

  const insertAt = findArticleMidInsertIndex(html);
  if (insertAt < 0) return html;

  const slotHtml = buildAdSlotHtml(clientId, slotId);
  return html.slice(0, insertAt) + slotHtml + html.slice(insertAt);
}

module.exports = {
  AD_SLOT_CLASS,
  AD_PLACEMENT,
  MIN_BODY_WORDS,
  MIN_H2_COUNT,
  stripExistingAdSlots,
  countWordsFromHtml,
  findArticleMidInsertIndex,
  buildAdSlotHtml,
  getAdSlotCss,
  insertArticleMidAdSlot,
};

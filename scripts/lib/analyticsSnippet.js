'use strict';

/**
 * Shared GA4 + Consent Mode v2 head snippet for SeaDays website pages.
 * Generators and static pages must use this single source to avoid duplicate tags.
 */

const { getAdsenseAccountMetaHtml } = require('./adsenseConfig');

const GA_MEASUREMENT_ID = 'G-WSQDQ33QZD';
const ANALYTICS_SCRIPT_SRC = '/assets/js/seadays-analytics.js';
const DOWNLOAD_SCRIPT_SRC = '/assets/js/seadays-download.js';
const ADSENSE_ACCOUNT_META_RE =
  /<meta\s+name=["']google-adsense-account["'][^>]*>\s*/gi;

/**
 * HTML injected once per page, as early in <head> as practical (after charset).
 * Consent defaults are denied before gtag.js loads (Consent Mode v2).
 * Includes the AdSense account meta for site association only (no ad script).
 */
function getAnalyticsHeadHtml() {
  const adsenseMeta = getAdsenseAccountMetaHtml();
  return `<!-- SeaDays analytics: GA4 ${GA_MEASUREMENT_ID} + Consent Mode v2 -->
${adsenseMeta ? `${adsenseMeta}\n` : ''}<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('consent', 'default', {
  analytics_storage: 'denied',
  ad_storage: 'denied',
  ad_user_data: 'denied',
  ad_personalization: 'denied',
  wait_for_update: 500
});
</script>
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}"></script>
<script>
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
window.__SEADAYS_GA_READY__ = true;
</script>
<script src="${ANALYTICS_SCRIPT_SRC}" defer></script>
<script src="${DOWNLOAD_SCRIPT_SRC}" defer></script>`;
}

function countAdsenseAccountMeta(html) {
  return (String(html || '').match(/<meta\s+name=["']google-adsense-account["']/gi) || []).length;
}

function insertAfterCharsetOrHead(html, snippet) {
  const charsetMatch = html.match(/<meta\s+charset=["']?UTF-8["']?\s*\/?>/i);
  if (charsetMatch && charsetMatch.index != null) {
    const insertAt = charsetMatch.index + charsetMatch[0].length;
    return html.slice(0, insertAt) + '\n' + snippet + '\n' + html.slice(insertAt);
  }

  const headMatch = html.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index != null) {
    const insertAt = headMatch.index + headMatch[0].length;
    return html.slice(0, insertAt) + '\n' + snippet + '\n' + html.slice(insertAt);
  }

  return snippet + '\n' + html;
}

/**
 * Ensures exactly one google-adsense-account meta. Does not load adsbygoogle.js.
 */
function ensureAdsenseAccountMeta(html) {
  if (!html || typeof html !== 'string') return html;
  const meta = getAdsenseAccountMetaHtml();
  if (!meta) return html.replace(ADSENSE_ACCOUNT_META_RE, '');

  const escapedContent = meta.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const exactRe = new RegExp(escapedContent.replace(/\s+/g, '\\s*'), 'i');
  const total = countAdsenseAccountMeta(html);
  if (total === 1 && exactRe.test(html)) return html;

  let next = html.replace(ADSENSE_ACCOUNT_META_RE, '');
  const commentMatch = next.match(/<!--\s*SeaDays analytics:[^\n]*-->/);
  if (commentMatch && commentMatch.index != null) {
    const insertAt = commentMatch.index + commentMatch[0].length;
    return next.slice(0, insertAt) + '\n' + meta + next.slice(insertAt);
  }
  return insertAfterCharsetOrHead(next, meta);
}

const LEGACY_GA_BLOCK_RE =
  /(?:<!--\s*Google tag \(gtag\.js\)\s*-->\s*)?<script\s+async\s+src="https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-WSQDQ33QZD"><\/script>\s*<script>\s*window\.dataLayer\s*=\s*window\.dataLayer\s*\|\|\s*\[\];\s*function\s+gtag\(\)\s*\{\s*dataLayer\.push\(arguments\);\s*\}\s*gtag\('js',\s*new Date\(\)\);\s*gtag\('config',\s*'G-WSQDQ33QZD'\);\s*<\/script>/gi;

const SHARED_GA_BLOCK_RE =
  /<!--\s*SeaDays analytics:[\s\S]*?<script\s+src="\/assets\/js\/seadays-analytics\.js"[^>]*><\/script>(?:\s*<script\s+src="\/assets\/js\/seadays-download\.js"[^>]*><\/script>)?/gi;

/**
 * Removes legacy inline gtag blocks and any prior shared SeaDays analytics snippet.
 */
function stripAnalyticsFromHtml(html) {
  if (!html || typeof html !== 'string') return html;
  return html.replace(SHARED_GA_BLOCK_RE, '').replace(LEGACY_GA_BLOCK_RE, '');
}

/**
 * Ensures exactly one shared analytics head snippet is present.
 * Inserts after <meta charset> when possible, otherwise after <head>.
 * Idempotent when the shared snippet is already present and unique.
 */
function injectAnalyticsHead(html) {
  if (!html || typeof html !== 'string') return html;

  const hasSharedScript = /\/assets\/js\/seadays-analytics\.js/.test(html);
  const hasConsentDefault = /gtag\(\s*['"]consent['"]\s*,\s*['"]default['"]/.test(html);
  const configCount = (html.match(/gtag\(\s*['"]config['"]/g) || []).length;

  if (hasSharedScript && hasConsentDefault && configCount === 1) {
    let next = ensureAdsenseAccountMeta(html);
    if (!next.includes(DOWNLOAD_SCRIPT_SRC)) {
      next = next.replace(
        /<script src="\/assets\/js\/seadays-analytics\.js" defer><\/script>/g,
        `<script src="${ANALYTICS_SCRIPT_SRC}" defer></script>\n<script src="${DOWNLOAD_SCRIPT_SRC}" defer></script>`
      );
    }
    return next;
  }

  let next = stripAnalyticsFromHtml(html);
  next = next.replace(ADSENSE_ACCOUNT_META_RE, '');
  const snippet = getAnalyticsHeadHtml();
  return insertAfterCharsetOrHead(next, snippet);
}

module.exports = {
  GA_MEASUREMENT_ID,
  ANALYTICS_SCRIPT_SRC,
  getAnalyticsHeadHtml,
  stripAnalyticsFromHtml,
  injectAnalyticsHead,
  ensureAdsenseAccountMeta,
  countAdsenseAccountMeta,
};

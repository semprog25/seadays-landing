'use strict';

/**
 * Canonical SeaDays store + download URLs.
 * Do not invent store IDs. These are the live listings verified 2026-08-18.
 */

const ANDROID_PACKAGE_ID = 'com.seadays.app';
const IOS_APP_ID = '6759758357';
const IOS_BUNDLE_ID = 'com.seadays.app';
const SITE_ORIGIN = 'https://seadays.app';
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE_ID}`;
const APP_STORE_URL = `https://apps.apple.com/app/id${IOS_APP_ID}`;
const DOWNLOAD_PATH = '/download/';

/**
 * Apple campaign `pt` (provider token) comes from App Store Connect → App Analytics
 * → Campaigns. Leave empty until the token is pasted into data/acquisition-campaigns.json.
 */
const DEFAULT_APPLE_PROVIDER_TOKEN = '';

const ALLOWED_CAMPAIGN_RE = /^[a-z0-9][a-z0-9_]{1,63}$/;

function sanitizeCampaign(value, fallback = 'organic_web') {
  const input = String(value || '');
  if (/[<>]|javascript:/i.test(input)) return fallback;
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
  if (ALLOWED_CAMPAIGN_RE.test(raw)) return raw;
  return fallback;
}

function sanitizeToken(value, max = 64) {
  const raw = String(value || '')
    .trim()
    .slice(0, max);
  if (!raw) return '';
  if (!/^[A-Za-z0-9._-]{1,160}$/.test(raw)) return '';
  return raw;
}

/**
 * Campaign values that must keep hyphens (blog slugs). Underscore campaigns
 * still go through sanitizeCampaign.
 */
function sanitizePreservedCampaign(value, fallback = 'organic_web') {
  const input = String(value || '');
  if (/[<>]|javascript:/i.test(input)) return fallback;
  const raw = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  if (/^[a-z0-9][a-z0-9_-]{0,119}$/.test(raw)) return raw;
  return fallback;
}

/**
 * Real App Store Connect provider token only. Placeholder prose in the
 * acquisition file is not a token, so `pt` stays off the URL.
 */
function loadAppleProviderToken() {
  const fromConst = sanitizeToken(DEFAULT_APPLE_PROVIDER_TOKEN, 20);
  if (fromConst) return fromConst;
  try {
    const data = require('../../data/acquisition-campaigns.json');
    const raw = data && typeof data.appleProviderToken === 'string' ? data.appleProviderToken.trim() : '';
    if (!raw || /\s/.test(raw)) return '';
    return sanitizeToken(raw, 20);
  } catch (err) {
    return '';
  }
}

/**
 * @param {Record<string, string | undefined>} [opts]
 */
function normalizeTracking(opts = {}) {
  const source = sanitizeToken(opts.utm_source || opts.source, 40) || 'seadays_web';
  const medium = sanitizeToken(opts.utm_medium || opts.medium, 40) || 'web';
  const campaign = opts.preserveCampaign
    ? sanitizePreservedCampaign(opts.utm_campaign || opts.campaign, 'organic_web')
    : sanitizeCampaign(opts.utm_campaign || opts.campaign, 'organic_web');
  const content = sanitizeToken(opts.utm_content || opts.content, 64);
  const term = sanitizeToken(opts.utm_term || opts.term, 64);
  const applePt = sanitizeToken(opts.pt || opts.apple_pt, 20) || loadAppleProviderToken();
  const ctMax = opts.ct ? 160 : 40;
  const appleCt = sanitizeToken(opts.ct || campaign, ctMax) || sanitizeToken(campaign, 160) || campaign;
  return { source, medium, campaign, content, term, applePt, appleCt };
}

function appendQuery(base, params) {
  const url = new URL(base, SITE_ORIGIN);
  Object.entries(params).forEach(([key, value]) => {
    if (value == null || value === '') return;
    url.searchParams.set(key, String(value));
  });
  return url.toString();
}

/**
 * Google Play Campaign Measurement uses the `referrer` query param.
 * Also keep standard utm_* on the URL for web analytics continuity.
 */
function playStoreUrl(opts = {}) {
  const t = normalizeTracking(opts);
  const referrerParts = [
    `utm_source=${encodeURIComponent(t.source)}`,
    `utm_medium=${encodeURIComponent(t.medium)}`,
    `utm_campaign=${encodeURIComponent(t.campaign)}`,
  ];
  if (t.content) referrerParts.push(`utm_content=${encodeURIComponent(t.content)}`);
  if (t.term) referrerParts.push(`utm_term=${encodeURIComponent(t.term)}`);
  return appendQuery(PLAY_STORE_URL, {
    utm_source: t.source,
    utm_medium: t.medium,
    utm_campaign: t.campaign,
    utm_content: t.content || undefined,
    utm_term: t.term || undefined,
    referrer: referrerParts.join('&'),
  });
}

/**
 * Apple campaign links: pt (provider) + ct (campaign text) + mt=8 (mobile app).
 * Without `pt`, Apple App Analytics cannot attribute the campaign. `ct` is still set.
 */
function appStoreUrl(opts = {}) {
  const t = normalizeTracking(opts);
  const params = {
    utm_source: t.source,
    utm_medium: t.medium,
    utm_campaign: t.campaign,
  };
  if (t.content) params.utm_content = t.content;
  params.ct = t.appleCt;
  if (opts.includeMt !== false) params.mt = '8';
  if (t.applePt) params.pt = t.applePt;
  return appendQuery(APP_STORE_URL, params);
}

/**
 * Blog inline store badges. Apple `pt` is included only when a real provider
 * token is already in the repo. `ct` is blog_<slug>. Play uses referrer plus
 * the same utm_* query style as the homepage badges.
 * @param {string} slug
 * @param {'intro' | 'end'} placement
 */
function blogStoreUrls(slug, placement) {
  const content = placement === 'end' ? 'end' : 'intro';
  const campaign = sanitizePreservedCampaign(slug, 'blog_post');
  const ct = `blog_${campaign}`;
  const tracking = {
    source: 'seadays_blog',
    medium: 'blog_cta',
    campaign,
    content,
    ct,
    preserveCampaign: true,
    includeMt: false,
  };
  return {
    campaign,
    content,
    ct,
    play: playStoreUrl(tracking),
    apple: appStoreUrl(tracking),
  };
}

/**
 * Default /download/ store badges when the page has no inbound campaign.
 * Play referrer carries the same utm values. iOS campaign token is ct=download_page.
 */
function downloadPageStoreUrls() {
  const tracking = {
    source: 'seadays_web',
    medium: 'download_page',
    campaign: 'download',
    ct: 'download_page',
    includeMt: false,
  };
  return {
    play: playStoreUrl(tracking),
    apple: appStoreUrl(tracking),
  };
}

/**
 * Download-page URLs.
 *
 * Taxonomy (do not emit both identifiers with the same value):
 * - Website chrome / CTAs: standard UTM only
 *   /download/?utm_source=seadays_web&utm_medium=footer&utm_campaign=organic_web
 * - Compact QR / print / bio: internal id only
 *   /download/?campaign=hamburg_port
 *
 * Runtime (`seadays-download.js`) still reads campaign OR utm_campaign OR ct,
 * so existing duplicated URLs keep working.
 *
 * @param {Record<string, string | boolean | undefined>} [opts]
 */
function downloadPagePath(opts = {}) {
  const t = normalizeTracking(opts);
  const params = opts.compact
    ? { campaign: t.campaign }
    : {
        utm_source: t.source,
        utm_medium: t.medium,
        utm_campaign: t.campaign,
      };
  if (!opts.compact && t.content) params.utm_content = t.content;
  if (!opts.compact && t.term) params.utm_term = t.term;
  const url = appendQuery(`${SITE_ORIGIN}${DOWNLOAD_PATH}`, params);
  return url.replace(SITE_ORIGIN, '') || DOWNLOAD_PATH;
}

/**
 * Drop redundant `campaign=` when it duplicates `utm_campaign=` on /download/ hrefs.
 * Leaves compact `?campaign=` URLs (no utm_campaign) untouched.
 * @param {string} html
 */
function stripRedundantCampaignParamsInHtml(html) {
  return String(html || '').replace(
    /href=(["'])(\/download\/\?[^"']+)\1/g,
    (full, quote, href) => {
      const decoded = String(href).replace(/&amp;/g, '&');
      let url;
      try {
        url = new URL(decoded, SITE_ORIGIN);
      } catch (e) {
        return full;
      }
      const utm = url.searchParams.get('utm_campaign');
      const camp = url.searchParams.get('campaign');
      if (!utm || !camp || utm !== camp) return full;
      url.searchParams.delete('campaign');
      const nextPath = `${url.pathname}${url.search}`;
      const encoded = href.indexOf('&amp;') !== -1 ? nextPath.replace(/&/g, '&amp;') : nextPath;
      return `href=${quote}${encoded}${quote}`;
    }
  );
}

function downloadPageUrl(opts = {}) {
  return `${SITE_ORIGIN}${downloadPagePath(opts)}`;
}

module.exports = {
  ANDROID_PACKAGE_ID,
  IOS_APP_ID,
  IOS_BUNDLE_ID,
  SITE_ORIGIN,
  PLAY_STORE_URL,
  APP_STORE_URL,
  DOWNLOAD_PATH,
  ALLOWED_CAMPAIGN_RE,
  sanitizeCampaign,
  sanitizeToken,
  sanitizePreservedCampaign,
  loadAppleProviderToken,
  normalizeTracking,
  playStoreUrl,
  appStoreUrl,
  blogStoreUrls,
  downloadPageStoreUrls,
  downloadPagePath,
  downloadPageUrl,
  stripRedundantCampaignParamsInHtml,
};

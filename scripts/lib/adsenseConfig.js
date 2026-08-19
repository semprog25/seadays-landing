'use strict';

/**
 * Google AdSense config for seadays.app (website only — not AdMob / app-ads.txt).
 *
 * Values confirmed from Google AdSense console (Ads → By ad unit → Responsive Display):
 *   client: ca-pub-3084834499411817
 *   unit:   SeaDays Blog Article Mid (responsive display) → slot 4330928521
 *   unit:   SeaDays CO2 Calculator (responsive display) → slot 1463750703
 *
 * Env overrides (optional for local generation):
 *   SEADAYS_ADSENSE_CLIENT_ID=ca-pub-…
 *   SEADAYS_ADSENSE_ARTICLE_MID_SLOT=…
 *   SEADAYS_ADSENSE_CO2_SLOT=…
 */

const ADSENSE_CLIENT_ID = String(
  process.env.SEADAYS_ADSENSE_CLIENT_ID || 'ca-pub-3084834499411817'
).trim();
const ADSENSE_ARTICLE_MID_SLOT = String(
  process.env.SEADAYS_ADSENSE_ARTICLE_MID_SLOT || '4330928521'
).trim();
const ADSENSE_CO2_SLOT = String(
  process.env.SEADAYS_ADSENSE_CO2_SLOT || '1463750703'
).trim();

/** Google certified ads.txt seller ID for Google AdSense/AdX. */
const GOOGLE_ADS_TXT_CERT_AUTHORITY_ID = 'f08c47fec0942fa0';

function isAdSenseConfigured() {
  return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT_ID) && /^\d{5,}$/.test(ADSENSE_ARTICLE_MID_SLOT);
}

function isCo2AdSenseConfigured() {
  return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT_ID) && /^\d{5,}$/.test(ADSENSE_CO2_SLOT);
}

function getPublisherIdForAdsTxt() {
  if (!ADSENSE_CLIENT_ID.startsWith('ca-pub-')) return '';
  return `pub-${ADSENSE_CLIENT_ID.slice('ca-pub-'.length)}`;
}

/**
 * @returns {string|null} Single ads.txt line, or null when not configured.
 */
function getAdsTxtLine() {
  if (!isAdSenseConfigured()) return null;
  const pub = getPublisherIdForAdsTxt();
  if (!pub) return null;
  return `google.com, ${pub}, DIRECT, ${GOOGLE_ADS_TXT_CERT_AUTHORITY_ID}`;
}

/**
 * Full ads.txt file body when configured.
 * @returns {string|null}
 */
function getAdsTxtFileContents() {
  const line = getAdsTxtLine();
  if (!line) return null;
  return `${line}\n`;
}

module.exports = {
  ADSENSE_CLIENT_ID,
  ADSENSE_ARTICLE_MID_SLOT,
  ADSENSE_CO2_SLOT,
  GOOGLE_ADS_TXT_CERT_AUTHORITY_ID,
  isAdSenseConfigured,
  isCo2AdSenseConfigured,
  getPublisherIdForAdsTxt,
  getAdsTxtLine,
  getAdsTxtFileContents,
};

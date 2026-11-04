'use strict';

const { replaceRobotsMeta } = require('./adsenseIndexability');

const BOOKABLE_SECTION_RE =
  /<section class="pg-section pg-booking" id="bookable-experiences"[\s\S]*?<\/section>/i;
const ROBOTS_RE = /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i;
const CANONICAL_RE = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i;

function extractRobotsContent(html) {
  const m = String(html || '').match(ROBOTS_RE);
  return m ? m[1].trim() : '';
}

function extractBookableExperiencesSection(html) {
  const m = String(html || '').match(BOOKABLE_SECTION_RE);
  return m ? m[0] : '';
}

function extractCanonicalHref(html) {
  const m = String(html || '').match(CANONICAL_RE);
  return m ? m[1].trim() : '';
}

function replaceBookableExperiencesSection(html, sectionHtml) {
  if (!sectionHtml || !BOOKABLE_SECTION_RE.test(html)) return html;
  return html.replace(BOOKABLE_SECTION_RE, sectionHtml);
}

function sectionHasViatorAffiliate(sectionHtml) {
  return /viator\.com/i.test(String(sectionHtml || ''));
}

/**
 * Guard against local / misconfigured regen regressions — not a permanent content freeze.
 * - Robots: block accidental noindex → index from indexability heuristics alone.
 * - Bookable: keep existing Viator block only when regen would drop affiliate and config has no URL.
 * When affiliate.url is present (CI secrets), generated bookable output is kept.
 */
function mergePublishedPortHtmlPreservation(generatedHtml, existingHtml, opts = {}) {
  if (!existingHtml) return generatedHtml;
  let html = generatedHtml;
  const existingRobots = extractRobotsContent(existingHtml);
  const generatedRobots = extractRobotsContent(generatedHtml);
  if (
    existingRobots &&
    /noindex/i.test(existingRobots) &&
    /index,\s*follow/i.test(generatedRobots)
  ) {
    html = replaceRobotsMeta(html, existingRobots);
  }
  const existingBook = extractBookableExperiencesSection(existingHtml);
  const generatedBook = extractBookableExperiencesSection(generatedHtml);
  const affiliateHasUrl = Boolean(opts.affiliate && opts.affiliate.url);
  if (
    existingBook &&
    sectionHasViatorAffiliate(existingBook) &&
    !sectionHasViatorAffiliate(generatedBook) &&
    !affiliateHasUrl
  ) {
    html = replaceBookableExperiencesSection(html, existingBook);
  }
  return html;
}

module.exports = {
  BOOKABLE_SECTION_RE,
  extractRobotsContent,
  extractBookableExperiencesSection,
  extractCanonicalHref,
  mergePublishedPortHtmlPreservation,
  replaceBookableExperiencesSection,
  sectionHasViatorAffiliate,
};

'use strict';

const { replaceRobotsMeta } = require('./adsenseIndexability');

const BOOKABLE_SECTION_RE =
  /<section class="pg-section pg-booking" id="bookable-experiences"[\s\S]*?<\/section>/i;
const CANONICAL_RE = /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']\s*\/?>/i;
const ROBOTS_RE = /<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i;

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

function replaceCanonicalHref(html, href) {
  if (!href) return html;
  if (CANONICAL_RE.test(html)) {
    return html.replace(
      CANONICAL_RE,
      `<link rel="canonical" href="${href.replace(/"/g, '&quot;')}">`
    );
  }
  return html;
}

function replaceBookableExperiencesSection(html, sectionHtml) {
  if (!sectionHtml || !BOOKABLE_SECTION_RE.test(html)) return html;
  return html.replace(BOOKABLE_SECTION_RE, sectionHtml);
}

/**
 * Keep published robots, canonical, and bookable-experiences from the on-disk page
 * when regenerating port HTML (avoids viator env / indexability drift).
 */
function mergePublishedPortHtmlPreservation(generatedHtml, existingHtml) {
  if (!existingHtml) return generatedHtml;
  let html = generatedHtml;
  const robots = extractRobotsContent(existingHtml);
  if (robots) html = replaceRobotsMeta(html, robots);
  const canonical = extractCanonicalHref(existingHtml);
  html = replaceCanonicalHref(html, canonical);
  const bookable = extractBookableExperiencesSection(existingHtml);
  if (bookable) html = replaceBookableExperiencesSection(html, bookable);
  return html;
}

module.exports = {
  BOOKABLE_SECTION_RE,
  extractRobotsContent,
  extractBookableExperiencesSection,
  extractCanonicalHref,
  mergePublishedPortHtmlPreservation,
  replaceBookableExperiencesSection,
};

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

const SITE_SHELL_STYLESHEET_LINK_RE =
  /<link\s+rel=["']stylesheet["']\s+href=["']\/assets\/css\/site-shell\.css["']\s*>\s*/i;

const HEADER_SHELL_RE =
  /<!--\s*seadays-site-shell:header\s*-->[\s\S]*?<!--\s*seadays-site-shell:header-end\s+seadays-site-shell\s*-->/i;
const FOOTER_SHELL_RE =
  /<!--\s*seadays-site-shell:footer\s*-->[\s\S]*?<!--\s*seadays-site-shell:footer-end\s+seadays-site-shell\s*-->/i;
const MORE_READING_RE = /<section class="seo-cross-block" id="more-reading"[\s\S]*?<\/section>/i;
const CONTEXTUAL_CTA_RE = /<p class="seo-inline-more seadays-contextual-cta"[\s\S]*?<\/p>/i;

/** Starfield init + optional directory runtime guard (signed-URL hygiene) before `</body>`. */
const TAIL_FROM_STARFIELD_SCRIPT_RE =
  /<\/div>\s*<script>\(function\(\)\{var sf=document\.getElementById\('starfield'\)[\s\S]*?<\/html>/i;

function extractFirstMatch(html, re) {
  const m = String(html || '').match(re);
  return m ? m[0] : '';
}

function replaceFirstMatch(html, re, replacement) {
  if (!replacement) return html;
  const s = String(html || '');
  if (!re.test(s)) return s;
  return s.replace(re, replacement);
}

/** Inline `<style>` bundle after site-shell.css on port/ship detail pages (large on main). */
function extractSiteShellHeadStyleBlock(html) {
  const s = String(html || '');
  const m = s.match(new RegExp(`${SITE_SHELL_STYLESHEET_LINK_RE.source}<style>[\\s\\S]*?<\\/style>`, 'i'));
  return m ? m[0] : '';
}

function replaceSiteShellHeadStyleBlock(html, replacementBlock) {
  if (!replacementBlock) return html;
  const pattern = new RegExp(
    `${SITE_SHELL_STYLESHEET_LINK_RE.source}<style>[\\s\\S]*?<\\/style>`,
    'i'
  );
  if (!pattern.test(html)) return html;
  return String(html || '').replace(pattern, replacementBlock);
}

/**
 * Guard against local / misconfigured regen regressions — not a permanent content freeze.
 * - Robots: block accidental noindex → index from indexability heuristics alone.
 * - Bookable: keep existing Viator block only when regen would drop affiliate and config has no URL.
 * When affiliate.url is present (CI secrets), generated bookable output is kept.
 * - Head styles: keep committed inline `<style>` after `/assets/css/site-shell.css` when regen uses minimal INDEX_STYLES.
 * - Site shell: keep committed header/footer HTML between `seadays-site-shell` markers when generator ships a newer shell.
 * - More reading: keep committed `#more-reading` cards so local blog picks do not churn vs production.
 * - Contextual CTA: keep committed `seo-inline-more seadays-contextual-cta` before the footer marker.
 * - Body tail: keep scripts after the starfield bootstrap (`directoryRuntimeImageGuard`) when generator omits them.
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
  const existingHeadStyles = extractSiteShellHeadStyleBlock(existingHtml);
  const generatedHeadStyles = extractSiteShellHeadStyleBlock(generatedHtml);
  const hasCallPlanCardCss = (block) => /\.pg-call-plan-card\s*\{/.test(String(block || ''));
  const hasMobileOverflowPatch = (block) =>
    /port-guide-mobile-overflow-v1/.test(String(block || ''));
  const shouldPreferGeneratedHeadStyles =
    (hasCallPlanCardCss(generatedHeadStyles) && !hasCallPlanCardCss(existingHeadStyles)) ||
    (hasMobileOverflowPatch(generatedHeadStyles) && !hasMobileOverflowPatch(existingHeadStyles));
  if (existingHeadStyles && !shouldPreferGeneratedHeadStyles) {
    html = replaceSiteShellHeadStyleBlock(html, existingHeadStyles);
  }

  const existingHeader = extractFirstMatch(existingHtml, HEADER_SHELL_RE);
  if (existingHeader) html = replaceFirstMatch(html, HEADER_SHELL_RE, existingHeader);
  const existingFooter = extractFirstMatch(existingHtml, FOOTER_SHELL_RE);
  if (existingFooter) html = replaceFirstMatch(html, FOOTER_SHELL_RE, existingFooter);
  const existingMore = extractFirstMatch(existingHtml, MORE_READING_RE);
  if (existingMore) html = replaceFirstMatch(html, MORE_READING_RE, existingMore);

  const existingCta = extractFirstMatch(existingHtml, CONTEXTUAL_CTA_RE);
  html = String(html).replace(CONTEXTUAL_CTA_RE, '');
  if (existingCta && /<!--\s*seadays-site-shell:footer\s*-->/i.test(html)) {
    html = html.replace(/(<!--\s*seadays-site-shell:footer\s*-->)/i, `${existingCta}\n$1`);
  }

  const existingTail = extractFirstMatch(existingHtml, TAIL_FROM_STARFIELD_SCRIPT_RE);
  if (existingTail && TAIL_FROM_STARFIELD_SCRIPT_RE.test(html)) {
    html = html.replace(TAIL_FROM_STARFIELD_SCRIPT_RE, existingTail);
  }
  return html;
}

module.exports = {
  BOOKABLE_SECTION_RE,
  extractRobotsContent,
  extractBookableExperiencesSection,
  extractCanonicalHref,
  HEADER_SHELL_RE,
  FOOTER_SHELL_RE,
  MORE_READING_RE,
  CONTEXTUAL_CTA_RE,
  TAIL_FROM_STARFIELD_SCRIPT_RE,
  extractFirstMatch,
  extractSiteShellHeadStyleBlock,
  replaceSiteShellHeadStyleBlock,
  mergePublishedPortHtmlPreservation,
  replaceBookableExperiencesSection,
  sectionHasViatorAffiliate,
};

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
const THINGS_TO_DO_SECTION_RE = /<section class="pg-section" id="things-to-do"[\s\S]*?<\/section>/i;
const GETTING_THERE_SECTION_RE = /<section class="pg-section" id="getting-there"[\s\S]*?<\/section>/i;
const TRAVELER_QUESTIONS_SECTION_RE = /<section class="pg-section" id="traveler-questions"[\s\S]*?<\/section>/i;
const QUICK_FACTS_SECTION_RE = /<section class="pg-section" id="quick-facts"[\s\S]*?<\/section>/i;
const LEAD_GUIDE_RE = /<p class="pg-prose pg-lead-guide">[\s\S]*?<\/p>/i;
const FAQ_JSON_LD_RE =
  /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>/i;

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

function countCallPlanArticleCards(html) {
  return (String(html || '').match(/<article class="pg-call-plan-card/g) || []).length;
}

function passengerEditorialBodyScore(html) {
  const s = String(html || '');
  let score = countCallPlanArticleCards(s) * 20;
  if (/<section[^>]*id="getting-there"[\s\S]*?<dl class="pg-facts">/.test(s)) score += 15;
  if (/<section[^>]*id="traveler-questions"[\s\S]*?pg-qa-grid/.test(s)) score += 10;
  if (/pg-lead-guide/.test(s)) score += 5;
  if (/FAQPage/.test(s)) score += 5;
  if (/pg-top-things-list/.test(s)) score += 5;
  return score;
}

/**
 * When catalogue regen emits stub prose but disk already has passenger editorial
 * blocks, keep the richer on-disk body (guide JSON is source of truth).
 */
function mergePassengerEditorialBodyPreservation(generatedHtml, existingHtml, portGuide) {
  if (!existingHtml || !portGuide) return generatedHtml;
  const { usesPassengerEditorialLead } = require('./publicGuideCopySanitize');
  if (!usesPassengerEditorialLead(portGuide)) return generatedHtml;
  if (passengerEditorialBodyScore(existingHtml) <= passengerEditorialBodyScore(generatedHtml)) {
    return generatedHtml;
  }
  let html = generatedHtml;
  for (const [re, existingBlock] of [
    [THINGS_TO_DO_SECTION_RE, extractFirstMatch(existingHtml, THINGS_TO_DO_SECTION_RE)],
    [GETTING_THERE_SECTION_RE, extractFirstMatch(existingHtml, GETTING_THERE_SECTION_RE)],
    [TRAVELER_QUESTIONS_SECTION_RE, extractFirstMatch(existingHtml, TRAVELER_QUESTIONS_SECTION_RE)],
    [QUICK_FACTS_SECTION_RE, extractFirstMatch(existingHtml, QUICK_FACTS_SECTION_RE)],
  ]) {
    if (existingBlock) html = replaceFirstMatch(html, re, existingBlock);
  }
  const lead = extractFirstMatch(existingHtml, LEAD_GUIDE_RE);
  if (lead && !LEAD_GUIDE_RE.test(html)) {
    html = html.replace(/(<nav class="port-jump"[\s\S]*?<\/nav>)/, `$1\n${lead}`);
  }
  const faqJsonLd = extractFirstMatch(existingHtml, FAQ_JSON_LD_RE);
  if (faqJsonLd && !FAQ_JSON_LD_RE.test(html)) {
    html = html.replace(
      /(<script type="application\/ld\+json">[\s\S]*?BreadcrumbList[\s\S]*?<\/script>)/,
      `$1\n  ${faqJsonLd}`
    );
  }
  const existingDestinationLd = existingHtml.match(
    /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"TouristDestination"[\s\S]*?<\/script>/
  );
  const generatedDestinationLd = html.match(
    /<script type="application\/ld\+json">\s*\{[\s\S]*?"@type"\s*:\s*"TouristDestination"[\s\S]*?<\/script>/
  );
  if (existingDestinationLd && generatedDestinationLd) {
    const existingDesc = /"description":"[^"]{20,}/.test(existingDestinationLd[0]);
    const generatedDesc = /"description":"[^"]{20,}/.test(generatedDestinationLd[0]);
    if (existingDesc && !generatedDesc) {
      html = html.replace(generatedDestinationLd[0], existingDestinationLd[0]);
    }
  }
  return html;
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
  html = mergePassengerEditorialBodyPreservation(html, existingHtml, opts.portGuide);
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
  mergePassengerEditorialBodyPreservation,
  countCallPlanArticleCards,
  passengerEditorialBodyScore,
  replaceBookableExperiencesSection,
  sectionHasViatorAffiliate,
};

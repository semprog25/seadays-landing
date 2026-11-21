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
const CONTEXTUAL_CTA_SECTION_RE = /<section class="seadays-contextual-cta"[^>]*>[\s\S]*?<\/section>/i;
const THINGS_TO_DO_SECTION_RE = /<section class="pg-section" id="things-to-do"[\s\S]*?<\/section>/i;
const GETTING_THERE_SECTION_RE = /<section class="pg-section" id="getting-there"[\s\S]*?<\/section>/i;
const TRAVELER_QUESTIONS_SECTION_RE = /<section class="pg-section" id="traveler-questions"[\s\S]*?<\/section>/i;
const QUICK_FACTS_SECTION_RE = /<section class="pg-section" id="quick-facts"[\s\S]*?<\/section>/i;
const LEAD_GUIDE_RE = /<p class="pg-prose pg-lead-guide">[\s\S]*?<\/p>/i;
const HEAD_BLOCK_RE = /<head\b[^>]*>[\s\S]*?<\/head>/i;
const PORT_DETAIL_JSON_LD_DEDUPE_TYPES = ['TouristDestination', 'BreadcrumbList', 'FAQPage'];
const JSON_LD_SCRIPT_TAG_RE =
  /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;

/** Starfield init + optional directory runtime guard (signed-URL hygiene) before `</body>`. */
const TAIL_FROM_STARFIELD_SCRIPT_RE =
  /<\/div>\s*<script>\(function\(\)\{var sf=document\.getElementById\('starfield'\)[\s\S]*?<\/html>/i;

function extractFirstMatch(html, re) {
  const m = String(html || '').match(re);
  return m ? m[0] : '';
}

function parseJsonLdScriptInner(inner) {
  try {
    const data = JSON.parse(String(inner || '').trim());
    if (!data || typeof data !== 'object') return null;
    return data;
  } catch {
    return null;
  }
}

/** One `<script type="application/ld+json">` whose parsed `@type` matches (never spans multiple tags). */
function extractJsonLdScriptTagByType(html, schemaType) {
  const scope = String(html || '');
  if (!schemaType) return '';
  JSON_LD_SCRIPT_TAG_RE.lastIndex = 0;
  let match;
  while ((match = JSON_LD_SCRIPT_TAG_RE.exec(scope))) {
    const data = parseJsonLdScriptInner(match[1]);
    if (data && data['@type'] === schemaType) {
      return match[0];
    }
  }
  return '';
}

function headHasJsonLdType(html, schemaType) {
  const head = extractFirstMatch(html, HEAD_BLOCK_RE);
  if (!head) return false;
  return Boolean(extractJsonLdScriptTagByType(head, schemaType));
}

/**
 * Catalogue regen must not accumulate duplicate TouristDestination / BreadcrumbList / FAQPage in `<head>`.
 */
const HEAD_INLINE_STYLE_BLOCK_RE = /<style>[\s\S]*?<\/style>/i;
const HEAD_STYLE_DEDUPE_PLACEHOLDER = '<!--SEADAYS_HEAD_STYLE_DEDUPE_GUARD-->';

function collapseHeadExcessNewlinesOutsideStyle(headHtml) {
  const head = String(headHtml || '');
  const styleMatch = head.match(HEAD_INLINE_STYLE_BLOCK_RE);
  if (!styleMatch) return head.replace(/\n{3,}/g, '\n\n');
  const styleBlock = styleMatch[0];
  const withoutStyle = head.replace(HEAD_INLINE_STYLE_BLOCK_RE, HEAD_STYLE_DEDUPE_PLACEHOLDER);
  const collapsed = withoutStyle.replace(/\n{3,}/g, '\n\n');
  return collapsed.replace(HEAD_STYLE_DEDUPE_PLACEHOLDER, styleBlock);
}

function dedupePortDetailHeadJsonLd(html) {
  const s = String(html || '');
  const headMatch = s.match(HEAD_BLOCK_RE);
  if (!headMatch) return s;
  const head = headMatch[0];
  const seen = new Set();
  const withoutDupes = head.replace(JSON_LD_SCRIPT_TAG_RE, (full, inner) => {
    const data = parseJsonLdScriptInner(inner);
    const type = data && data['@type'];
    if (!type || !PORT_DETAIL_JSON_LD_DEDUPE_TYPES.includes(type)) {
      return full;
    }
    if (seen.has(type)) return '';
    seen.add(type);
    return full;
  });
  return s.replace(head, collapseHeadExcessNewlinesOutsideStyle(withoutDupes));
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
function shouldPreservePassengerEditorialBody(generatedHtml, existingHtml, portGuide) {
  if (
    portGuide?.researchImport?.batch04_preparation_only === true ||
    portGuide?.researchImport?.batch05_preparation_only === true ||
    portGuide?.researchImport?.batch03_kirkenes_ocho_conditional_candidate === true
  ) {
    return false;
  }
  const existingCards = countCallPlanArticleCards(existingHtml);
  const generatedCards = countCallPlanArticleCards(generatedHtml);
  if (existingCards >= 3 && generatedCards < existingCards) return true;
  const { usesPassengerEditorialLead } = require('./publicGuideCopySanitize');
  if (!portGuide || !usesPassengerEditorialLead(portGuide)) return false;
  return passengerEditorialBodyScore(existingHtml) > passengerEditorialBodyScore(generatedHtml);
}

function hasTravelerFaqGrid(html) {
  return /<section[^>]*id="traveler-questions"[\s\S]*?pg-qa-grid[\s\S]*?pg-qa-card/.test(String(html || ''));
}

function decodePassengerHtmlText(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function travelerFaqCardAnswers(blockHtml) {
  const cards = [];
  const re = /<article class="pg-qa-card">[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/gi;
  let match;
  while ((match = re.exec(String(blockHtml || '')))) {
    cards.push({
      question: decodePassengerHtmlText(match[1]),
      answer: decodePassengerHtmlText(match[2]),
    });
  }
  return cards;
}

/**
 * Banner-only catalogue regen: keep committed FAQ when regen would clip answers or drop questions.
 * Normal FAQ regen (bannerOnlyFaqPreserve off) keeps generator FAQ cards + FAQPage JSON-LD as built.
 */
function shouldKeepExistingTravelerQuestions(existingBlock, generatedHtml, { bannerOnlyFaqPreserve = false } = {}) {
  if (!bannerOnlyFaqPreserve) return false;
  if (!existingBlock) return false;
  if (/<p>For St\.<\/p>/.test(existingBlock)) return false;
  const generatedBlock = extractFirstMatch(generatedHtml, TRAVELER_QUESTIONS_SECTION_RE);
  if (!generatedBlock) return false;
  if (hasTravelerFaqGrid(generatedHtml) && !hasTravelerFaqGrid(existingBlock)) return false;
  const generatedByQuestion = new Map(
    travelerFaqCardAnswers(generatedBlock).map((card) => [card.question, card.answer]),
  );
  for (const { question, answer } of travelerFaqCardAnswers(existingBlock)) {
    const generatedAnswer = generatedByQuestion.get(question);
    if (generatedAnswer === undefined) return true;
    if (answer.length > generatedAnswer.length) return true;
  }
  return false;
}

function refreshPreservedPortAnswers(html) {
  const { clipFaqAnswer } = require('./portGuideSections');
  const { sanitizePassengerRenderCopy, containsInternalResearchLeak, preparePassengerGuideText } = require('./publicGuideCopySanitize');
  const decode = (s) => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  const escape = (s) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  html = html.replace(/<(p|dd|li)\b([^>]*)>([\s\S]*?)<\/\1>/gi, (block, tagName, attributes, body) => {
    const text = decode(body.replace(/<[^>]*>/g, ' '));
    if (!containsInternalResearchLeak(text)) return block;
    const clean = preparePassengerGuideText(text);
    return clean ? `<${tagName}${attributes}>${escape(clean)}</${tagName}>` : '';
  });
  html = html.replace(/(<script\b[^>]*type=["']application\/ld\+json["'][^>]*>)([\s\S]*?)(<\/script>)/gi, (block, open, json, close) => {
    const parsed = JSON.parse(json);
    const clean = sanitizePassengerRenderCopy(parsed);
    return JSON.stringify(parsed) === JSON.stringify(clean) ? block : open + JSON.stringify(clean).replace(/</g, '\\u003c') + close;
  });
  let faq;
  const tag = extractJsonLdScriptTagByType(html, 'FAQPage');
  if (tag) faq = JSON.parse(tag.replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/, ''));
  const retainedQuestions = new Set();
  html = html.replace(/<article class="pg-qa-card">([\s\S]*?)<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>\s*<\/article>/g, (card, before, question, answer) => {
    const full = faq?.mainEntity?.find((item) => item.name === decode(question))?.acceptedAnswer?.text;
    const clipped = clipFaqAnswer(full || decode(answer));
    if (!clipped) return '';
    retainedQuestions.add(decode(question));
    return `<article class="pg-qa-card">${before}<h3>${question}</h3><p>${escape(clipped)}</p></article>`;
  });
  if (faq) {
    faq.mainEntity = faq.mainEntity
      .filter((item) => retainedQuestions.has(item.name))
      .map((item) => ({
        ...item,
        acceptedAnswer: { ...item.acceptedAnswer, text: clipFaqAnswer(item.acceptedAnswer.text) },
      }));
    html = html.replace(
      tag,
      faq.mainEntity.length
        ? `<script type="application/ld+json">${JSON.stringify(sanitizePassengerRenderCopy(faq)).replace(/</g, '\\u003c')}</script>`
        : ''
    );
  }
  html = html.replace(TRAVELER_QUESTIONS_SECTION_RE, (section) =>
    /<article class="pg-qa-card">/.test(section) ? section : ''
  );
  const row = (label) => new RegExp(`<div class="pg-fact"><dt>${label}</dt><dd>([\\s\\S]*?)</dd></div>`);
  const distance = row('Distance to city').exec(html);
  const transport = row('Public transport').exec(html);
  const norm = (s) => decode(s).replace(/<[^>]*>/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  if (distance && transport) {
    const d = norm(distance[1]);
    const t = norm(transport[1]);
    if (d && t && (d.includes(t) || t.includes(d))) {
      if (t.length > d.length) html = html.replace(distance[0], distance[0].replace(distance[1], transport[1]));
      html = html.replace(transport[0], '');
    }
  }
  return html;
}

function mergePassengerEditorialBodyPreservation(generatedHtml, existingHtml, portGuide, mergeOpts = {}) {
  if (!existingHtml) return generatedHtml;
  let html = generatedHtml;
  const preserveAll = shouldPreservePassengerEditorialBody(generatedHtml, existingHtml, portGuide);
  const keepTravelerFaq = (block) => shouldKeepExistingTravelerQuestions(block, generatedHtml, mergeOpts);
  if (preserveAll) {
    for (const [re, existingBlock, keepExisting] of [
      [THINGS_TO_DO_SECTION_RE, extractFirstMatch(existingHtml, THINGS_TO_DO_SECTION_RE), () => true],
      [GETTING_THERE_SECTION_RE, extractFirstMatch(existingHtml, GETTING_THERE_SECTION_RE), () => true],
      [
        TRAVELER_QUESTIONS_SECTION_RE,
        extractFirstMatch(existingHtml, TRAVELER_QUESTIONS_SECTION_RE),
        keepTravelerFaq,
      ],
      [QUICK_FACTS_SECTION_RE, extractFirstMatch(existingHtml, QUICK_FACTS_SECTION_RE), () => true],
    ]) {
      if (existingBlock && keepExisting(existingBlock)) {
        html = replaceFirstMatch(html, re, existingBlock);
      }
    }
    const lead = extractFirstMatch(existingHtml, LEAD_GUIDE_RE);
    if (lead && !LEAD_GUIDE_RE.test(html)) {
      html = html.replace(/(<nav class="port-jump"[\s\S]*?<\/nav>)/, `$1\n${lead}`);
    }
    const faqJsonLd = extractJsonLdScriptTagByType(existingHtml, 'FAQPage');
    if (faqJsonLd && !headHasJsonLdType(html, 'FAQPage')) {
      const breadcrumbJsonLd = extractJsonLdScriptTagByType(html, 'BreadcrumbList');
      const anchor = breadcrumbJsonLd || extractJsonLdScriptTagByType(html, 'TouristDestination');
      if (anchor) {
        html = html.replace(anchor, `${anchor}\n  ${faqJsonLd}`);
      }
    }
    const existingDestinationLd = extractJsonLdScriptTagByType(existingHtml, 'TouristDestination');
    const generatedDestinationLd = extractJsonLdScriptTagByType(html, 'TouristDestination');
    if (existingDestinationLd && generatedDestinationLd) {
      const existingDesc = /"description":"[^"]{20,}/.test(existingDestinationLd);
      const generatedDesc = /"description":"[^"]{20,}/.test(generatedDestinationLd);
      if (existingDesc && !generatedDesc) {
        html = html.replace(generatedDestinationLd, existingDestinationLd);
      }
    }
  } else {
    const existingTraveler = extractFirstMatch(existingHtml, TRAVELER_QUESTIONS_SECTION_RE);
    if (existingTraveler && keepTravelerFaq(existingTraveler)) {
      html = replaceFirstMatch(html, TRAVELER_QUESTIONS_SECTION_RE, existingTraveler);
    }
  }
  return dedupePortDetailHeadJsonLd(html);
}

/**
 * Guard against local / misconfigured regen regressions — not a permanent content freeze.
 * - Robots: block accidental noindex → index from indexability heuristics alone.
 * - Bookable: keep existing Viator block only when regen would drop affiliate and config has no URL.
 * When affiliate.url is present (CI secrets), generated bookable output is kept.
 * - Head styles: keep committed inline `<style>` after `/assets/css/site-shell.css` when regen uses minimal INDEX_STYLES.
 * - Site shell: keep committed header/footer HTML between `seadays-site-shell` markers when generator ships a newer shell.
 * - More reading: keep committed `#more-reading` cards so local blog picks do not churn vs production.
 * - Contextual CTA: strip retired port guide blocks; do not re-insert duplicate CTAs.
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

  // Port pages retain header, reviews, and footer links without an extra contextual CTA.
  html = String(html)
    .replace(new RegExp(CONTEXTUAL_CTA_RE.source, 'gi'), '')
    .replace(new RegExp(CONTEXTUAL_CTA_SECTION_RE.source, 'gi'), '');

  const existingTail = extractFirstMatch(existingHtml, TAIL_FROM_STARFIELD_SCRIPT_RE);
  if (existingTail && TAIL_FROM_STARFIELD_SCRIPT_RE.test(html)) {
    html = html.replace(TAIL_FROM_STARFIELD_SCRIPT_RE, existingTail);
  }
  const bannerOnlyFaqPreserve = Boolean(opts.bannerOnlyFaqPreserve);
  html = mergePassengerEditorialBodyPreservation(html, existingHtml, opts.portGuide, opts);
  const existingTraveler = extractFirstMatch(existingHtml, TRAVELER_QUESTIONS_SECTION_RE);
  const mergedTraveler = extractFirstMatch(html, TRAVELER_QUESTIONS_SECTION_RE);
  const keptCommittedTravelerFaq =
    Boolean(existingTraveler) && existingTraveler === mergedTraveler;
  const preserveEditorialBody = shouldPreservePassengerEditorialBody(
    generatedHtml,
    existingHtml,
    opts.portGuide,
  );
  if (bannerOnlyFaqPreserve && (keptCommittedTravelerFaq || preserveEditorialBody)) {
    const existingFaqJsonLd = extractJsonLdScriptTagByType(existingHtml, 'FAQPage');
    const generatedFaqJsonLd = extractJsonLdScriptTagByType(html, 'FAQPage');
    if (existingFaqJsonLd && generatedFaqJsonLd && existingFaqJsonLd !== generatedFaqJsonLd) {
      html = html.replace(generatedFaqJsonLd, existingFaqJsonLd);
    }
    html = alignMainCloseIndentToExisting(html, existingHtml);
    return dedupePortDetailHeadJsonLd(html);
  }
  html = alignMainCloseIndentToExisting(html, existingHtml);
  return dedupePortDetailHeadJsonLd(html);
}

function alignMainCloseIndentToExisting(html, existingHtml) {
  const existing = String(existingHtml || '').match(/\n([ \t]*)<\/main>/);
  if (!existing) return html;
  const prefix = existing[1];
  return String(html || '').replace(/\n[ \t]*<\/main>/, `\n${prefix}</main>`);
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
  CONTEXTUAL_CTA_SECTION_RE,
  TAIL_FROM_STARFIELD_SCRIPT_RE,
  extractFirstMatch,
  extractSiteShellHeadStyleBlock,
  replaceSiteShellHeadStyleBlock,
  mergePublishedPortHtmlPreservation,
  mergePassengerEditorialBodyPreservation,
  shouldPreservePassengerEditorialBody,
  refreshPreservedPortAnswers,
  dedupePortDetailHeadJsonLd,
  extractJsonLdScriptTagByType,
  headHasJsonLdType,
  countCallPlanArticleCards,
  passengerEditorialBodyScore,
  replaceBookableExperiencesSection,
  sectionHasViatorAffiliate,
};

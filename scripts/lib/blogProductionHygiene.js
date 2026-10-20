'use strict';

/**
 * SD-25 / SD-26: strip leaked production copy and repair common markdown defects
 * before blog HTML is written or patched on disk.
 */

/** @type {RegExp[]} Visible-text patterns that must never ship (SD-25 done-when). */
const LEAKED_EDITORIAL_PATTERNS = [
  /\bBatch\s+\d+\b/i,
  /\bB\d{2}-\d+\b/i,
  /\bprimary keyword\b/i,
  /\bcore keyword\b/i,
  /\bfor the keyword\b/i,
  /\byour keyword is\b/i,
  /\bEarly clarity for the keyword\b/i,
  /\bIn the first hundred words,\s*the core keyword\b/i,
  /\bIf your primary keyword\b/i,
  /\bPair with Batch\b/i,
  /\bRead Batch\b/i,
  /\bPair this article with Batch\b/i,
  /\bread\s+Batch\s+\d+/i,
  /\bPair\s+with\s+Batch\b/i,
];

const LEAKED_EDITORIAL_TEST_RE = new RegExp(
  LEAKED_EDITORIAL_PATTERNS.map((r) => r.source).join('|'),
  'i'
);

function splitSentences(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+(?=[A-Z"“‘(])/g)
    .map((s) => s.trim())
    .filter(Boolean);
}

function sentenceHasLeak(sentence) {
  return LEAKED_EDITORIAL_PATTERNS.some((re) => re.test(sentence));
}

/**
 * Drop sentences that contain internal SEO / batch instructions.
 * @param {string} input
 * @returns {string}
 */
function stripLeakedProductionNotes(input) {
  const text = String(input || '');
  if (!LEAKED_EDITORIAL_TEST_RE.test(text)) return text;
  const parts = splitSentences(text);
  if (parts.length <= 1) {
    if (sentenceHasLeak(text)) return '';
    return text;
  }
  const kept = parts.filter((p) => !sentenceHasLeak(p));
  return kept.join(' ').replace(/\s{2,}/g, ' ').trim();
}

/**
 * @param {string} input
 * @returns {string}
 */
function applyTypoFixes(input) {
  return String(input || '')
    .replace(/\bCrusies\b/g, 'Cruises')
    .replace(/\bcvs Celebrity\b/g, 'Norwegian Prima vs Celebrity')
    .replace(/\bcvs celebrity\b/gi, 'Norwegian Prima vs Celebrity');
}

/**
 * Markdown links and orphan ** in plain text (before or after HTML).
 * @param {string} input
 * @returns {string}
 */
function repairResidualMarkdown(input) {
  let s = String(input || '');
  s = s.replace(/\[([^\]]+)\]\((\/[^)]+)\)/g, '<a href="$2">$1</a>');
  s = s.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi, '<a href="$2">$1</a>');
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/\*\*/g, '');
  s = s.replace(
    /\bhttps:\/\/seadays\.app\/(blog|ports)\/\b/g,
    (m, section) => `the SeaDays ${section} section`
  );
  return s;
}

/**
 * @param {string} text
 * @returns {string}
 */
function scrubInlineProductionClauses(text) {
  return String(text || '')
    .replace(/\s*[—–-]\s*read\s+Batch\s+\d+[^.!?]*/gi, '')
    .replace(/\s*Pair\s+with\s+Batch\s+\d+[^.!?]*/gi, '')
    .replace(/\s*Read\s+Batch\s+\d+[^.!?]*/gi, '')
    .replace(/\s*Pair\s+this\s+article\s+with\s+Batch\s+\d+[^.!?]*/gi, '');
}

/** Remove batch cross-ref clauses when "read" / "Batch" / digits are split by inline tags. */
function scrubBatchClausesInHtml(inner) {
  let s = String(inner || '');
  s = s.replace(
    /\s*[—–-]\s*read(?:<[^>]+>|\s)*Batch(?:<[^>]+>|\s)*\d+[^<.]*/gi,
    ''
  );
  s = s.replace(/\s*Pair(?:<[^>]+>|\s)*with(?:<[^>]+>|\s)*Batch(?:<[^>]+>|\s)*\d+[^<.]*/gi, '');
  s = s.replace(/\s*Read(?:<[^>]+>|\s)*Batch(?:<[^>]+>|\s)*\d+[^<.]*/gi, '');
  return s;
}

function applyBlogProductionHygieneToText(text) {
  let out = scrubInlineProductionClauses(text);
  out = stripLeakedProductionNotes(out);
  out = applyTypoFixes(out);
  out = repairResidualMarkdown(out);
  return out;
}

/**
 * Hygiene on article body HTML: text nodes only; preserves tags.
 * @param {string} html
 * @returns {string}
 */
const PROSE_INLINE_TAG_RE = /<(p|li|td|th|blockquote)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

const ARTICLE_BODY_OPEN = '<div class="article-body">';

/**
 * Extract inner HTML of the page-level article body (handles nested divs and intro CTAs).
 * @param {string} pageHtml
 * @returns {{ body: string, innerStart: number, innerEnd: number } | null}
 */
function extractArticleBodyFromPage(pageHtml) {
  const html = String(pageHtml || '');
  const openIndex = html.indexOf(ARTICLE_BODY_OPEN);
  if (openIndex === -1) return null;
  const innerStart = openIndex + ARTICLE_BODY_OPEN.length;
  let depth = 1;
  let i = innerStart;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose === -1) return null;
    if (nextOpen !== -1 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return { body: html.slice(innerStart, nextClose), innerStart, innerEnd: nextClose };
    }
    i = nextClose + 6;
  }
  return null;
}

/**
 * @param {string} pageHtml
 * @param {string} newBodyInner
 * @returns {string}
 */
function replaceArticleBodyInPage(pageHtml, newBodyInner) {
  const slot = extractArticleBodyFromPage(pageHtml);
  if (!slot) return pageHtml;
  return `${pageHtml.slice(0, slot.innerStart)}${newBodyInner}${pageHtml.slice(slot.innerEnd)}`;
}

/**
 * SD-07: inline bold density in article prose (not headings).
 * @param {string} html Article body fragment (inside .article-body)
 * @returns {{ words: number, strong: number, per100: number }}
 */
function measureInlineBoldDensity(html) {
  const text = String(html || '');
  const words = text
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  const strong = (text.match(/<strong\b/gi) || []).length;
  const per100 = words ? (strong / words) * 100 : 0;
  return { words, strong, per100 };
}

function unwrapSingleWordStrongTags(html) {
  return String(html || '').replace(/<strong\b[^>]*>([^<]*)<\/strong>/gi, (match, inner) => {
    const trimmed = inner.trim();
    if (!trimmed || /\s/.test(trimmed)) return match;
    return trimmed;
  });
}

function unwrapAllStrongTags(html) {
  return String(html || '').replace(/<strong\b[^>]*>([\s\S]*?)<\/strong>/gi, '$1');
}

function mapProseBlocks(html, mapInner) {
  return String(html || '').replace(PROSE_INLINE_TAG_RE, (full, tag, attrs, inner) => {
    const next = mapInner(inner);
    if (next === inner) return full;
    return `<${tag}${attrs}>${next}</${tag}>`;
  });
}

/**
 * Remove word-by-word and keyword-stuffed bold while keeping sparse legitimate emphasis.
 * @param {string} html Article body fragment
 * @returns {string}
 */
function reduceExcessiveInlineBold(html) {
  if (measureInlineBoldDensity(html).per100 <= 3) return String(html || '');
  let out = mapProseBlocks(html, unwrapSingleWordStrongTags);
  if (measureInlineBoldDensity(out).per100 <= 3) return out;
  return mapProseBlocks(out, unwrapAllStrongTags);
}

function applyBlogProductionHygieneToHtml(html) {
  let out = String(html || '');
  out = out.replace(/<(p|li|h[2-4])\b([^>]*)>([\s\S]*?)<\/\1>/gi, (full, tag, attrs, inner) => {
    const hasInlineTags = /<[a-z][^>]*>/i.test(inner);
    if (!hasInlineTags) {
      const next = applyBlogProductionHygieneToText(inner);
      if (next !== inner.trim()) {
        if (!next) return '';
        return `<${tag}${attrs}>${next}</${tag}>`;
      }
      return full;
    }
    let next = scrubBatchClausesInHtml(inner);
    if (/\[[^\]]+\]\([^)]+\)/.test(next)) next = repairResidualMarkdown(next);
    next = next.replace(/\bCrusies\b/g, 'Cruises');
    if (next !== inner) return `<${tag}${attrs}>${next}</${tag}>`;
    return full;
  });
  out = out.replace(/>([^<]+)</g, (match, text) => {
    const next = applyBlogProductionHygieneToText(text);
    if (next === text) return match;
    return `>${next}<`;
  });
  return reduceExcessiveInlineBold(out);
}

/**
 * @param {string} html Full blog article page
 * @returns {string}
 */
function patchArticleHeroImageCss(html) {
  return String(html || '').replace(
    /\.article-hero-image\s*\{[^}]*\}/,
    '.article-hero-image { width: 100%; max-height: min(56vw, 400px); height: auto; aspect-ratio: 3 / 2; object-fit: cover; object-position: center; border-radius: 12px; margin-bottom: 16px; background: rgba(255, 255, 255, 0.05); }'
  );
}

module.exports = {
  LEAKED_EDITORIAL_PATTERNS,
  LEAKED_EDITORIAL_TEST_RE,
  stripLeakedProductionNotes,
  scrubInlineProductionClauses,
  applyTypoFixes,
  repairResidualMarkdown,
  applyBlogProductionHygieneToText,
  applyBlogProductionHygieneToHtml,
  patchArticleHeroImageCss,
  extractArticleBodyFromPage,
  replaceArticleBodyInPage,
  measureInlineBoldDensity,
  unwrapSingleWordStrongTags,
  unwrapAllStrongTags,
  reduceExcessiveInlineBold,
};

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
  return out.replace(/>([^<]+)</g, (match, text) => {
    const next = applyBlogProductionHygieneToText(text);
    if (next === text) return match;
    return `>${next}<`;
  });
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
};

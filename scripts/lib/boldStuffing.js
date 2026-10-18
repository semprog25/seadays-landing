'use strict';

/**
 * Remove keyword-style bold from article bodies.
 * Rule: no bold in running text; at most one short key phrase (<= 6 words)
 * at the start of a list item. Headings are left as they are.
 */

const MAX_KEY_PHRASE_WORDS = 6;

function plainText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(html) {
  const t = plainText(html);
  return t ? t.split(' ').length : 0;
}

/** Bold runs: adjacent <strong>/<b> tags separated only by whitespace count once. */
function countBoldRuns(html) {
  const merged = mergeAdjacentBold(String(html || ''));
  return (merged.match(/<(strong|b)\b[^>]*>/gi) || []).length;
}

function countBoldTags(html) {
  return (String(html || '').match(/<(strong|b)\b[^>]*>/gi) || []).length;
}

function per100(count, words) {
  return words ? Math.round((count * 1000) / words) / 10 : 0;
}

function normalizeBoldTags(html) {
  return String(html || '')
    .replace(/<b(\s[^>]*)?>/gi, '<strong>')
    .replace(/<\/b>/gi, '</strong>');
}

function mergeAdjacentBold(html) {
  let out = normalizeBoldTags(html);
  let prev;
  do {
    prev = out;
    out = out.replace(/<\/strong>(\s*)<strong>/gi, '$1');
  } while (out !== prev);
  return out;
}

function unwrapBold(html) {
  return String(html || '').replace(/<\/?strong\b[^>]*>/gi, '');
}

function destuffListItem(inner) {
  const m = inner.match(/^(\s*)<strong>([\s\S]*?)<\/strong>([\s\S]*)$/i);
  if (m) {
    const phrase = m[2];
    const words = plainText(phrase).split(' ').filter(Boolean).length;
    if (words > 0 && words <= MAX_KEY_PHRASE_WORDS) {
      return `${m[1]}<strong>${unwrapBold(phrase)}</strong>${unwrapBold(m[3])}`;
    }
  }
  return unwrapBold(inner);
}

/**
 * @param {string} bodyHtml inner HTML of .article-body
 * @returns {string}
 */
function destuffBold(bodyHtml) {
  let out = mergeAdjacentBold(bodyHtml);
  // Keep at most one key phrase at the start of each list item.
  out = out.replace(/<li\b([^>]*)>([\s\S]*?)<\/li>/gi, (_m, attrs, inner) => `<li${attrs}>\u0000${destuffListItem(inner)}\u0000</li>`);
  // Everything outside list items and headings loses its bold.
  const parts = out.split(/(<li\b[^>]*>\u0000[\s\S]*?\u0000<\/li>|<h[1-6]\b[\s\S]*?<\/h[1-6]>)/gi);
  out = parts
    .map((part) => (/^<li\b/i.test(part) || /^<h[1-6]\b/i.test(part) ? part : unwrapBold(part)))
    .join('')
    .replace(/\u0000/g, '');
  return out.replace(/<strong>\s*<\/strong>/gi, '');
}

function boldStats(bodyHtml) {
  const words = wordCount(bodyHtml);
  const runs = countBoldRuns(bodyHtml);
  const tags = countBoldTags(bodyHtml);
  return { words, tags, runs, tagsPer100: per100(tags, words), runsPer100: per100(runs, words) };
}

module.exports = {
  MAX_KEY_PHRASE_WORDS,
  destuffBold,
  boldStats,
  mergeAdjacentBold,
  plainText,
  wordCount,
};

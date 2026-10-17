'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Shared cleanup for port prose: boilerplate detection, Wikipedia citation
 * markers, dangling fact-pass sentences, and repeated place labels.
 */

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';
let wikipediaAttributionCache;

function isBoilerplateDescription(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return true;
  if (t.includes('cruise port profile in the seadays directory')) return true;
  if (/^[^.]+\s+is a cruise port in\s+[^.]+\.?$/.test(t) && t.length < 120) return true;
  if (/, [^,]+, [^,]+ is a cruise port profile/.test(t)) return true;
  return false;
}

function stripMarkersOutsideScripts(html) {
  return String(html || '').replace(
    /(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)|\[(?:\d{1,3}|[a-z])\]/g,
    (match, keep) => (keep ? keep : '')
  );
}

function wikipediaArticleUrl(title) {
  const slug = String(title || '')
    .trim()
    .replace(/ /g, '_');
  return `https://en.wikipedia.org/wiki/${encodeURI(slug).replace(/%20/g, '_')}`;
}

function stripWikiCitationMarkers(text) {
  return String(text || '')
    .replace(/mw-parser-output/gi, '')
    .replace(/ⓘ/g, '')
    .replace(/\((?:[^)]*[ˈˌəɪʊɔæɑɒʌɛɜθðŋʃʒ][^)]*)\)/g, '')
    .replace(/\/(?:[^/\s]*[ˈˌəɪʊɔæɑɒʌɛɜθðŋʃʒ][^/\s]*)\//g, '')
    .replace(/\[(?:\d{1,3}|[a-z])\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function dedupeRepeatedCommaPhrase(text) {
  let s = String(text || '');
  let prev = '';
  while (s !== prev) {
    prev = s;
    s = s.replace(/\b([^,]{2,80}), \1\b/g, '$1');
  }
  return s.replace(/\s+/g, ' ').trim();
}

const DANGLING_SENTENCE_RE = /\b(of|about|around|approximately|over|than|with|the|and|for|to)\s*[.,;]\s*$/i;

function splitSentences(text) {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function isDanglingSentence(sentence) {
  return DANGLING_SENTENCE_RE.test(String(sentence || '').trim());
}

function isCutFromLonger(sentence, longer) {
  const s = String(sentence || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.…]+$/g, '');
  const d = String(longer || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length < 30 || !d) return false;
  const idx = d.indexOf(s);
  if (idx === -1) return false;
  const after = d.slice(idx + s.length).trim();
  return after.length > 2;
}

function dropDanglingSentences(text) {
  return splitSentences(text)
    .filter((s) => !isDanglingSentence(s))
    .join(' ');
}

function cleanPortCopy(text) {
  return dropDanglingSentences(dedupeRepeatedCommaPhrase(stripWikiCitationMarkers(text)));
}

function filterHighlightList(highlights, description) {
  const desc = cleanPortCopy(description);
  return (Array.isArray(highlights) ? highlights : [])
    .map((h) => cleanPortCopy(h))
    .filter((h) => h && !isDanglingSentence(h) && !isCutFromLonger(h, desc))
    .filter(
      (h) =>
        !/is listed in the seadays ports directory/i.test(h) &&
        !/is a cruise port profile/i.test(h) &&
        !/\bis a cruise port in\b/i.test(h)
    );
}

function normalizeSentenceKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drops a repeated sentence once it is longer than 40 characters. */
function createSentenceGate() {
  const seen = new Set();
  return function filterSentences(text) {
    const kept = [];
    for (const sentence of splitSentences(text)) {
      const key = normalizeSentenceKey(sentence);
      if (!key) continue;
      if (sentence.length > 40 && seen.has(key)) continue;
      seen.add(key);
      kept.push(sentence);
    }
    return kept.join(' ');
  };
}

function loadWikipediaAttribution(repoRoot) {
  if (wikipediaAttributionCache) return wikipediaAttributionCache;
  const file = path.join(repoRoot || path.join(__dirname, '..', '..'), 'data', 'wikipedia-port-attribution.json');
  try {
    wikipediaAttributionCache = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    wikipediaAttributionCache = {};
  }
  return wikipediaAttributionCache;
}

function wikipediaAttributionHtml(entry) {
  if (!entry || !entry.title) return '';
  const article = String(entry.url || wikipediaArticleUrl(entry.title)).replace(/"/g, '%22');
  return `<p class="wiki-attribution">Parts of this description are adapted from <a href="${article}">Wikipedia</a>, licensed under <a href="${CC_BY_SA}">CC BY-SA 4.0</a>.</p>`;
}

function rewriteCdnThumbnailUrl(url) {
  const s = String(url || '').trim();
  if (!/cdn\.seadays\.app/i.test(s)) return s;
  let pathPart = s.replace(/^https?:\/\/cdn\.seadays\.app\/?/i, '').replace(/^\/+/, '');
  pathPart = pathPart.split('?')[0];
  if (!pathPart) return s;
  if (!pathPart.startsWith('SeadaysPublic/')) pathPart = `SeadaysPublic/${pathPart}`;
  return `https://auth.seadays.app/storage/v1/object/public/${pathPart}`;
}

module.exports = {
  isBoilerplateDescription,
  stripWikiCitationMarkers,
  stripMarkersOutsideScripts,
  wikipediaArticleUrl,
  dedupeRepeatedCommaPhrase,
  DANGLING_SENTENCE_RE,
  isDanglingSentence,
  isCutFromLonger,
  dropDanglingSentences,
  cleanPortCopy,
  filterHighlightList,
  splitSentences,
  normalizeSentenceKey,
  createSentenceGate,
  loadWikipediaAttribution,
  wikipediaAttributionHtml,
  rewriteCdnThumbnailUrl,
};

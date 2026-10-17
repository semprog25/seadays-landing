'use strict';

const fs = require('fs');
const path = require('path');

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';

function stripWikiCitationMarkers(text) {
  return String(text || '')
    .replace(/\[(?:\d{1,3}|[a-z])\]/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([,.;:])/g, '$1');
}

function stripMarkersOutsideScripts(html) {
  return String(html || '').replace(
    /(<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>)|\[(?:\d{1,3}|[a-z])\]/g,
    (match, keep) => (keep ? keep : '')
  );
}

function loadWikipediaAttribution(repoRoot) {
  const file = path.join(repoRoot || path.join(__dirname, '..', '..'), 'data', 'wikipedia-port-attribution.json');
  if (!fs.existsSync(file)) return {};
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function wikipediaArticleUrl(title) {
  const slug = String(title || '')
    .trim()
    .replace(/ /g, '_');
  return `https://en.wikipedia.org/wiki/${encodeURI(slug).replace(/%20/g, '_')}`;
}

function wikipediaAttributionHtml(entry) {
  if (!entry || !entry.title) return '';
  const article = entry.url || wikipediaArticleUrl(entry.title);
  return `<p class="wiki-attribution">Parts of this description are adapted from <a href="${article}">Wikipedia</a>, licensed under <a href="${CC_BY_SA}">CC BY-SA 4.0</a>.</p>`;
}

/**
 * cdn.seadays.app does not resolve. Related-article thumbnails belong on the
 * public Supabase storage host.
 */
function rewriteCdnThumbnailUrl(url) {
  const raw = String(url || '').trim();
  if (!/cdn\.seadays\.app/i.test(raw)) return raw;
  let rest = raw.replace(/^https?:\/\/cdn\.seadays\.app\//i, '').replace(/^\/+/, '');
  const q = rest.indexOf('?');
  const pathPart = (q === -1 ? rest : rest.slice(0, q)).replace(/^\/+/, '');
  const query = q === -1 ? '' : rest.slice(q);
  if (!pathPart) return raw;
  const fixed = pathPart.startsWith('SeadaysPublic/') ? pathPart : `SeadaysPublic/${pathPart}`;
  return `https://auth.seadays.app/storage/v1/object/public/${fixed}${query}`;
}

module.exports = {
  CC_BY_SA,
  stripWikiCitationMarkers,
  stripMarkersOutsideScripts,
  loadWikipediaAttribution,
  wikipediaArticleUrl,
  wikipediaAttributionHtml,
  rewriteCdnThumbnailUrl,
};

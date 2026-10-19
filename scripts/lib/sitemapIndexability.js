'use strict';

/**
 * Sitemap eligibility: a URL belongs in sitemap.xml only when the page it points to
 * can be indexed. Reads the on-disk HTML, so the sitemap follows each page's robots
 * meta automatically and cannot drift from it.
 *
 * Excluded: robots/googlebot noindex, meta-refresh redirect stubs.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = 'https://seadays.app';
const HEAD_SCAN_CHARS = 12000;

function headOf(html) {
  const s = String(html || '');
  const end = s.search(/<\/head>/i);
  return end > 0 ? s.slice(0, end) : s.slice(0, HEAD_SCAN_CHARS);
}

function isNoindexHtml(html) {
  const head = headOf(html);
  const metas = head.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of metas) {
    const name = (tag.match(/\bname\s*=\s*["']([^"']+)["']/i) || [])[1];
    if (!name || !/^(robots|googlebot)$/i.test(name.trim())) continue;
    const content = (tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i) || [])[1] || '';
    if (/\b(noindex|none)\b/i.test(content)) return true;
  }
  return false;
}

function isRedirectStubHtml(html) {
  return /<meta\b[^>]*http-equiv\s*=\s*["']refresh["']/i.test(headOf(html));
}

/**
 * Map an absolute seadays.app URL to the file GitHub Pages would serve.
 * Returns '' when the URL is not on this site.
 */
function locToFile(repoRoot, loc) {
  const raw = String(loc || '').trim();
  if (!raw.startsWith(BASE_URL)) return '';
  let p = raw.slice(BASE_URL.length).split(/[?#]/)[0];
  try {
    p = decodeURI(p);
  } catch {
    /* keep raw */
  }
  if (!p || p === '/') return path.join(repoRoot, 'index.html');
  const rel = p.replace(/^\/+/, '');
  if (p.endsWith('/')) return path.join(repoRoot, rel, 'index.html');
  const direct = path.join(repoRoot, rel);
  if (fs.existsSync(direct) && fs.statSync(direct).isFile()) return direct;
  const asDir = path.join(repoRoot, rel, 'index.html');
  if (fs.existsSync(asDir)) return asDir;
  return path.join(repoRoot, `${rel}.html`);
}

/**
 * @returns {{eligible: boolean, reason: string}}
 */
function sitemapEligibility(repoRoot, loc) {
  const file = locToFile(repoRoot, loc);
  if (!file) return { eligible: false, reason: 'off-site' };
  if (!fs.existsSync(file)) return { eligible: false, reason: 'missing' };
  let html = '';
  try {
    html = fs.readFileSync(file, 'utf8');
  } catch {
    return { eligible: false, reason: 'unreadable' };
  }
  if (isNoindexHtml(html)) return { eligible: false, reason: 'noindex' };
  if (isRedirectStubHtml(html)) return { eligible: false, reason: 'redirect' };
  return { eligible: true, reason: '' };
}

function isSitemapEligible(repoRoot, loc) {
  return sitemapEligibility(repoRoot, loc).eligible;
}

/**
 * Drop every <url> whose page is noindex, a redirect stub or missing.
 * @returns {{xml: string, dropped: Array<{loc: string, reason: string}>}}
 */
function filterSitemapXml(repoRoot, xml) {
  const dropped = [];
  const out = String(xml || '').replace(/[ \t]*<url>[\s\S]*?<\/url>\r?\n?/g, (block) => {
    const m = block.match(/<loc>([^<]+)<\/loc>/);
    if (!m) return block;
    const loc = m[1].replace(/&amp;/g, '&');
    const res = sitemapEligibility(repoRoot, loc);
    if (res.eligible) return block;
    dropped.push({ loc, reason: res.reason });
    return '';
  });
  return { xml: out, dropped };
}

module.exports = {
  isNoindexHtml,
  isRedirectStubHtml,
  locToFile,
  sitemapEligibility,
  isSitemapEligible,
  filterSitemapXml,
};

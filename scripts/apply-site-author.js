#!/usr/bin/env node
'use strict';

/**
 * Put the configured byline (data/editorial-author.json) on every committed
 * blog post and blog card without a CMS regeneration. Idempotent.
 */

const fs = require('fs');
const path = require('path');
const {
  loadSiteAuthor,
  getSiteAuthorJsonLd,
  articleAuthorBylineHtml,
  articleAuthorBylineLabel,
} = require('./lib/publicationSchema');

const ROOT = path.join(__dirname, '..');
const SPAN_RE = /<span class="author">(?:(?!<\/span>)[\s\S])*?(?:<a [^>]*>[^<]*<\/a>)?<\/span>/g;

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function patchPost(html, site) {
  let out = html.replace(SPAN_RE, `<span class="author">${articleAuthorBylineHtml(null, site)}</span>`);
  out = out.replace(/<meta property="article:author" content="[^"]*">/g, `<meta property="article:author" content="${escAttr(site.name)}">`);
  out = out.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g, (whole, json) => {
    let data;
    try {
      data = JSON.parse(json);
    } catch {
      return whole;
    }
    if (!data || data['@type'] !== 'Article') return whole;
    data.author = getSiteAuthorJsonLd(site);
    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });
  return out;
}

function main() {
  const site = loadSiteAuthor();
  if (!site) {
    console.log('[site-author] no named author configured; nothing to do');
    return;
  }
  let changed = 0;
  const blogDir = path.join(ROOT, 'blog');
  for (const slug of fs.readdirSync(blogDir)) {
    const file = path.join(blogDir, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('<span class="author">')) continue;
    const next = patchPost(html, site);
    if (next !== html) {
      fs.writeFileSync(file, next, 'utf8');
      changed += 1;
    }
  }
  const indexFile = path.join(blogDir, 'index.html');
  if (fs.existsSync(indexFile)) {
    const html = fs.readFileSync(indexFile, 'utf8');
    const next = html.replace(SPAN_RE, `<span class="author">${articleAuthorBylineLabel(null, site)}</span>`);
    if (next !== html) {
      fs.writeFileSync(indexFile, next, 'utf8');
      changed += 1;
    }
  }
  console.log(`[site-author] ${site.name}: updated ${changed} file(s)`);
}

if (require.main === module) main();

module.exports = { patchPost };

#!/usr/bin/env node
'use strict';

/**
 * Downgrade port and ship pages that fail the publish gate to noindex,
 * and drop those URLs from sitemap.xml without rewriting other lastmod values.
 */

const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('./lib/publishGate');
const { replaceRobotsMeta } = require('./lib/adsenseIndexability');
const { isPortSeoRedirectSlug } = require('./lib/portSeoRedirects');

const BASE = 'https://seadays.app';

function listPages(repoRoot, kind) {
  const dir = path.join(repoRoot, kind === 'ship' ? 'ships' : 'ports');
  const pages = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    pages.push({
      file,
      slug: ent.name,
      kind,
      html: fs.readFileSync(file, 'utf8'),
    });
  }
  return pages;
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(String(html || '').slice(0, 4000));
}

function dropSitemapUrls(xml, urls) {
  if (!urls.size) return xml;
  return xml.replace(/[ \t]*<url>[\s\S]*?<\/url>\r?\n?/g, (block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/);
    if (loc && urls.has(loc[1])) return '';
    return block;
  });
}

function addSitemapUrls(xml, urls) {
  if (!urls.length) return xml;
  const present = new Set([...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  const lines = [];
  for (const url of urls) {
    if (present.has(url)) continue;
    lines.push(
      `  <url><loc>${url}</loc><lastmod>2026-10-17</lastmod><changefreq>monthly</changefreq><priority>0.65</priority></url>`
    );
  }
  if (!lines.length) return xml;
  return xml.replace('</urlset>', `${lines.join('\n')}\n</urlset>`);
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  const pages = [...listPages(repoRoot, 'port'), ...listPages(repoRoot, 'ship')];
  const results = evaluatePublishGate(pages);
  const byFile = new Map(results.map((row) => [row.file, row]));
  const drop = new Set();
  const restore = [];
  let downgraded = 0;
  let restored = 0;
  let failing = 0;

  for (const page of pages) {
    const row = byFile.get(page.file);
    const fail = row && row.issues.length > 0;
    if (fail) failing += 1;
    let html = page.html;
    const refresh = /http-equiv=["']refresh/i.test(html.slice(0, 2500));
    if (fail && !isNoindex(html)) {
      html = replaceRobotsMeta(html, 'noindex, follow');
      fs.writeFileSync(page.file, html, 'utf8');
      downgraded += 1;
    } else if (
      !fail &&
      page.kind === 'port' &&
      isNoindex(html) &&
      !refresh &&
      !isPortSeoRedirectSlug(page.slug)
    ) {
      html = replaceRobotsMeta(html, 'index, follow');
      fs.writeFileSync(page.file, html, 'utf8');
      restored += 1;
      restore.push(`${BASE}/ports/${page.slug}/`);
    }
    if (isNoindex(html) || refresh) {
      drop.add(`${BASE}/${page.kind === 'ship' ? 'ships' : 'ports'}/${page.slug}/`);
    }
  }

  const sitemapPath = path.join(repoRoot, 'sitemap.xml');
  const before = fs.readFileSync(sitemapPath, 'utf8');
  const after = addSitemapUrls(dropSitemapUrls(before, drop), restore);
  if (after !== before) fs.writeFileSync(sitemapPath, after, 'utf8');
  const locs = (after.match(/<loc>/g) || []).length;
  console.log(
    `[publish-gate] pages=${pages.length} failing=${failing} downgraded=${downgraded} restored=${restored} sitemap=${locs} droppedCandidates=${drop.size}`
  );
}

main();

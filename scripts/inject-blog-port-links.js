#!/usr/bin/env node
'use strict';

/**
 * Inject blog → Port Guide contextual links into existing static blog articles
 * without a full generateBlogs run.
 */

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { injectKeywordLinksIntoBodyHtml, buildPortLinksFromSeoPorts, buildShipLinksFromSeoShips } = require('./lib/seoKeywordLinks');
const { buildSeoPortRecords, buildSeoShipRecords } = require('./lib/seoShipPortPages');

function extractArticleBody(html) {
  const startTag = '<div class="article-body">';
  const start = html.indexOf(startTag);
  if (start < 0) return null;
  const contentStart = start + startTag.length;
  let depth = 1;
  let i = contentStart;
  while (i < html.length && depth > 0) {
    const nextOpen = html.indexOf('<div', i);
    const nextClose = html.indexOf('</div>', i);
    if (nextClose < 0) return null;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      i = nextOpen + 4;
      continue;
    }
    depth -= 1;
    if (depth === 0) {
      return {
        start: contentStart,
        end: nextClose,
        body: html.slice(contentStart, nextClose),
      };
    }
    i = nextClose + 6;
  }
  return null;
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const ds = await import(pathToFileURL(path.join(__dirname, 'lib/appCruiseDataset.js')).href);
  const APP_ALL_PORTS = ds.allPorts || [];
  const APP_ALL_SHIPS = ds.allShips || [];
  const rawPorts = APP_ALL_PORTS.map((p) => {
    const slug = String(p.slug || '').trim();
    const country = p.country || '';
    const label = String(p.name || '').trim();
    const portName =
      country && label.toLowerCase().endsWith(`, ${String(country).toLowerCase()}`)
        ? label.slice(0, -2 - String(country).length).trim()
        : label || slug;
    return { id: slug, slug, portName, country, region: p.region || '', description: '', highlights: [] };
  });
  const seoPorts = buildSeoPortRecords(rawPorts);
  const portLinks = buildPortLinksFromSeoPorts(seoPorts);
  const seoShips = buildSeoShipRecords(APP_ALL_SHIPS);
  const shipLinks = buildShipLinksFromSeoShips(seoShips);
  const blogDir = path.join(repoRoot, 'blog');
  let changed = 0;
  let scanned = 0;
  let linked = 0;

  for (const ent of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const indexPath = path.join(blogDir, ent.name, 'index.html');
    if (!fs.existsSync(indexPath)) continue;
    scanned += 1;
    let html = fs.readFileSync(indexPath, 'utf8');
    if (/name=["']robots["'][^>]*noindex/i.test(html)) continue;
    const extracted = extractArticleBody(html);
    if (!extracted) continue;
    const after = injectKeywordLinksIntoBodyHtml(extracted.body, {
      maxShipLinks: 1,
      maxPortLinks: 1,
      maxSpecificPortLinks: extracted.body.includes('port-guide-link') ? 0 : 3,
      maxSpecificShipLinks: extracted.body.includes('ship-guide-link') ? 0 : 2,
      portLinks,
      shipLinks,
    });
    if (after === extracted.body) continue;
    let nextHtml = html.slice(0, extracted.start) + after + html.slice(extracted.end);
    if (after.includes('port-guide-link') && !/Explore our linked .*Cruise Port Guide/i.test(nextHtml)) {
      const insertAt = extracted.start + after.length;
      const cta =
        '<p class="related-inline">Planning a shore day? Explore our linked <a href="/ports/" class="contextual-link">SeaDays Cruise Port Guide</a> for terminals, transport tips, and bookable experiences.</p>';
      nextHtml = nextHtml.slice(0, insertAt) + cta + nextHtml.slice(insertAt);
    }
    if (after.includes('port-guide-link') || after.includes('ship-guide-link')) linked += 1;
    fs.writeFileSync(indexPath, nextHtml, 'utf8');
    changed += 1;
  }
  console.log(
    `[inject-blog-port-links] scanned=${scanned} changed=${changed} withLinks=${linked} portPhrases=${Object.keys(portLinks).length} shipPhrases=${Object.keys(shipLinks).length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

/**
 * Inject blog → Port Guide contextual links into existing static blog articles
 * without a full generateBlogs run.
 */

const fs = require('fs');
const path = require('path');
const { injectKeywordLinksIntoBodyHtml, buildPortLinksFromSeoPorts } = require('./lib/seoKeywordLinks');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');

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

function main() {
  const repoRoot = path.join(__dirname, '..');
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
    const extracted = extractArticleBody(html);
    if (!extracted) continue;
    if (extracted.body.includes('port-guide-link')) continue;
    const after = injectKeywordLinksIntoBodyHtml(extracted.body, {
      maxShipLinks: 0,
      maxPortLinks: 0,
      maxSpecificPortLinks: 4,
      portLinks,
    });
    if (after === extracted.body) continue;
    let nextHtml = html.slice(0, extracted.start) + after + html.slice(extracted.end);
    if (after.includes('port-guide-link') && !/Explore our linked .*Cruise Port Guide/i.test(nextHtml)) {
      const insertAt = extracted.start + after.length;
      const cta =
        '<p class="related-inline">Planning a shore day? Explore our linked <a href="/ports/" class="contextual-link">SeaDays Cruise Port Guide</a> for terminals, transport tips, and bookable experiences.</p>';
      nextHtml = nextHtml.slice(0, insertAt) + cta + nextHtml.slice(insertAt);
      linked += 1;
    } else if (after.includes('port-guide-link')) {
      linked += 1;
    }
    fs.writeFileSync(indexPath, nextHtml, 'utf8');
    changed += 1;
  }
  console.log(
    `[inject-blog-port-links] scanned=${scanned} changed=${changed} withPortLinks=${linked} portPhrases=${Object.keys(portLinks).length}`
  );
}

main();

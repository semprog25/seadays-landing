#!/usr/bin/env node
'use strict';

/**
 * One-off editorial pass: remove keyword-style bold from the given blog posts.
 * Writes the cleaned body to data/blog-body-overrides/<slug>.html (so a CMS
 * regeneration keeps it) and patches blog/<slug>/index.html in place.
 *
 * Usage: node scripts/destuff-bold-posts.js <slug> [<slug> ...]
 */

const fs = require('fs');
const path = require('path');
const { destuffBold, boldStats } = require('./lib/boldStuffing');

const ROOT = path.join(__dirname, '..');
const OPEN = '<div class="article-body">';

function articleBodyRange(html) {
  const start = html.indexOf(OPEN);
  if (start < 0) return null;
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      depth += 1;
      i += 4;
      continue;
    }
    if (html.startsWith('</div>', i)) {
      depth -= 1;
      i += 6;
      if (depth === 0) return { start, innerStart: start + OPEN.length, innerEnd: i - 6, end: i };
      continue;
    }
    i += 1;
  }
  return null;
}

function stripStoreCtas(body) {
  return body.replace(/<aside class="get-seadays-cta"[\s\S]*?<\/aside>/gi, '');
}

function prose(body) {
  return stripStoreCtas(body).replace(/<p class="related-inline">[\s\S]*?<\/p>/gi, '');
}

function main() {
  const slugs = process.argv.slice(2);
  if (!slugs.length) {
    console.error('usage: destuff-bold-posts.js <slug> ...');
    process.exit(1);
  }
  const report = [];
  for (const slug of slugs) {
    const file = path.join(ROOT, 'blog', slug, 'index.html');
    const html = fs.readFileSync(file, 'utf8');
    const r = articleBodyRange(html);
    if (!r) throw new Error(`no article-body in ${slug}`);
    const body = html.slice(r.innerStart, r.innerEnd);
    const before = boldStats(prose(body));
    const cleanedWithCtas = destuffBold(body);
    const after = boldStats(prose(cleanedWithCtas));
    fs.writeFileSync(
      path.join(ROOT, 'data', 'blog-body-overrides', `${slug}.html`),
      // The generator adds its own "Related:" line to every body, so keep it out of the override.
      `${stripStoreCtas(cleanedWithCtas).replace(/<p class="related-inline">Related:[\s\S]*?<\/p>/gi, '').trim()}\n`,
      'utf8'
    );
    fs.writeFileSync(file, html.slice(0, r.innerStart) + cleanedWithCtas + html.slice(r.innerEnd), 'utf8');
    report.push({ slug, words: before.words, before: before.tagsPer100, after: after.tagsPer100, beforeTags: before.tags, afterTags: after.tags });
  }
  console.log(JSON.stringify(report, null, 2));
}

main();

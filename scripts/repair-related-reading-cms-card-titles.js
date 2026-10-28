#!/usr/bin/env node
'use strict';

/**
 * Patch committed ship/port pages: fix related-reading card title + img alt for
 * blog slugs listed in data/blog-article-corrections.json (CMS raw title → approved display).
 *
 * Usage:
 *   node scripts/repair-related-reading-cms-card-titles.js
 *   node scripts/repair-related-reading-cms-card-titles.js --dry-run
 */

const fs = require('fs');
const path = require('path');
const { resolveRelatedReadingCardTitle } = require('./lib/blogProductionHygiene');

const repoRoot = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadTitleCorrections() {
  const file = path.join(repoRoot, 'data', 'blog-article-corrections.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed.titleBySourceSlug && typeof parsed.titleBySourceSlug === 'object' ? parsed.titleBySourceSlug : {};
}

/** Known CMS leak on ship/port cards for the Celebrity Edge comparison slug. */
const CMS_RAW_TITLES_BY_SLUG = {
  'cvs-celebrity-edge-modern-cruise-ship-comparison':
    'cvs Celebrity Edge: Modern Cruise Ship Comparison',
};

/**
 * @param {string} html
 * @param {string} blogSlug
 * @param {string} wrongPlain
 * @param {string} correctPlain
 * @returns {{ html: string, changed: boolean }}
 */
function patchRelatedReadingCardTitleInPage(html, blogSlug, wrongPlain, correctPlain) {
  const href = `/blog/${blogSlug}/`;
  const cardStart = `<a class="seo-article-card" href="${href}">`;
  const idx = html.indexOf(cardStart);
  if (idx === -1) return { html, changed: false };
  const endIdx = html.indexOf('</a>', idx);
  if (endIdx === -1) return { html, changed: false };
  const cardEnd = endIdx + 4;
  const card = html.slice(idx, cardEnd);
  if (!card.includes(wrongPlain)) return { html, changed: false };

  const escWrong = escapeHtml(wrongPlain);
  const escCorrect = escapeHtml(correctPlain);
  let newCard = card;
  newCard = newCard.replace(`alt="${escWrong}"`, `alt="${escCorrect}"`);
  newCard = newCard.replace(`<strong>${escWrong}</strong>`, `<strong>${escCorrect}</strong>`);
  if (newCard === card) return { html, changed: false };
  return { html: html.slice(0, idx) + newCard + html.slice(cardEnd), changed: true };
}

function listDetailIndexFiles() {
  const out = [];
  for (const dirName of ['ships', 'ports']) {
    const base = path.join(repoRoot, dirName);
    if (!fs.existsSync(base)) continue;
    for (const slug of fs.readdirSync(base)) {
      const p = path.join(base, slug, 'index.html');
      if (fs.existsSync(p)) out.push(p);
    }
  }
  return out;
}

function main() {
  const titleBySourceSlug = loadTitleCorrections();
  const targets = Object.keys(CMS_RAW_TITLES_BY_SLUG).filter((slug) => titleBySourceSlug[slug]);
  if (!targets.length) {
    console.error('No repair targets (missing corrections entries)');
    process.exit(1);
  }

  let repaired = 0;
  let scanned = 0;
  for (const file of listDetailIndexFiles()) {
    scanned += 1;
    let html = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const slug of targets) {
      const wrongPlain = CMS_RAW_TITLES_BY_SLUG[slug];
      const correctPlain = resolveRelatedReadingCardTitle(
        { slug, title: wrongPlain },
        titleBySourceSlug
      );
      const result = patchRelatedReadingCardTitleInPage(html, slug, wrongPlain, correctPlain);
      html = result.html;
      if (result.changed) changed = true;
    }
    if (changed) {
      repaired += 1;
      if (!dryRun) fs.writeFileSync(file, html, 'utf8');
    }
  }

  console.log(
    `${dryRun ? '[dry-run] ' : ''}related-reading CMS title repair: ${repaired} pages updated (${scanned} scanned)`
  );
}

module.exports = {
  patchRelatedReadingCardTitleInPage,
  CMS_RAW_TITLES_BY_SLUG,
};

if (require.main === module) main();

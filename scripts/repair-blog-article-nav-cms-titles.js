#!/usr/bin/env node
'use strict';

/**
 * Patch committed blog article pages: prev/next nav labels and more-card img alt
 * when raw CMS titles remain but data/blog-article-corrections.json has approved copy.
 *
 * Usage:
 *   node scripts/repair-blog-article-nav-cms-titles.js
 *   node scripts/repair-blog-article-nav-cms-titles.js --dry-run
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

/**
 * @param {string} html
 * @param {Record<string, string>} titleBySourceSlug
 * @returns {{ html: string, changed: boolean }}
 */
function patchBlogArticleNavAndMoreCardTitles(html, titleBySourceSlug) {
  let out = String(html || '');
  let changed = false;

  const navRe =
    /<a href="(\/blog\/([^"/]+)\/)" class="(article-nav-prev|article-nav-next)"><span class="article-nav-label">([^<]*)<\/span><span>([^<]*)<\/span><\/a>/gi;
  out = out.replace(navRe, (full, href, slug, navClass, navLabel, visible) => {
    const corrected = resolveRelatedReadingCardTitle({ slug, title: visible }, titleBySourceSlug);
    if (!corrected || corrected === visible) return full;
    changed = true;
    return `<a href="${href}" class="${navClass}"><span class="article-nav-label">${navLabel}</span><span>${escapeHtml(corrected)}</span></a>`;
  });

  for (const slug of Object.keys(titleBySourceSlug)) {
    const corrected = titleBySourceSlug[slug];
    const escSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escCorrect = escapeHtml(corrected);
    const cardRe = new RegExp(
      `<a href="/blog/${escSlug}/" class="more-card">([\\s\\S]*?)<\\/a>`,
      'gi'
    );
    out = out.replace(cardRe, (cardHtml) => {
      let next = cardHtml;
      let cardChanged = false;
      const titleMatch = next.match(/<h3 class="more-card-title">([^<]*)<\/h3>/);
      if (titleMatch && titleMatch[1].trim() !== corrected) {
        next = next.replace(
          `<h3 class="more-card-title">${titleMatch[1]}`,
          `<h3 class="more-card-title">${escCorrect}`
        );
        cardChanged = true;
      }
      const altMatch = next.match(/\salt="([^"]*)"/);
      if (altMatch && altMatch[1] !== corrected) {
        next = next.replace(`alt="${altMatch[1]}"`, `alt="${escCorrect}"`);
        cardChanged = true;
      }
      if (cardChanged) changed = true;
      return cardChanged ? next : cardHtml;
    });
  }

  return { html: out, changed };
}

function listBlogArticleIndexFiles() {
  const blogDir = path.join(repoRoot, 'blog');
  const out = [];
  if (!fs.existsSync(blogDir)) return out;
  for (const slug of fs.readdirSync(blogDir)) {
    const p = path.join(blogDir, slug, 'index.html');
    if (fs.existsSync(p) && fs.statSync(path.join(blogDir, slug)).isDirectory()) out.push(p);
  }
  return out;
}

function main() {
  const titleBySourceSlug = loadTitleCorrections();
  let repaired = 0;
  let scanned = 0;
  for (const file of listBlogArticleIndexFiles()) {
    scanned += 1;
    const before = fs.readFileSync(file, 'utf8');
    const { html, changed } = patchBlogArticleNavAndMoreCardTitles(before, titleBySourceSlug);
    if (changed) {
      repaired += 1;
      if (!dryRun) fs.writeFileSync(file, html, 'utf8');
    }
  }
  console.log(
    `${dryRun ? '[dry-run] ' : ''}blog article-nav / more-card title repair: ${repaired} pages updated (${scanned} scanned)`
  );
}

module.exports = {
  patchBlogArticleNavAndMoreCardTitles,
  listBlogArticleIndexFiles,
};

if (require.main === module) main();

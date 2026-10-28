#!/usr/bin/env node
'use strict';

/**
 * Patch committed port pages: fix related-reading <small> excerpts (48-port sprint set)
 * without full page regeneration.
 *
 * Usage:
 *   node scripts/repair-broken-related-reading-excerpts.js           # re-fix slugs changed vs origin/main
 *   node scripts/repair-broken-related-reading-excerpts.js --baseline # initial fix from origin/main audit set
 *   node scripts/repair-broken-related-reading-excerpts.js --dry-run
 *   node scripts/repair-broken-related-reading-excerpts.js --slugs=halifax-ns-canada,dubai-united-arab-emirates
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  relatedReadingCardExcerpt,
  isCompleteRelatedReadingExcerpt,
  isBrokenRelatedReadingExcerpt,
  extractArticleCardImageFromHtml,
} = require('./lib/seoShipPortPages');

const repoRoot = path.join(__dirname, '..');
const dryRun = process.argv.includes('--dry-run');
const baselineMode = process.argv.includes('--baseline');

function parseSlugsArg(argv) {
  const raw = argv.find((a) => a.startsWith('--slugs='));
  if (!raw) return [];
  return raw
    .slice('--slugs='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const explicitPortSlugs = parseSlugsArg(process.argv);
const slugsMode = explicitPortSlugs.length > 0;

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function loadBlogStubs() {
  const blogDir = path.join(repoRoot, 'blog');
  if (!fs.existsSync(blogDir)) return new Map();
  const bySlug = new Map();
  for (const slug of fs.readdirSync(blogDir)) {
    const p = path.join(blogDir, slug, 'index.html');
    if (!fs.existsSync(p)) continue;
    let html;
    try {
      html = fs.readFileSync(p, 'utf8');
    } catch {
      continue;
    }
    const titleRaw = (html.match(/<h1>([^<]+)<\/h1>/i) || [])[1] || slug;
    const metaDescription = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
    const img = extractArticleCardImageFromHtml(html);
    bySlug.set(slug, {
      slug,
      title: titleRaw.replace(/&amp;/g, '&').replace(/&quot;/g, '"'),
      excerpt: metaDescription,
      seoDescription: metaDescription,
      metaDescription,
      thumbnailUrl: img || '',
      heroImageUrl: img || '',
    });
  }
  return bySlug;
}

function listSprintPortSlugsFromDiff() {
  try {
    const out = execSync('git diff --name-only origin/main -- ports/', {
      cwd: repoRoot,
      encoding: 'utf8',
    });
    return out
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('ports/') && line.endsWith('/index.html'))
      .map((line) => line.replace(/^ports\//, '').replace(/\/index\.html$/, ''));
  } catch {
    return [];
  }
}

function listSprintPortSlugsFromBaselineAudit() {
  const portsDir = path.join(repoRoot, 'ports');
  const slugs = [];
  for (const slug of fs.readdirSync(portsDir)) {
    const file = path.join(portsDir, slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (/ is what\./i.test(html)) slugs.push(slug);
  }
  return slugs.sort();
}

const CARD_SMALL_RE =
  /(<a class="seo-article-card" href="\/blog\/([^"/]+)\/"[\s\S]*?<small>)([^<]*)(<\/small>)/g;

const SMALL_BY_SLUG_RE = /href="\/blog\/([^"/]+)\/"[\s\S]*?<small>([^<]*)<\/small>/g;

function moreReadingSmallBySlug(html) {
  const map = new Map();
  let match;
  SMALL_BY_SLUG_RE.lastIndex = 0;
  while ((match = SMALL_BY_SLUG_RE.exec(html))) {
    map.set(match[1], match[2]);
  }
  return map;
}

function sprintRepairedBlogSlugs(mainHtml, currentHtml) {
  const main = moreReadingSmallBySlug(mainHtml);
  const cur = moreReadingSmallBySlug(currentHtml);
  const slugs = new Set();
  for (const [slug, text] of cur) {
    if (main.get(slug) !== text) slugs.add(slug);
  }
  return slugs;
}

function needsExcerptRepair(text) {
  if (isBrokenRelatedReadingExcerpt(text)) return true;
  if (!isCompleteRelatedReadingExcerpt(text)) return true;
  return false;
}

function isBaselineAuditBrokenCard(text) {
  if (isBrokenRelatedReadingExcerpt(text)) return true;
  if (/ is what\./i.test(text)) return true;
  return false;
}

function patchPortHtml(html, mainHtml, stubs, mode) {
  const diffSlugs = mainHtml ? sprintRepairedBlogSlugs(mainHtml, html) : new Set();
  let changed = 0;
  const next = html.replace(CARD_SMALL_RE, (full, pre, slug, text, post) => {
    if (mode === 'slugs') {
      if (!needsExcerptRepair(text)) {
        const stubPreview = stubs.get(slug);
        if (!stubPreview) return full;
        const excerpt = escapeHtml(relatedReadingCardExcerpt(stubPreview, 20));
        if (excerpt === text) return full;
      }
    } else if (mode === 'baseline') {
      if (!isBaselineAuditBrokenCard(text)) return full;
    } else if (diffSlugs.size > 0) {
      if (!diffSlugs.has(slug)) return full;
    } else {
      return full;
    }
    const stub = stubs.get(slug);
    if (!stub) return full;
    const excerpt = escapeHtml(relatedReadingCardExcerpt(stub, 20));
    if (excerpt === text) return full;
    changed += 1;
    return `${pre}${excerpt}${post}`;
  });
  return { html: next, changed };
}

function main() {
  if (slugsMode && baselineMode) {
    console.error('[repair-broken-related-reading-excerpts] --slugs= cannot be combined with --baseline');
    process.exitCode = 1;
    return;
  }

  const stubs = loadBlogStubs();
  const sprintPorts = slugsMode
    ? explicitPortSlugs
    : baselineMode
      ? listSprintPortSlugsFromBaselineAudit()
      : listSprintPortSlugsFromDiff();
  if (!sprintPorts.length) {
    console.log('[repair-broken-related-reading-excerpts] no sprint port slugs to process');
    return;
  }

  let filesPatched = 0;
  let excerptsFixed = 0;
  const mode = slugsMode ? 'slugs' : baselineMode ? 'baseline' : 'diff';

  for (const slug of sprintPorts) {
    const file = path.join(repoRoot, 'ports', slug, 'index.html');
    if (!fs.existsSync(file)) {
      console.warn(`[repair-broken-related-reading-excerpts] missing port page: ${slug}`);
      continue;
    }
    let mainHtml = '';
    if (!baselineMode && !slugsMode) {
      try {
        mainHtml = execSync(`git show origin/main:ports/${slug}/index.html`, {
          cwd: repoRoot,
          encoding: 'utf8',
        });
      } catch {
        continue;
      }
    }
    const html = fs.readFileSync(file, 'utf8');
    const { html: patched, changed } = patchPortHtml(html, mainHtml, stubs, mode);
    if (!changed) continue;
    excerptsFixed += changed;
    filesPatched += 1;
    if (!dryRun) fs.writeFileSync(file, patched, 'utf8');
  }

  console.log(
    `[repair-broken-related-reading-excerpts] ${dryRun ? 'dry-run: would patch' : 'patched'} ${filesPatched} port page(s), ${excerptsFixed} excerpt(s) (${sprintPorts.length} in sprint set, mode=${mode})`
  );
}

module.exports = { parseSlugsArg, needsExcerptRepair };

if (require.main === module) {
  main();
}

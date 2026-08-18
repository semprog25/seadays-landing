#!/usr/bin/env node
/**
 * Point existing Download / Get SeaDays hash links at /download/ with campaign params.
 * Idempotent. Does not rewrite store listing URLs (those are handled at click time).
 *
 * Usage: node scripts/rewrite-download-ctas.js [--dry-run]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { downloadPagePath, stripRedundantCampaignParamsInHtml } = require('./lib/storeLinks');

const ROOT = path.join(__dirname, '..');
const DRY_RUN = process.argv.includes('--dry-run');

const SKIP_DIR_NAMES = new Set(['node_modules', '.git', 'docs', 'data', 'scripts', 'auth']);

function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIR_NAMES.has(entry.name)) continue;
      walkHtmlFiles(full, out);
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function trackingForRel(rel) {
  if (rel === 'index.html') return { medium: 'nav', campaign: 'organic_nav' };
  if (rel.startsWith('blog/')) return { medium: 'blog', campaign: 'blog' };
  if (rel.startsWith('ships/')) return { medium: 'ship_guide', campaign: 'ship_guide' };
  if (rel.startsWith('ports/')) return { medium: 'port_guide', campaign: 'port_guide' };
  if (
    rel.startsWith('cruise-planner') ||
    rel.startsWith('cruise-roll-calls') ||
    rel.startsWith('cruise-community') ||
    rel.startsWith('cruise-budget') ||
    rel.startsWith('cruise-drink')
  ) {
    return { medium: 'feature', campaign: 'feature_landing' };
  }
  if (rel.startsWith('download/')) return { medium: 'nav', campaign: 'organic_nav' };
  return { medium: 'web', campaign: 'organic_web' };
}

function contextualBlock(rel, quotedHref) {
  if (/^ships\/[^/]+\/index\.html$/.test(rel)) {
    return (
      `<p class="seo-inline-more seadays-contextual-cta">` +
      `<a href="${quotedHref}">Know your ship before you sail. Plan this cruise in SeaDays.</a></p>\n`
    );
  }
  if (/^ports\/[^/]+\/index\.html$/.test(rel)) {
    return (
      `<p class="seo-inline-more seadays-contextual-cta">` +
      `<a href="${quotedHref}">Save this port in SeaDays.</a></p>\n`
    );
  }
  if (/^cruise-(planner|roll-calls|community|budget|drink)/.test(rel)) {
    return (
      `<p class="seadays-contextual-cta">` +
      `<a href="${quotedHref}">Plan this cruise in SeaDays.</a></p>\n`
    );
  }
  return '';
}

function rewriteHtml(html, rel) {
  const t = trackingForRel(rel);
  const href = downloadPagePath({
    source: 'seadays_web',
    medium: t.medium,
    campaign: t.campaign,
  });
  const quoted = href.replace(/&/g, '&amp;');
  let next = html;
  next = next.replace(/href=(["'])\/?#download\1/g, `href="${quoted}"`);
  next = next.replace(
    /href=(["'])https:\/\/seadays\.app\/?#download\1/g,
    `href="${quoted}"`
  );
  if (rel.startsWith('blog/') && /app-download-cta/.test(next)) {
    next = next.replace(
      /<strong>Plan smarter\.[^<]*<\/strong>/g,
      '<strong>Planning your first cruise? Start with SeaDays.</strong>'
    );
    next = next.replace(
      /<strong>Planning this cruise\?[^<]*<\/strong>/g,
      '<strong>Planning your first cruise? Start with SeaDays.</strong>'
    );
  }
  if (!/seadays-contextual-cta/.test(next)) {
    const block = contextualBlock(rel, quoted);
    if (block && /<!-- seadays-site-shell:footer -->/.test(next)) {
      next = next.replace(
        '<!-- seadays-site-shell:footer -->',
        `${block}<!-- seadays-site-shell:footer -->`
      );
    }
  }
  next = stripRedundantCampaignParamsInHtml(next);
  return next;
}

function main() {
  const files = walkHtmlFiles(ROOT);
  let changed = 0;
  for (const full of files) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const before = fs.readFileSync(full, 'utf8');
    const after = rewriteHtml(before, rel);
    if (after === before) continue;
    changed += 1;
    if (!DRY_RUN) fs.writeFileSync(full, after, 'utf8');
  }
  console.log(`${DRY_RUN ? 'dry-run ' : ''}rewrote download CTAs in ${changed} files`);
}

main();

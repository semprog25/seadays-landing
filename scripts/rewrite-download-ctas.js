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

function htmlPostprocessRoots() {
  const scoped = String(process.env.SEADAYS_HTML_POSTPROCESS_DIRS || '').trim();
  if (!scoped) return [ROOT];
  return scoped
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => path.join(ROOT, part));
}

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
  let text = '';
  if (/^ships\/[^/]+\/index\.html$/.test(rel)) {
    text = 'Know your ship before you sail. Plan this cruise in SeaDays.';
  } else if (/^ports\/[^/]+\/index\.html$/.test(rel)) {
    text = 'Save this port in SeaDays.';
  }
  if (text) {
    return (
      '<section class="seadays-contextual-cta" aria-label="Plan with SeaDays">' +
      '<p class="seo-inline-more"><a href="' + quotedHref + '">' + text + '</a></p>' +
      '</section>\n'
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

const LEGACY_CONTEXTUAL_RE =
  /<p class="seo-inline-more seadays-contextual-cta"[^>]*>[\s\S]*?<\/p>\s*/gi;
const SECTION_CONTEXTUAL_RE =
  /<section class="seadays-contextual-cta"[^>]*>[\s\S]*?<\/section>\s*/gi;

function insertDetailCtaInsideMain(html, block) {
  // Never generate a CTA outside the layout. Redirect-only pages without <main>
  // remain untouched rather than receiving a broken footer-adjacent block.
  if (!/<\/main>/i.test(html)) return html;
  const withoutOld = html
    .replace(LEGACY_CONTEXTUAL_RE, '')
    .replace(SECTION_CONTEXTUAL_RE, '');
  return withoutOld.replace(/<\/main>/i, `${block}    </main>`);
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
  if (rel.startsWith('blog/') && /<section class="app-download-cta"/.test(next)) {
    const soft =
      `<section class="app-download-cta" aria-label="SeaDays"><p class="app-download-cta-note">Finished the guide? SeaDays can hold the itinerary, spending notes, and roll call for this sailing. <a href="${quoted}">Open the app</a> when you are ready — the article stands on its own.</p></section>`;
    next = next.replace(/<section class="app-download-cta"[\s\S]*?<\/section>/, soft);
  }
  const block = contextualBlock(rel, quoted);
  if (/^(ships|ports)\/[^/]+\/index\.html$/.test(rel)) {
    if (block) next = insertDetailCtaInsideMain(next, block);
  } else if (!/seadays-contextual-cta/.test(next)) {
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
  const files = [];
  for (const root of htmlPostprocessRoots()) {
    walkHtmlFiles(root, files);
  }
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

if (require.main === module) {
  main();
}

module.exports = {
  rewriteHtml,
  trackingForRel,
  contextualBlock,
};

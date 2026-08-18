#!/usr/bin/env node
/**
 * Footer / empty-space layout tests. Structural, not pixel-perfect.
 * Catches missing/duplicate footers, homepage-style snap leaking onto
 * inner pages, and shared-shell stacking that hides the footer.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { getSiteShellCss, getSiteFooterHtml } = require('./lib/siteShell');

const ROOT = path.join(__dirname, '..');
const SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'docs',
  'data',
  'scripts',
  'auth',
  'downloads',
  'logos',
  'marketing',
  'mockups',
  'screenshots',
  'icons',
  'css',
  'js',
]);

function test(name, fn) {
  fn();
  console.log('PASS', name);
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

function isRedirectStub(html) {
  return /http-equiv=["']refresh["']/i.test(html);
}

function isAdminOrToolPage(rel) {
  return /(?:^|\/)(?:seo-admin|waitlist-admin|landing-page|redirect)\.html$/.test(rel);
}

function classify(rel) {
  if (rel === 'index.html') return 'home';
  if (rel === 'press/index.html') return 'press';
  if (rel === 'download/index.html') return 'download';
  if (rel === 'blog/index.html') return 'blog-index';
  if (rel.startsWith('blog/')) return 'blog-article';
  if (rel === 'ships/index.html') return 'ships-index';
  if (rel.startsWith('ships/')) return 'ship-guide';
  if (rel === 'ports/index.html') return 'ports-index';
  if (rel.startsWith('ports/')) return 'port-guide';
  if (/^(about|help|faq|contact|privacy|terms|cookies|gdpr|security|community)\.html$/.test(rel)) {
    return 'legal-company';
  }
  if (rel === 'co2/index.html') return 'sustainability';
  if (
    /^(cruise-planner|cruise-roll-calls|cruise-community|cruise-budget-planner|cruise-drink-calculator)\//.test(
      rel
    )
  ) {
    return 'feature-landing';
  }
  return 'other';
}

const publicFiles = walkHtmlFiles(ROOT).filter((file) => {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  return !isRedirectStub(html) && !isAdminOrToolPage(rel);
});

const byType = {};
for (const file of publicFiles) {
  const type = classify(path.relative(ROOT, file));
  byType[type] = (byType[type] || 0) + 1;
}

test('shared footer is a stacking context above decorative layers', () => {
  const css = getSiteShellCss();
  const footerBlock = css.match(/footer:has\(\.footer-shell\),[\s\S]*?footer\.site-footer \{[\s\S]*?\}/);
  assert.ok(footerBlock, 'canonical footer rule');
  assert.match(footerBlock[0], /position:\s*relative/);
  assert.match(footerBlock[0], /z-index:\s*10/);
  assert.match(footerBlock[0], /scroll-snap-align:\s*none/);
  assert.doesNotMatch(footerBlock[0], /scroll-snap-align:\s*start/);
});

test('shared footer owns .container width so download/legal pages cannot leak page layout', () => {
  const css = getSiteShellCss();
  const containerBlock = css.match(
    /footer:has\(\.footer-shell\) > \.container,[\s\S]*?footer\.site-footer > \.container \{[\s\S]*?\}/
  );
  assert.ok(containerBlock, 'footer container rule');
  assert.match(containerBlock[0], /max-width:\s*1200px/);
  assert.match(containerBlock[0], /padding-left:\s*max\(20px/);
  assert.match(containerBlock[0], /padding-top:\s*0/);
  const downloadHtml = fs.readFileSync(path.join(ROOT, 'download/index.html'), 'utf8');
  assert.doesNotMatch(downloadHtml, /\*\s*\{\s*margin:\s*0;\s*padding:\s*0/);
  assert.match(downloadHtml, /footer-shell/);
});

test('canonical footer contains brand, nav, Get SeaDays, legal, and copyright', () => {
  const footer = getSiteFooterHtml();
  for (const needle of [
    'footer-shell',
    'SeaDays',
    '/ships/',
    '/ports/',
    '/blog/',
    '/press/',
    '/download/',
    'Get SeaDays',
    '/privacy.html',
    '/terms.html',
    '/help.html',
    '© 2026 SeaDays',
  ]) {
    assert.match(footer, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), needle);
  }
});

test('canonical footer destinations exist as public files', () => {
  const footer = getSiteFooterHtml();
  const hrefs = [...footer.matchAll(/href="(\/[^"#?]+)/g)].map((m) => m[1]);
  const missing = [];
  for (const href of hrefs) {
    if (href === '/') continue;
    const candidates = [];
    if (href.endsWith('/')) {
      candidates.push(path.join(ROOT, href, 'index.html'));
    } else {
      candidates.push(path.join(ROOT, href));
      candidates.push(path.join(ROOT, href, 'index.html'));
    }
    if (!candidates.some((p) => fs.existsSync(p))) missing.push(href);
  }
  assert.deepStrictEqual(missing, []);
});

const missingFooter = [];
const duplicateFooter = [];
for (const file of publicFiles) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  const footers = html.match(/<footer\b/gi) || [];
  if (footers.length === 0) missingFooter.push(rel);
  if (footers.length > 1) duplicateFooter.push(rel);
}

test('public content pages include exactly one footer', () => {
  assert.deepStrictEqual(missingFooter, []);
  assert.deepStrictEqual(duplicateFooter, []);
});

test('homepage footer is a sibling of Press, not a nested fullpage snap section', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const close = html.match(/<div class="site-close">([\s\S]*?)<\/div>\s*<!--\s*Consent/i) || html.match(/<div class="site-close">([\s\S]*?)<\/main>/i);
  assert.ok(close, 'site-close wrapper');
  assert.match(close[1], /id="press-media"/);
  assert.match(close[1], /<footer\b/);
  assert.doesNotMatch(close[1], /<section[^>]*id="press-media"[^>]*>[\s\S]*<footer\b[\s\S]*<\/section>/);
});

test('inner page families do not use mandatory vertical scroll-snap', () => {
  const samples = [
    'press/index.html',
    'download/index.html',
    'about.html',
    'help.html',
    'privacy.html',
    'terms.html',
    'blog/index.html',
    'ships/index.html',
    'ports/index.html',
    'cruise-planner/index.html',
  ];
  const leaked = [];
  for (const rel of samples) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    if (/scroll-snap-type:\s*y\s+mandatory/i.test(html)) leaked.push(rel);
  }
  assert.deepStrictEqual(leaked, []);
});

test('press kit is a normal document, not a 100vh snap page', () => {
  const html = fs.readFileSync(path.join(ROOT, 'press/index.html'), 'utf8');
  const css = fs.readFileSync(path.join(ROOT, 'press/css/press.css'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'press/js/press-app.js'), 'utf8');
  assert.match(html, /footer-shell/);
  assert.doesNotMatch(js, /function renderFooter\(/);
  const hero = css.match(/\.press-hero \{[^}]+\}/);
  assert.ok(hero, 'press-hero rule');
  assert.doesNotMatch(hero[0], /height:\s*100vh/);
  assert.doesNotMatch(hero[0], /min-height:\s*100vh/);
});

test('homepage close pane does not snap the footer as its own full viewport', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /class="site-close"/);
  const footerCss = html.match(/\/\* Footer[\s\S]*?footer \{[\s\S]*?scroll-snap-align:\s*([^;]+);/);
  assert.ok(footerCss, 'homepage footer CSS present');
  assert.strictEqual(footerCss[1].trim(), 'none');
  assert.match(html, /#press-media\.fullpage-section\.story-band \{[\s\S]*?flex:\s*1/);
});

console.log(
  `Footer layout inventory: ${publicFiles.length} public pages — ${Object.entries(byType)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([type, count]) => `${type}:${count}`)
    .join(', ')}`
);

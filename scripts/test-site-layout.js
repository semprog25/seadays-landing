#!/usr/bin/env node
/**
 * Structural layout / footer tests. Not pixel-perfect.
 * Catches missing public footers, broken download CTAs, and empty ad-slot gaps.
 */
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { getSiteShellCss, getSiteHeaderHtml, getSiteFooterHtml } = require('./lib/siteShell');
const { getAdSlotCss } = require('./lib/adsenseArticleSlot');
const { downloadPagePath } = require('./lib/storeLinks');

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

test('shared shell CSS does not snap footers to a full viewport', () => {
  const css = getSiteShellCss();
  assert.match(css, /scroll-snap-align:\s*none/);
  assert.doesNotMatch(css, /footer[^{]*\{[^}]*scroll-snap-align:\s*start/);
});

test('shared footer paints above fixed starfield layers', () => {
  const css = getSiteShellCss();
  assert.match(css, /footer:has\(\.footer-shell\),\s*\nfooter\.site-footer \{/);
  assert.match(css, /z-index:\s*10/);
  assert.match(css, /position:\s*relative/);
  assert.match(css, /body:not\(:has\(\.fullpage-section\)\)/);
});

test('Get SeaDays header item is styled as a CTA and stays visible on small phones', () => {
  const css = getSiteShellCss();
  assert.match(css, /header\.header\.site-header \.header-nav a\[href\*="\/download\/"\]/);
  assert.match(css, /a\[href\*="\/download\/"\] \{ display: inline-flex;/);
  const home = getSiteHeaderHtml({ page: 'home' });
  const inner = getSiteHeaderHtml({ page: 'default' });
  assert.doesNotMatch(home, /Get SeaDays/);
  assert.match(inner, /Get SeaDays/);
  assert.match(inner, /\/download\//);
});

test('canonical footer includes existing SeaDays destinations and /download/', () => {
  const footer = getSiteFooterHtml();
  for (const needle of [
    'footer-shell',
    '/ships/',
    '/ports/',
    '/blog/',
    '/press/',
    '/cruise-planner/',
    '/privacy.html',
    '/terms.html',
    '/help.html',
    'Get SeaDays',
    '/download/',
  ]) {
    assert.match(footer, new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(footer, /utm_campaign=organic_web/);
  assert.doesNotMatch(footer, /[?&]campaign=/);
});

test('ad slots occupy no layout until consent marks them ready', () => {
  const css = getAdSlotCss();
  assert.match(css, /aside\.seadays-ad-slot\{display:none/);
  assert.match(css, /seadays-ad-slot--ready\{display:block/);
  const shell = getSiteShellCss();
  assert.match(shell, /aside\.seadays-ad-slot:not\(\.seadays-ad-slot--ready\)/);
});

test('homepage snaps on user scroll and does not auto-advance panes', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /scroll-snap-type:\s*y\s+mandatory/);
  assert.match(html, /scroll-behavior:\s*auto/);
  assert.doesNotMatch(html, /scroll-behavior:\s*smooth/);
  assert.doesNotMatch(html, /behavior:\s*['"]smooth['"]/);
  assert.doesNotMatch(html, /setInterval\(/);
  assert.match(html, /document\.querySelector\('\.site-close'\)/);
});

test('homepage closing pane keeps Press + footer together', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  assert.match(html, /class="site-close"/);
  assert.match(html, /id="press-media"/);
  assert.match(html, /footer-shell/);
  assert.match(html, /#press-media\.fullpage-section\.story-band/);
  const footerCss = html.match(/\/\* Footer[\s\S]*?footer \{[\s\S]*?scroll-snap-align:\s*([^;]+);/);
  assert.ok(footerCss, 'homepage footer CSS present');
  assert.strictEqual(footerCss[1].trim(), 'none');
});

test('download page uses a flex column so the footer sits at the viewport bottom', () => {
  const css = fs.readFileSync(path.join(ROOT, 'assets/css/download.css'), 'utf8');
  assert.match(css, /\.download-page \{[\s\S]*?min-height:\s*100dvh/);
  const contentLayer = css.match(/\.download-page \.content-layer \{[^}]+\}/);
  assert.ok(contentLayer, 'download content-layer rule');
  assert.match(contentLayer[0], /flex:\s*1/);
  assert.doesNotMatch(contentLayer[0], /min-height:\s*100vh/);
  const html = fs.readFileSync(path.join(ROOT, 'download/index.html'), 'utf8');
  assert.match(html, /footer-shell/);
  assert.match(html, /seadays-download\.js/);
  assert.strictEqual(downloadPagePath({ campaign: 'organic_web' }).startsWith('/download/'), true);
});

test('press kit HTML includes the shared footer without relying on JS', () => {
  const html = fs.readFileSync(path.join(ROOT, 'press/index.html'), 'utf8');
  assert.match(html, /footer-shell/);
  const js = fs.readFileSync(path.join(ROOT, 'press/js/press-app.js'), 'utf8');
  assert.doesNotMatch(js, /function renderFooter\(/);
  assert.doesNotMatch(js, /renderFooter\(\),/);
  const pressCss = fs.readFileSync(path.join(ROOT, 'press/css/press.css'), 'utf8');
  assert.doesNotMatch(pressCss, /html:has\(body\.press-kit\)[\s\S]*scroll-snap-type:\s*y\s+mandatory/);
  assert.doesNotMatch(pressCss, /\.press-section\.press-snap-section[\s\S]*max-height:\s*100dvh/);
  assert.match(pressCss, /\.press-hero \{[\s\S]*?min-height:\s*100dvh/);
});

const publicFiles = walkHtmlFiles(ROOT);
const missingFooter = [];
for (const file of publicFiles) {
  const rel = path.relative(ROOT, file);
  const html = fs.readFileSync(file, 'utf8');
  if (isRedirectStub(html) || isAdminOrToolPage(rel)) continue;
  if (!/footer-shell/.test(html)) missingFooter.push(rel);
}

test('public content pages include the shared footer', () => {
  assert.deepStrictEqual(missingFooter, []);
});

test('public download hrefs do not duplicate campaign= alongside matching utm_campaign', () => {
  const duplicates = [];
  const pattern = /utm_campaign=([^&"'#]+)(?:&|&amp;)campaign=\1/;
  for (const file of publicFiles) {
    const rel = path.relative(ROOT, file);
    const html = fs.readFileSync(file, 'utf8');
    if (isRedirectStub(html) || isAdminOrToolPage(rel)) continue;
    if (pattern.test(html)) duplicates.push(rel);
  }
  assert.deepStrictEqual(duplicates, []);
});

test('inner-page headers that include Get SeaDays still point at /download/', () => {
  const samples = [
    'ships/index.html',
    'ports/index.html',
    'blog/index.html',
    'download/index.html',
    'ships/celebrity-solstice/index.html',
    'ports/barcelona-spain/index.html',
    'help.html',
    'cruise-planner/index.html',
  ];
  for (const rel of samples) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(html, /footer-shell/, rel);
    const header = html.match(/seadays-site-shell:header -->[\s\S]*?seadays-site-shell:header-end/);
    assert.ok(header, `header chrome in ${rel}`);
    if (/Get SeaDays/.test(header[0])) {
      assert.match(header[0], /\/download\//, rel);
    }
  }
});

test('Blog is the first header destination and stays visible on small phones', () => {
  const css = getSiteShellCss();
  assert.match(css, /a\[href="\/blog\/"\] \{\s*order:\s*-1/);
  assert.match(css, /a\[href="\/blog\/"\] \{ display: inline-flex;/);
  const home = getSiteHeaderHtml({ page: 'home' });
  const inner = getSiteHeaderHtml({ page: 'default' });
  assert.match(home, /<nav[\s\S]*?<a href="\/blog\/">Blog<\/a>/);
  assert.match(inner, /<nav[\s\S]*?<a href="\/blog\/">Blog<\/a>/);
  const homeHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const nav = homeHtml.match(/<nav class="header-nav"[\s\S]*?<\/nav>/);
  assert.ok(nav, 'homepage nav');
  assert.match(nav[0], /<a href="\/blog\/">Blog<\/a>\s*<a href="#cruise-planning-tools">/);
});

test('homepage shows eight crawlable blog cards before the product journey', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const blogAt = html.indexOf('id="blog"');
  const journeyAt = html.indexOf('id="cruise-planning-tools"');
  assert.ok(blogAt > 0 && journeyAt > blogAt, 'blog section follows the hero and precedes the journey');
  const cards = html.match(/<a href="https:\/\/seadays\.app\/blog\/[^"]+\/" class="blog-card">/g) || [];
  assert.strictEqual(cards.length, 8);
  assert.match(html, /Cruise tips &amp; guides/);
  assert.match(html, /From the blog/);
  assert.match(html, /class="blog-card-excerpt"/);
  assert.doesNotMatch(html, /portside-articles\?limit=/);
  assert.doesNotMatch(html, /\.blog-card-excerpt \{\s*display:\s*none/);
  for (const slug of [
    'pre-cruise-vs-onboard-spending-where-the-folio-actually-blows-up',
    'what-to-post-in-a-cruise-roll-call-first-besides-hi',
    'cruise-packing-list-what-to-assign-before-anyone-buys-a-second-power-strip',
    'cruise-drink-calculator-when-the-beverage-package-actually-loses-money',
    'first-time-cruise-mistakes-that-cost-money-and-how-to-avoid-them',
  ]) {
    assert.match(html, new RegExp(`/blog/${slug}/`));
    assert.ok(fs.existsSync(path.join(ROOT, 'blog', slug, 'index.html')), slug);
  }
});

test('article pages keep one soft lower CTA, a visible byline, and at most one ad slot', () => {
  const sample = fs.readFileSync(
    path.join(ROOT, 'blog/pre-cruise-vs-onboard-spending-where-the-folio-actually-blows-up/index.html'),
    'utf8'
  );
  assert.match(sample, /<span class="author">/);
  assert.match(sample, /Sep 11, 2026/);
  assert.match(sample, /Finished the guide\?/);
  assert.doesNotMatch(sample, /Download SeaDays Free/);
  assert.match(sample, /max-height: 160px/);
  const slots = sample.match(/<aside\b[^>]*seadays-ad-slot/gi) || [];
  assert.strictEqual(slots.length, 1);
});

test('feature guides lead with reading and do not carry ad slots', () => {
  for (const rel of [
    'cruise-planner/index.html',
    'cruise-budget-planner/index.html',
    'cruise-drink-calculator/index.html',
    'cruise-roll-calls/index.html',
    'cruise-community/index.html',
  ]) {
    const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.match(html, /class="reading-lead"/, rel);
    assert.match(html, /class="guide-section"/, rel);
    assert.match(html, /Optional: keep this in SeaDays/, rel);
    assert.doesNotMatch(html, /<ins class="adsbygoogle"/, rel);
    assert.doesNotMatch(html, /cta-button/, rel);
    const leadAt = html.indexOf('class="reading-lead"');
    const productAt = html.indexOf('In the SeaDays app');
    assert.ok(leadAt > 0 && productAt > leadAt, rel);
  }
  const download = fs.readFileSync(path.join(ROOT, 'download/index.html'), 'utf8');
  assert.match(download, /Product download/);
  assert.match(download, /href="\/blog\/"/);
  assert.doesNotMatch(download, /<ins class="adsbygoogle"/);
});

console.log(`Scanned ${publicFiles.length} HTML files`);

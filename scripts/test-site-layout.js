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
  assert.doesNotMatch(pressCss, /\.press-hero \{[\s\S]*?height:\s*100vh/);
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

console.log(`Scanned ${publicFiles.length} HTML files`);

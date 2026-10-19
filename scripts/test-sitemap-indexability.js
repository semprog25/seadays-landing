#!/usr/bin/env node
'use strict';

/**
 * The sitemap must only list indexable pages. Fails if sitemap.xml contains a URL
 * whose page is noindex, a redirect stub or missing, and checks that the generator
 * drops such URLs even when they are passed in explicitly.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isNoindexHtml,
  isRedirectStubHtml,
  filterSitemapXml,
  sitemapEligibility,
} = require('./lib/sitemapIndexability');
const { buildSitemapXml } = require('./generateBlogs');

const root = path.join(__dirname, '..');
let passed = 0;
function test(name, fn) {
  fn();
  passed += 1;
  console.log('PASS', name);
}

test('robots meta detection handles both attribute orders and googlebot', () => {
  assert.ok(isNoindexHtml('<head><meta name="robots" content="noindex, follow"></head>'));
  assert.ok(isNoindexHtml('<head><meta content="noindex,follow" name="robots"></head>'));
  assert.ok(isNoindexHtml("<head><meta name='googlebot' content='noindex'></head>"));
  assert.ok(isNoindexHtml('<head><meta name="robots" content="none"></head>'));
  assert.ok(!isNoindexHtml('<head><meta name="robots" content="index, follow"></head>'));
  assert.ok(!isNoindexHtml('<head></head><body><p>meta name="robots" content="noindex"</p></body>'));
  assert.ok(isRedirectStubHtml('<head><meta http-equiv="refresh" content="0;url=/x/"></head>'));
});

test('filterSitemapXml drops noindex, redirect and missing pages', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-'));
  const write = (rel, html) => {
    fs.mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
    fs.writeFileSync(path.join(tmp, rel), html);
  };
  write('index.html', '<head><meta name="robots" content="index, follow"></head>');
  write('ships/a/index.html', '<head><meta name="robots" content="index, follow"></head>');
  write('ships/b/index.html', '<head><meta name="robots" content="noindex, follow"></head>');
  write('ports/c/index.html', '<head><meta http-equiv="refresh" content="0;url=/ports/d/"></head>');
  write('about.html', '<head></head>');
  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n<urlset>\n' +
    ['/', '/ships/a/', '/ships/b/', '/ports/c/', '/ports/missing/', '/about.html']
      .map((p) => `  <url><loc>https://seadays.app${p}</loc></url>\n`)
      .join('') +
    '</urlset>';
  const { xml: out, dropped } = filterSitemapXml(tmp, xml);
  const locs = [...out.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepStrictEqual(locs, [
    'https://seadays.app/',
    'https://seadays.app/ships/a/',
    'https://seadays.app/about.html',
  ]);
  assert.deepStrictEqual(dropped.map((d) => d.reason).sort(), ['missing', 'noindex', 'redirect']);
});

test('buildSitemapXml leaves out noindex ships and ports even when listed', () => {
  const ships = fs.readdirSync(path.join(root, 'ships')).filter((s) => fs.existsSync(path.join(root, 'ships', s, 'index.html')));
  const ports = fs.readdirSync(path.join(root, 'ports')).filter((s) => fs.existsSync(path.join(root, 'ports', s, 'index.html')));
  const { xml } = buildSitemapXml(root, {
    seoShips: ships.map((slug) => ({ slug })),
    seoPorts: ports.map((slug) => ({ slug })),
  });
  const bad = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => m[1])
    .filter((loc) => !sitemapEligibility(root, loc).eligible);
  assert.deepStrictEqual(bad, []);
});

test('committed sitemap.xml lists no noindex, redirect or missing URL', () => {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const { dropped } = filterSitemapXml(root, xml);
  assert.deepStrictEqual(dropped, [], `non-indexable URLs in sitemap.xml: ${dropped.map((d) => `${d.loc} (${d.reason})`).join(', ')}`);
});

console.log(`sitemap indexability tests: ${passed} passed`);

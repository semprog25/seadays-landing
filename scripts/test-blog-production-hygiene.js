#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEAKED_EDITORIAL_TEST_RE,
  stripLeakedProductionNotes,
  applyBlogProductionHygieneToHtml,
  patchArticleHeroImageCss,
} = require('./lib/blogProductionHygiene');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');
const CVS_OLD = 'cvs-celebrity-edge-modern-cruise-ship-comparison';

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('removes primary-keyword production sentence', () => {
  const input =
    'Early clarity for the keyword: work remotely on a cruise ship when you treat WiFi like rent. Real planning still matters.';
  const actual = stripLeakedProductionNotes(input);
  assert.doesNotMatch(actual, LEAKED_EDITORIAL_TEST_RE);
  assert.match(actual, /Real planning still matters/);
});

test('preserves spaces around inline strong tags in article body', () => {
  const { applyBlogProductionHygieneToHtml } = require('./lib/blogProductionHygiene');
  const sample =
    '<p>step onto a balcony, and the <strong>horizon</strong> does the therapy your <strong>Slack</strong> cannot afford.</p>';
  const out = applyBlogProductionHygieneToHtml(sample);
  assert.match(out, /the <strong>horizon<\/strong> does/);
  assert.match(out, /your <strong>Slack<\/strong> cannot/);
});

test('converts markdown links in article body html', () => {
  const html = '<p>See [First-time mistakes](/blog/first-time-cruise-mistakes/) next.</p>';
  const actual = applyBlogProductionHygieneToHtml(html);
  assert.match(actual, /<a href="\/blog\/first-time-cruise-mistakes\/">First-time mistakes<\/a>/);
  assert.doesNotMatch(actual, /\]\(\//);
});

test('hero css patch removes 160px strip rule', () => {
  const css = '.article-hero-image { width: 100%; height: 160px; max-height: 160px; object-fit: cover; }';
  const actual = patchArticleHeroImageCss(`<style>${css}</style>`);
  assert.doesNotMatch(actual, /height:\s*160px/);
  assert.match(actual, /aspect-ratio:\s*3\s*\/\s*2/);
});

function indexableBlogBodies() {
  const bodies = [];
  for (const ent of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(BLOG, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (!/content="index,\s*follow"/i.test(html.slice(0, 5000))) continue;
    const m = html.match(/<div class="article-body">([\s\S]*?)<\/div>\s*<aside class="get-seadays-cta"/);
    if (m) bodies.push({ slug: ent.name, text: m[1].replace(/<[^>]+>/g, ' ') });
  }
  return bodies;
}

test('no indexable blog body contains leaked editorial phrases', () => {
  const failures = [];
  for (const { slug, text } of indexableBlogBodies()) {
    if (LEAKED_EDITORIAL_TEST_RE.test(text)) failures.push(slug);
    if (/\]\(\//.test(text)) failures.push(`${slug}:raw-md`);
    if (/\bcvs Celebrity\b/i.test(text)) failures.push(`${slug}:cvs-title`);
    if (/\bCrusies\b/.test(text)) failures.push(`${slug}:crusies`);
  }
  assert.deepStrictEqual(failures, [], failures.join(', '));
});

test('cvs comparison keeps production slug with corrected Prima vs Edge title', () => {
  const page = path.join(BLOG, CVS_OLD, 'index.html');
  assert.ok(fs.existsSync(page), 'comparison article must exist at legacy slug');
  const html = fs.readFileSync(page, 'utf8');
  assert.match(html, /index,\s*follow/i);
  assert.match(html, new RegExp(`https://seadays.app/blog/${CVS_OLD}/`));
  assert.match(html, /Norwegian Prima vs Celebrity Edge/i);
  assert.doesNotMatch(html, /norwegian-prima-vs-celebrity-edge-modern-cruise-ship-comparison/);
  assert.doesNotMatch(html, /cvs Celebrity/i);
});

console.log('OK blog production hygiene');

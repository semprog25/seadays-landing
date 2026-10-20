#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  LEAKED_EDITORIAL_TEST_RE,
  SD28_TEMPLATE_TEST_RE,
  SD28_KNOWN_HOLDBACK_SLUGS,
  stripLeakedProductionNotes,
  scrubSd28TemplateDebris,
  applyBlogProductionHygieneToHtml,
  patchArticleHeroImageCss,
  extractArticleBodyFromPage,
  measureInlineBoldDensity,
  reduceExcessiveInlineBold,
} = require('./lib/blogProductionHygiene');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');
const CVS_OLD = 'cvs-celebrity-edge-modern-cruise-ship-comparison';

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('SD-28 scrub removes framing-issue opener and passenger-notice filler', () => {
  const input =
    'Framing the Issue: Sample title starts with honest constraints: passports, mobility, budget. ' +
    'Norwegian Prima feels newer, which Royal Caribbean passengers notice first.';
  const actual = scrubSd28TemplateDebris(input);
  assert.doesNotMatch(actual, /Framing the Issue/i);
  assert.doesNotMatch(actual, /honest constraints/i);
  assert.doesNotMatch(actual, /passengers notice first/i);
  assert.match(actual, /Norwegian Prima feels newer/);
});

test('SD-28 template markers on indexable posts are limited to known holdback slugs', () => {
  const unexpected = [];
  for (const { slug, text } of indexableBlogBodies()) {
    if (!SD28_TEMPLATE_TEST_RE.test(text)) continue;
    if (!SD28_KNOWN_HOLDBACK_SLUGS.has(slug)) unexpected.push(slug);
  }
  assert.deepStrictEqual(unexpected, [], unexpected.join(', '));
});

test('removes primary-keyword production sentence', () => {
  const input =
    'Early clarity for the keyword: work remotely on a cruise ship when you treat WiFi like rent. Real planning still matters.';
  const actual = stripLeakedProductionNotes(input);
  assert.doesNotMatch(actual, LEAKED_EDITORIAL_TEST_RE);
  assert.match(actual, /Real planning still matters/);
});

test('inserts space before inline ship link when generator omitted it', () => {
  const html = '<p>Passengers who have sailed both<a href="/ships/norwegian-joy/">Norwegian Joy</a>often.</p>';
  const actual = applyBlogProductionHygieneToHtml(html);
  assert.match(actual, /both <a href=/);
});

test('preserves spaces when SD-07 unwraps single-word strong tags', () => {
  const sample =
    '<p>step onto a balcony, and the <strong>horizon</strong> does the therapy your <strong>Slack</strong> cannot afford.</p>';
  const out = applyBlogProductionHygieneToHtml(sample);
  assert.match(out, /the horizon does the therapy your Slack cannot afford/);
  assert.doesNotMatch(out, /<strong\b/i);
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

function articleBodyFromPage(html) {
  const slot = extractArticleBodyFromPage(html);
  return slot ? slot.body : null;
}

function normalizeArticlePlainText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function indexableBlogArticleBodies() {
  const bodies = [];
  for (const ent of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(BLOG, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (!/content="index,\s*follow"/i.test(html.slice(0, 5000))) continue;
    const body = articleBodyFromPage(html);
    if (body) bodies.push({ slug: ent.name, html: body, text: body.replace(/<[^>]+>/g, ' ') });
  }
  return bodies;
}

function indexableBlogBodies() {
  return indexableBlogArticleBodies().map(({ slug, text }) => ({ slug, text }));
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

test('extractArticleBodyFromPage includes content after intro Get SeaDays CTA', () => {
  const page =
    '<div class="article-body"><p>Intro</p><aside class="get-seadays-cta" data-seadays-blog-cta="intro"></aside><p>After CTA</p></div><section class="same-topic-section"></section>';
  const slot = extractArticleBodyFromPage(page);
  assert.ok(slot);
  assert.match(slot.body, /After CTA/);
  assert.doesNotMatch(slot.body, /same-topic-section/);
});

test('SD-07 reduceExcessiveInlineBold is idempotent', () => {
  const sample =
    '<p>' +
    Array.from({ length: 20 }, (_, i) => `<strong>word${i}</strong>`).join(' ') +
    ' closing.</p>';
  const once = reduceExcessiveInlineBold(sample);
  const twice = reduceExcessiveInlineBold(once);
  assert.strictEqual(once, twice);
});

test('SD-07 removes adjacent word-by-word strong markup without losing words', () => {
  const sample =
    '<p><strong>Civitavecchia</strong> <strong>lies</strong> <strong>~70</strong> <strong>km</strong> northwest of <strong>Rome</strong>.</p>';
  const actual = reduceExcessiveInlineBold(sample);
  assert.doesNotMatch(actual, /<strong>\s*Civitavecchia\s*<\/strong>/);
  assert.match(actual, /Civitavecchia lies ~70 km northwest of Rome/);
  assert.doesNotMatch(actual, /Civitavecchialies/);
});

test('SD-07 keeps sparse multi-word emphasis when density stays at or below 3 per 100 words', () => {
  const filler = Array.from({ length: 34 }, (_, i) => `topic${i}`).join(' ');
  const sample = `<p>On <strong>port days</strong>, ${filler}. On <strong>sea days</strong>, ${filler}.</p>`;
  const actual = reduceExcessiveInlineBold(sample);
  assert.match(actual, /<strong>port days<\/strong>/);
  assert.match(actual, /<strong>sea days<\/strong>/);
  assert.ok(measureInlineBoldDensity(actual).per100 <= 3);
});

test('SD-07 strips keyword-stuffed phrase bold when density exceeds 3 per 100 words', () => {
  const chunks = [];
  for (let i = 0; i < 12; i += 1) {
    chunks.push(`<strong>keyword phrase ${i}</strong> `);
  }
  const sample = `<p>${chunks.join('')}with normal closing text.</p>`;
  const actual = reduceExcessiveInlineBold(sample);
  assert.doesNotMatch(actual, /<strong\b/i);
  assert.match(actual, /keyword phrase 0/);
  assert.match(actual, /normal closing text/);
});

test('no indexable blog body exceeds 3 inline strong tags per 100 words (SD-07)', () => {
  const failures = [];
  for (const { slug, html } of indexableBlogArticleBodies()) {
    const { per100, strong } = measureInlineBoldDensity(html);
    if (per100 > 3) failures.push(`${slug}:${strong}:${per100.toFixed(1)}`);
  }
  assert.deepStrictEqual(failures, [], failures.join(', '));
});

test('SD-07 corrected articles preserve plain text, links, and page chrome', () => {
  const { execSync } = require('child_process');
  const REF = 'e557d5463';
  const failures = [];
  for (const { slug, html } of indexableBlogArticleBodies()) {
    let basePage;
    try {
      basePage = execSync(`git show ${REF}:blog/${slug}/index.html`, { encoding: 'utf8' });
    } catch {
      continue;
    }
    const baseBody = articleBodyFromPage(basePage);
    if (!baseBody || measureInlineBoldDensity(baseBody).per100 <= 3) continue;
    const nowPage = fs.readFileSync(path.join(BLOG, slug, 'index.html'), 'utf8');
    const plainBase = normalizeArticlePlainText(applyBlogProductionHygieneToHtml(baseBody));
    const plainNow = normalizeArticlePlainText(html);
    if (plainBase !== plainNow) failures.push(`${slug}:plain-text`);
    const hrefBase = (baseBody.match(/href="[^"]+"/g) || []).sort().join('|');
    const hrefNow = (html.match(/href="[^"]+"/g) || []).sort().join('|');
    if (hrefBase !== hrefNow) failures.push(`${slug}:href`);
    if (!/same-topic-section|explore-more-section|more-to-read-section/.test(nowPage)) {
      if (/same-topic-section|explore-more-section|more-to-read-section/.test(basePage)) {
        failures.push(`${slug}:chrome`);
      }
    }
    const canonBase = (basePage.match(/<link rel="canonical" href="[^"]+"/) || [])[0];
    const canonNow = (nowPage.match(/<link rel="canonical" href="[^"]+"/) || [])[0];
    if (canonBase && canonBase !== canonNow) failures.push(`${slug}:canonical`);
    const robotsBase = (basePage.match(/content="index,\s*follow"/i) || [])[0];
    const robotsNow = (nowPage.match(/content="index,\s*follow"/i) || [])[0];
    if (robotsBase !== robotsNow) failures.push(`${slug}:robots`);
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

test('legacy slugs keep canonicals when visible titles drop unsupported claims', () => {
  const cases = [
    ['trip-cost-analytics-in-seadays-where-cruisers-actually-leak-300800-per-voyage', /How to Read Where the Money Went/, /\$300/],
    ['i-tried-living-on-a-cruise-ship-for-30-days-heres-what-happened', /What to Check Before a 30-Day/, /I Tried Living/],
    ['top-10-cruise-ships-for-2026-features-reviews-and-experiences', /Cruise Ships to Compare in 2026/, /Top 10 Cruise Ships/],
  ];
  for (const [slug, titleRe, bannedRe] of cases) {
    const html = fs.readFileSync(path.join(BLOG, slug, 'index.html'), 'utf8');
    const h1 = (html.match(/<h1>([^<]*)<\/h1>/) || [])[1] || '';
    assert.match(h1, titleRe, slug);
    assert.doesNotMatch(h1, bannedRe, slug);
    assert.match(html, new RegExp(`<link rel="canonical" href="https://seadays.app/blog/${slug}/">`));
    assert.match(html, /content="index,\s*follow"/i);
  }
  const chaotic = fs.readFileSync(path.join(BLOG, 'why-your-cruise-feels-chaotic-without-a-planning-app', 'index.html'), 'utf8');
  assert.doesNotMatch(chaotic, /Framing the Issue/);
  assert.match(chaotic, /the-hidden-stress-of-cruise-travel-and-how-to-avoid-it/);
  assert.match(chaotic, /content="index,\s*follow"/i);
});

console.log('OK blog production hygiene');

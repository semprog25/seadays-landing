#!/usr/bin/env node
'use strict';

/** The de-bolded posts must stay clean: no bold in running text, at most one key phrase per list item. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { boldStats } = require('./lib/boldStuffing');

const root = path.join(__dirname, '..');
const SLUGS = [
  'rome-civitavecchia-cruise-port-how-to-explore-the-eternal-city',
  'family-friendly-cruise-ships-which-one-should-you-pick',
  'is-the-port-of-miami-the-best-cruise-hub-full-review',
  'luxury-cruises-comparing-royal-caribbeans-oasis-class-ships',
  'aidacosma-vs-msc-seashore-ship-comparison-guide',
  'best-mediterranean-cruise-ports-what-to-do-in-each-stop',
  'is-unlimited-food-on-cruises-really-unlimited-what-the-buffets-dont-advertise',
  'the-truth-about-cruise-ship-internet-speed-test-results-myths-and-what-to-expect',
  'sea-cloud-cruises-a-deep-dive-into-luxury-tall-ship-voyages',
  'small-ship-cruises-why-intimate-voyages-are-rising',
  'top-10-cruise-ships-for-2026-features-reviews-and-experiences',
  'the-future-of-cruising-ai-smart-ships-floating-cities',
];

for (const slug of SLUGS) {
  const override = path.join(root, 'data', 'blog-body-overrides', `${slug}.html`);
  assert.ok(fs.existsSync(override), `missing override for ${slug}`);
  const html = fs.readFileSync(path.join(root, 'blog', slug, 'index.html'), 'utf8');
  const start = html.indexOf('<div class="article-body">');
  const end = html.indexOf('<section class="more-to-read"', start);
  const body = html.slice(start, end > start ? end : undefined);
  const paragraphs = body.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi) || [];
  for (const p of paragraphs) assert.ok(!/<(strong|b)\b/i.test(p), `bold in a paragraph of ${slug}`);
  for (const li of body.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || []) {
    assert.ok((li.match(/<(strong|b)\b/gi) || []).length <= 1, `more than one bold phrase in a list item of ${slug}`);
  }
  const stats = boldStats(body);
  assert.ok(stats.tagsPer100 <= 3, `${slug} has ${stats.tagsPer100} bold per 100 words`);
}
// The generator injects its own "Related:" line, so override bodies must not carry one.
const overrideDir = path.join(root, 'data', 'blog-body-overrides');
for (const name of fs.readdirSync(overrideDir).filter((n) => n.endsWith('.html'))) {
  const body = fs.readFileSync(path.join(overrideDir, name), 'utf8');
  assert.ok(!/class="related-inline">Related:/.test(body), `${name} has a baked-in Related: line`);
}
for (const slug of fs.readdirSync(path.join(root, 'blog'))) {
  const file = path.join(root, 'blog', slug, 'index.html');
  if (!fs.existsSync(file)) continue;
  const n = (fs.readFileSync(file, 'utf8').match(/class="related-inline">Related:/g) || []).length;
  assert.ok(n <= 1, `${slug} has ${n} Related: lines`);
}
console.log(`bold cleanup ok (${SLUGS.length} posts)`);

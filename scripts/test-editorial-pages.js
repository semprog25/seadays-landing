#!/usr/bin/env node
'use strict';

/** Editorial rewrites (Molde, Celebrity Solstice, Rome from Civitavecchia). */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadEditorialPages, applyEditorialPage, faqPairs, START, END } = require('./lib/editorialPages');
const { evaluatePublishGate } = require('./lib/publishGate');

const root = path.join(__dirname, '..');
const NO_TIPPING = /\b(tipping|tipped|tip (?:the|your|drivers?|guides?|staff|crew)|gratuit(?:y|ies)|service charge)\b/i;
const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');

const pages = loadEditorialPages();
assert.ok(pages.length >= 2, 'expected editorial pages');
for (const page of pages) {
  const file = path.join(root, page.kind, page.slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.strictEqual(applyEditorialPage(html, page), html, `${page.kind}/${page.slug} is not up to date (run apply-editorial-pages)`);
  assert.ok(html.includes(START) && html.includes(END), `${page.slug} lacks editorial markers`);
  assert.ok(/<meta name="robots" content="index, follow">/.test(html), `${page.slug} should be indexable`);
  assert.ok(sitemap.includes(`<loc>https://seadays.app/${page.kind}/${page.slug}/</loc>`), `${page.slug} missing from sitemap`);
  const text = page.body.replace(/<[^>]+>/g, ' ');
  const tipping = text.match(NO_TIPPING);
  assert.ok(!tipping, `${page.slug} mentions "${tipping && tipping[0]}"`);
  assert.ok(/id="sources"/.test(page.body), `${page.slug} has no sources section`);
  const faq = html.match(/"@type":"FAQPage"[\s\S]*?<\/script>/);
  const pairs = faqPairs(page.body);
  if (pairs.length) {
    assert.ok(faq, `${page.slug} lost its FAQPage JSON-LD`);
    for (const [q] of pairs) assert.ok(faq[0].includes(JSON.stringify(q).slice(1, -1)), `FAQ JSON-LD missing "${q}"`);
  }
  const both = (html.match(/seadays-editorial:start/g) || []).length;
  assert.strictEqual(both, 1, `${page.slug} has ${both} editorial blocks`);
}

// Molde: the partner box sits under the full-day section, not at the top.
const molde = fs.readFileSync(path.join(root, 'ports', 'molde-norway', 'index.html'), 'utf8');
assert.ok(molde.indexOf('id="full-day"') < molde.indexOf('id="bookable-experiences"'), 'Molde partner box must follow the full-day section');
assert.ok(molde.indexOf('id="things-to-do"') < molde.indexOf('id="quick-facts"'), 'Molde should open with things to do');

// Solstice: verified specs, not the app dataset values.
const solstice = fs.readFileSync(path.join(root, 'ships', 'celebrity-solstice', 'index.html'), 'utf8');
assert.ok(/<dt>Length<\/dt><dd>317 m/.test(solstice), 'Solstice length should be 317 m');
assert.ok(!/290 m|35 m beam/.test(solstice), 'Solstice still shows the wrong dataset specs');

// Publish gate must pass for every editorial page.
const gatePages = [];
for (const kind of ['ports', 'ships']) {
  for (const slug of fs.readdirSync(path.join(root, kind))) {
    const file = path.join(root, kind, slug, 'index.html');
    if (fs.existsSync(file)) gatePages.push({ file, slug, kind: kind === 'ports' ? 'port' : 'ship', html: fs.readFileSync(file, 'utf8') });
  }
}
for (const row of evaluatePublishGate(gatePages)) {
  if (pages.some((p) => row.file.endsWith(path.join(p.kind, p.slug, 'index.html')))) {
    assert.deepStrictEqual(row.issues, [], `${row.slug} fails the publish gate: ${row.issues.join(', ')}`);
  }
}

// Rome blog rewrite.
const romeSlug = 'rome-civitavecchia-cruise-port-how-to-explore-the-eternal-city';
const romeBody = fs.readFileSync(path.join(root, 'data', 'blog-body-overrides', `${romeSlug}.html`), 'utf8');
const romeTipping = romeBody.replace(/<[^>]+>/g, ' ').match(NO_TIPPING);
assert.ok(!romeTipping, `Rome post mentions "${romeTipping && romeTipping[0]}"`);
assert.ok(romeBody.indexOf('<h2>Where to get off</h2>') < romeBody.indexOf('partner-box'), 'Rome partner box must follow "Where to get off"');
assert.ok(/rel="noopener noreferrer sponsored"/.test(romeBody), 'Rome partner link must be rel=sponsored');
const romePage = fs.readFileSync(path.join(root, 'blog', romeSlug, 'index.html'), 'utf8');
assert.ok(romePage.includes('<h1>Civitavecchia to Rome on a Cruise Day'), 'Rome page title not updated');
assert.ok(romePage.includes('Largo della Pace'), 'Rome page body not updated');
assert.strictEqual((romePage.match(/class="related-inline">Related:/g) || []).length, 1, 'Rome page should have one Related line');

console.log(`editorial pages ok (${pages.length} pages + Rome post)`);

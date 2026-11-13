#!/usr/bin/env node
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { splitPassengerSentences, prepareFaqPassengerText } = require('./lib/publicGuideCopySanitize');
const { collectPortFaqItems, clipFaqAnswer } = require('./lib/portGuideSections');

const ROOT = path.join(__dirname, '..');
const COHORT = [
  'st-kitts-basseterre-st-kitts',
  'st-croix-frederiksted-us-virgin-islands',
  'st-george-s-grenada',
  'st-lucia-castries-st-lucia',
  'st-thomas-charlotte-amalie-us-virgin-islands',
  'st-tropez-france',
];

const RESEARCH_IN_FAQ = /\b(claimed|not surveyed|minutes unverified|per VIPA|per VPCC)\b/i;
const SKIP_ENTRY_FAQ_SLUGS = new Set([
  'st-george-s-grenada',
  'st-lucia-castries-st-lucia',
  'st-thomas-charlotte-amalie-us-virgin-islands',
]);

assert.equal(
  splitPassengerSentences('Walk past Mt. Hill via Ft. Road and Dr. Smith at No. 4. Take a taxi.').length,
  2
);

assert.match(
  prepareFaqPassengerText('Town centre walk claimed ~5 min. Brimstone Hill / beaches by taxi.'),
  /short walk from the cruise piers/
);
assert.doesNotMatch(prepareFaqPassengerText('Town centre walk claimed ~5 min.'), RESEARCH_IN_FAQ);
assert.match(
  prepareFaqPassengerText('Tender ~1 NM then short walk into village.'),
  /one nautical mile/i
);

const kittsFaq = collectPortFaqItems(
  {
    gettingThere: {
      distanceToCity:
        'The terminal in St. Kitts is a short walk from the city centre. More information follows.',
    },
  },
  'St. Kitts'
);
assert.ok(kittsFaq.length >= 1);
assert.match(kittsFaq[0].a, /St\. Kitts/);
assert.ok(kittsFaq[0].a.endsWith('centre.'));

for (const slug of COHORT) {
  const file = path.join(ROOT, 'ports', slug, 'index.html');
  const html = fs.readFileSync(file, 'utf8');
  assert.doesNotMatch(html, /<p>For St\.<\/p>/, `${slug}: FAQ fragment`);
  const cards = [...html.matchAll(/<article class="pg-qa-card">[\s\S]*?<h3>([\s\S]*?)<\/h3>\s*<p>([\s\S]*?)<\/p>/g)].map((m) => ({
    q: decodeHtml(m[1]),
    a: decodeHtml(m[2].replace(/<[^>]*>/g, '')).trim(),
  }));
  for (const { q, a } of cards) {
    if (!a) continue;
    assert.ok(isFaqAnswerComplete(clipFaqAnswer(a)), `${slug}: incomplete visible answer`);
    assert.doesNotMatch(a, RESEARCH_IN_FAQ, `${slug}: research phrasing in FAQ body`);
    if (SKIP_ENTRY_FAQ_SLUGS.has(slug)) {
      assert.doesNotMatch(q, /entry or visa requirements/i, `${slug}: entry FAQ should be omitted`);
    }
  }
  const json = extractFaqPageJsonLd(html);
  if (!cards.length) {
    assert.equal(json, null, `${slug}: FAQPage JSON-LD without visible cards`);
    continue;
  }
  assert.ok(json, `${slug}: visible FAQ cards without FAQPage JSON-LD`);
  const byQuestion = new Map(cards.map((c) => [c.q, c.a]));
  assert.equal(json.mainEntity.length, cards.length, `${slug}: JSON-LD count vs visible cards`);
  for (const entity of json.mainEntity || []) {
    const text = entity.acceptedAnswer?.text || '';
    const name = entity.name || '';
    assert.ok(text.split(/\s+/).length > 6, `${slug}: JSON-LD FAQ too short: ${text}`);
    assert.doesNotMatch(text, /^For St\.$/);
    assert.doesNotMatch(text, RESEARCH_IN_FAQ, `${slug}: research phrasing in JSON-LD`);
    const visible = byQuestion.get(name);
    assert.ok(visible, `${slug}: JSON-LD question missing in HTML: ${name}`);
    assert.equal(text, visible, `${slug}: JSON-LD answer mismatch for ${name}`);
  }
}

console.log('test-st-faq-abbrev-regression PASS', COHORT.length, 'ports');

function decodeHtml(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractFaqPageJsonLd(html) {
  for (const match of String(html).matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    const data = JSON.parse(match[1]);
    if (data && data['@type'] === 'FAQPage') return data;
  }
  return null;
}

function isFaqAnswerComplete(text) {
  const body = String(text || '').replace(/^For [^,]+,\s*/i, '');
  return body.split(/\s+/).filter(Boolean).length > 6;
}

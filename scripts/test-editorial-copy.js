#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  BANNED_TOPIC,
  stripBannedTopicText,
  applyEditorialCopyToText,
  applyEditorialCopyToHtml,
  rewriteTemplateSummaries,
} = require('./lib/editorialCopy');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('removes gratuity list items and keeps the rest of the sentence', () => {
  const actual = stripBannedTopicText(
    'Include fare, taxes, gratuities, excursions, specialty dining, drinks, Wi-Fi, spa, and souvenirs.'
  );
  assert.strictEqual(
    actual,
    'Include fare, taxes, excursions, specialty dining, drinks, Wi-Fi, spa, and souvenirs.'
  );
  assert.doesNotMatch(actual, BANNED_TOPIC);
});

test('drops a sentence that is only about auto-added gratuities', () => {
  const actual = stripBannedTopicText(
    'Some lines auto-add gratuities to package prices; others do not. Some require every adult in a cabin to buy the same package.'
  );
  assert.strictEqual(actual, 'Some require every adult in a cabin to buy the same package.');
  assert.doesNotMatch(actual, BANNED_TOPIC);
});

test('rewrites the recycled place-name summary', () => {
  const actual = rewriteTemplateSummaries(
    'Why Balcony Cabins Sell Out First: practical cruise advice covering Montego Bay, the Caribbean, and real scenarios. Written for travelers who want useful details, not generic tips.'
  );
  assert.doesNotMatch(actual, /Montego Bay/);
  assert.match(actual, /balcony cabins/i);
});

test('removes Roll Call from paid lists and states that roll calls are free', () => {
  const actual = applyEditorialCopyToText(
    'Paid tiers unlock more saved trips, ad-free browsing, Roll Call access, and additional planning tools. Roll Call access is included on paid plans.'
  );
  assert.doesNotMatch(actual, /Roll Call access/);
  assert.match(actual, /Roll calls are free in SeaDays/);
  assert.match(actual, /more saved trips/);
});

test('normalizes AIDAcosma and the article before AIDA and Oceania', () => {
  const actual = applyEditorialCopyToText(
    'AIDACosma is a AIDA Cruises ship profile. Sirena is a Oceania Cruises ship profile.'
  );
  assert.strictEqual(
    actual,
    'AIDAcosma is an AIDA Cruises ship profile. Sirena is an Oceania Cruises ship profile.'
  );
});

test('cleans banned wording inside FAQ JSON-LD without breaking the script', () => {
  const html =
    '<script type="application/ld+json">{"text":"Include fare, taxes, gratuities, and drinks."}</script><p>Include fare, taxes, gratuities, and drinks.</p>';
  const actual = applyEditorialCopyToHtml(html);
  assert.doesNotMatch(actual, BANNED_TOPIC);
  assert.match(actual, /Include fare, taxes, and drinks\./);
  assert.match(actual, /<script type="application\/ld\+json">\{/);
});

console.log('editorial copy tests passed');

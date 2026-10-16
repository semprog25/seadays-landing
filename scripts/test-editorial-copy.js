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

test('rewrites money-sense tips and leaves advice tips alone', () => {
  assert.strictEqual(
    stripBannedTopicText('In others, cash for taxis, tips, or small purchases makes the day smoother.'),
    'In others, cash for taxis and small purchases makes the day smoother.'
  );
  assert.strictEqual(
    stripBannedTopicText('Having some cash can help with taxis, tips, and small vendors.'),
    'Having some cash can help with taxis and small vendors.'
  );
  assert.strictEqual(
    stripBannedTopicText('Hand off checked luggage near the entrance (small cash for tips helps). Keep documents with you.'),
    'Hand off checked luggage near the entrance. Keep documents with you.'
  );
  assert.strictEqual(
    stripBannedTopicText('cash for tips assigned to the person doing airport transport'),
    'cash assigned to the person doing airport transport'
  );
  assert.strictEqual(stripBannedTopicText('Share tips with your roll call before you sail.'), 'Share tips with your roll call before you sail.');
  assert.strictEqual(stripBannedTopicText('First-time cruise tips to know before you go.'), 'First-time cruise tips to know before you go.');
  assert.doesNotMatch(
    stripBannedTopicText('The fare is not the cost. Gratuities, Wi-Fi, drinks, excursions, transfers, and port-day cash sit elsewhere.'),
    /gratuit/i
  );
});

test('drops leftover tipping sentences and repairs list holes in HTML', () => {
  const html = [
    '<p><strong>Cruise travel</strong> has its own rules: <strong>all-aboard times</strong>, <strong></strong>, <strong>cruise cabin</strong> locations.</p>',
    '<p><strong></strong> <strong>and</strong> <strong>service</strong> <strong>charges</strong> <strong>follow</strong> <strong>each</strong> <strong>brand’s</strong> <strong>policies</strong>—<strong>prepay</strong> <strong>during</strong> <strong>promotions</strong> <strong>to</strong> <strong>lock</strong> <strong>rates</strong> and avoid surprises at disembarkation.</p>',
    '<p><strong>Q5: Do crew members rely on tips—and should I tip extra?</strong> Extra cash for exceptional service is often appreciated.</p>',
    '<p>Bring small bills for tips on excursions and in port. Crew and guides appreciate cash.</p>',
  ].join('');
  const actual = applyEditorialCopyToHtml(html);
  assert.doesNotMatch(actual, /<strong>\s*<\/strong>/);
  assert.doesNotMatch(actual, /gratuit|service charge|for tips|tip extra|appreciate cash/i);
  assert.match(actual, /all-aboard times/);
  assert.match(actual, /cruise cabin/);
  assert.match(actual, /Prepay during promotions to lock rates/);
  assert.match(actual, /port vendor or taxi does not take cards/);
  assert.doesNotMatch(actual, /Q5:/);
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

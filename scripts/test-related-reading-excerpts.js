'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  relatedReadingCardExcerpt,
  isBrokenRelatedReadingExcerpt,
  isCompleteRelatedReadingExcerpt,
  buildArticleCards,
  buildPortDetailHtml,
} = require('./lib/seoShipPortPages');

test('isBrokenRelatedReadingExcerpt flags template fragment', () => {
  assert.equal(isBrokenRelatedReadingExcerpt('If cruise packing list for caribbean is what.'), true);
  assert.equal(isBrokenRelatedReadingExcerpt(''), true);
  assert.equal(
    isBrokenRelatedReadingExcerpt(
      'A Caribbean cruise packing list: sun, insects, medicines, and the power-strip rule.'
    ),
    false
  );
});

test('relatedReadingCardExcerpt prefers metaDescription over broken excerpt', () => {
  const article = {
    title: 'How to Use Cruise Packing List For Caribbean',
    excerpt: 'If cruise packing list for caribbean is what you need, this guide explains the checklist.',
    seoDescription: 'If cruise packing list for caribbean is what you need, read this.',
    metaDescription:
      'A Caribbean cruise packing list: sun, insects, medicines, and the power-strip rule—without Alaska gear.',
  };
  const out = relatedReadingCardExcerpt(article, 20);
  assert.doesNotMatch(out, /is what\.\s*$/i);
  assert.match(out, /Caribbean cruise packing list/i);
  assert.ok(out.endsWith('.') || out.endsWith('—without Alaska gear.'));
});

test('relatedReadingCardExcerpt uses complete sentences within word budget', () => {
  const article = {
    title: 'Luxury Cruises: Comparing Oasis-Class Ships',
    metaDescription:
      'Royal Caribbean’s Oasis class redefined mega-ship cruising with neighborhoods, Central Park, and record-breaking entertainment. This guide compares Oasis-class vessels.',
  };
  const out = relatedReadingCardExcerpt(article, 20);
  assert.doesNotMatch(out, /\bhow they\s*$/i);
  assert.doesNotMatch(out, / is what\./i);
});

test('buildArticleCards escapes excerpt and avoids broken pattern', () => {
  const html = buildArticleCards(
    [
      {
        slug: 'how-to-use-cruise-packing-list-for-caribbean',
        title: 'How to Use Cruise Packing List For Caribbean',
        excerpt: 'If cruise packing list for caribbean is what you need on board.',
        metaDescription: 'A Caribbean cruise packing list: sun, insects, medicines, and the power-strip rule.',
      },
    ],
    'Port guide'
  );
  assert.match(html, /seo-article-grid/);
  assert.doesNotMatch(html, /is what\./i);
  assert.match(html, /Caribbean cruise packing list/i);
});

test('relatedReadingCardExcerpt — Skagway cruise-tips card is complete (no bundle-of truncation)', () => {
  const article = {
    slug: 'cruise-tips-vs-cruise-hacks-what-to-choose',
    title: 'Cruise Tips Vs Cruise Hacks: What to Choose',
    metaDescription:
      'If cruise tips vs cruise hacks is what you are trying to plan around, treat it as a bundle of decisions—cabin, route timing, and port-day realism—rather than a single “best list” answer. It matters most for first time cruisers when you are',
    excerpt:
      'If cruise tips vs cruise hacks is what you are trying to plan around, treat it as a bundle of decisions—cabin, route timing, and port-day realism—rather than a single “best list” answer. It matters most for first time cruisers when you are',
    seoDescription:
      'If cruise tips vs cruise hacks is what you are trying to plan around, treat it as a bundle of decisions—cabin, route timing, and port-day realism—rather than a single “best list” answer. It matters most for first time cruisers when you are',
  };
  const out = relatedReadingCardExcerpt(article, 20);
  assert.ok(isCompleteRelatedReadingExcerpt(out), `incomplete excerpt: ${out}`);
  assert.doesNotMatch(out, /^rather than\b/i);
  assert.doesNotMatch(out, /bundle of\s*$/i);
  assert.doesNotMatch(out, / is what\.\s*$/i);
  assert.match(out, /[.!?…]["']?\s*$/);
});

test('relatedReadingCardExcerpt rejects lowercase mid-sentence dash fragments (Norwegian fjords)', () => {
  const article = {
    slug: 'norwegian-fjords-cruise-guide-best-season-key-ports-and-scenic-cruising',
    title: 'Norwegian Fjords Cruise Guide: Best Season, Key Ports, and Scenic Cruising',
    metaDescription:
      'Sailing Norway’s fjords is a masterclass in vertical geography—waterfalls ribbon down cliffs, villages cling to impossible slopes, and light behaves differently by latitude and season. This article explains when to go, which ports anchor typical itineraries, how weather shapes your packing, and why scenic cruising days matter as much as time ashore.',
  };
  const out = relatedReadingCardExcerpt(article, 20);
  assert.doesNotMatch(out, /^waterfalls ribbon down cliffs/i);
  assert.match(out, /^[A-Z]/);
  assert.ok(isCompleteRelatedReadingExcerpt(out), `incomplete excerpt: ${out}`);
});

test('buildPortDetailHtml more-reading cards have readable excerpts', () => {
  const port = {
    slug: 'nassau-bahamas',
    name: 'Nassau',
    country: 'Bahamas',
    region: 'Caribbean',
    description: 'Nassau is a busy Caribbean cruise port with historic streets and beach access.',
  };
  const html = buildPortDetailHtml(port, [], [], [
    {
      slug: 'how-to-use-cruise-packing-list-for-caribbean',
      title: 'How to Use Cruise Packing List For Caribbean',
      excerpt: 'If cruise packing list for caribbean is what you need for shore days.',
      metaDescription: 'A Caribbean cruise packing list: sun, insects, medicines, and the power-strip rule.',
    },
  ], {
    baseUrl: 'https://seadays.app',
    defaultImage: 'https://seadays.app/logo.png',
    runtimeGuardScript: '',
    portGuide: null,
    portTerminals: [],
  });
  assert.match(html, /id="more-reading"/);
  assert.doesNotMatch(html, /is what\./i);
});

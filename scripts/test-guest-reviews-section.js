#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  buildGuestReviewsSectionHtml,
  hasRatedGuestReviews,
} = require('./lib/guestReviewsSection');
const { buildShipDetailHtml, buildPortDetailHtml } = require('./lib/seoShipPortPages');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

const pageOpts = {
  baseUrl: 'https://seadays.app',
  defaultImage: 'https://seadays.app/logo.png',
  indexStyles: '',
  runtimeGuardScript: '',
  appRoot: '',
  slugToAppPortId: new Map(),
  knownAffiliatePortIds: new Set(),
};

test('zero reviews shows empty state and download link, no stars', () => {
  const html = buildGuestReviewsSectionHtml({ name: 'Test Ship', rating: null, reviewCount: 0 });
  assert.ok(html.includes('No guest reviews yet'));
  assert.ok(html.includes('href="/download/"'));
  assert.ok(!html.includes('★'));
  assert.ok(!html.includes('☆'));
});

test('rating without count is treated as unrated', () => {
  assert.strictEqual(hasRatedGuestReviews({ rating: 4.5, reviewCount: 0 }), false);
  const html = buildGuestReviewsSectionHtml({ name: 'Port', rating: 4.5, reviewCount: 0 });
  assert.ok(html.includes('No guest reviews yet'));
});

test('rated aggregate shows stars and count only', () => {
  const html = buildGuestReviewsSectionHtml({ name: 'Rated Ship', rating: 4.2, reviewCount: 12 });
  assert.ok(html.includes('★'));
  assert.ok(html.includes('4.2'));
  assert.ok(html.includes('12 guest reviews'));
  assert.ok(!html.includes('No guest reviews yet'));
});

test('ship detail includes one guest reviews block after key facts', () => {
  const ship = {
    id: 'x',
    slug: 'test-ship',
    name: 'Test Ship',
    cruise_line: 'Test Line',
    shipClass: 'Test',
    rating: null,
    reviewCount: null,
  };
  const html = buildShipDetailHtml(ship, [], [], [], pageOpts);
  const matches = html.match(/id="guest-reviews"/g) || [];
  assert.strictEqual(matches.length, 1);
  const keyFactsIdx = html.indexOf('<h2>Key facts</h2>');
  const guestIdx = html.indexOf('id="guest-reviews"');
  const highlightsIdx = html.indexOf('<h2>Highlights</h2>');
  assert.ok(keyFactsIdx >= 0 && guestIdx > keyFactsIdx);
  if (highlightsIdx >= 0) assert.ok(guestIdx < highlightsIdx);
  assert.match(html, /<title>Test Ship Cruise Ship Guide \| Test Line<\/title>/);
  assert.doesNotMatch(html, /aggregateRating/);
});

test('port detail places guest reviews after quick facts', () => {
  const port = {
    id: 'p1',
    slug: 'test-port',
    name: 'Test Port',
    country: 'Canada',
    region: 'Atlantic',
    rating: 3.8,
    reviewCount: 2,
    highlights: [],
    description: 'A cruise port used for testing.',
  };
  const html = buildPortDetailHtml(port, [], [], [], {
    ...pageOpts,
    portGuide: {
      portInfo: { description: 'Guide lead for the port.' },
    },
    portTerminals: [],
    affiliate: { privateIsland: true },
  });
  const matches = html.match(/id="guest-reviews"/g) || [];
  assert.strictEqual(matches.length, 1);
  const quickIdx = html.indexOf('id="quick-facts"');
  const guestIdx = html.indexOf('id="guest-reviews"');
  assert.ok(quickIdx >= 0 && guestIdx > quickIdx);
  assert.ok(html.includes('2 guest reviews'));
  assert.match(html, /<link rel="canonical" href="https:\/\/seadays\.app\/ports\/test-port\/">/);
});

test('port jump nav links to guest reviews when section is present', () => {
  const port = {
    id: 'p1',
    slug: 'test-port',
    name: 'Test Port',
    country: 'Canada',
    region: 'Atlantic',
    rating: null,
    reviewCount: null,
    highlights: [],
    description: 'A cruise port used for testing.',
  };
  const html = buildPortDetailHtml(port, [], [], [], {
    ...pageOpts,
    portGuide: {
      portInfo: { description: 'Guide lead for the port.' },
    },
    portTerminals: [],
    affiliate: { privateIsland: true },
  });
  assert.ok(html.includes('class="port-jump"'));
  assert.ok(html.includes('href="#guest-reviews"'));
  assert.ok(html.includes('>Guest reviews</a>'));
});

console.log('guest reviews section tests: ok');

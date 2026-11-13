#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildShipDirectoryRatingHtml, buildShipsIndexHtml } = require('./generateBlogs');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('unrated ship has no rating placeholder html', () => {
  const html = buildShipDirectoryRatingHtml({ rating: null, reviewCount: 0 });
  assert.strictEqual(html, '');
  assert.ok(!html.includes('In-app rating'));
});

test('rating without review count is not shown', () => {
  const html = buildShipDirectoryRatingHtml({ rating: 4.2, reviewCount: 0 });
  assert.strictEqual(html, '');
});

test('valid rating and reviews render visual rating', () => {
  const html = buildShipDirectoryRatingHtml({ rating: 4.2, reviewCount: 12 });
  assert.ok(html.includes('rating-visual'));
  assert.ok(html.includes('4.2 / 5'));
  assert.ok(!html.includes('In-app rating'));
});

test('ships index cards keep navigation without placeholder', () => {
  const html = buildShipsIndexHtml({
    ships: [
      { slug: 'test-ship', name: 'Test Ship', cruise_line: 'Test Line', rating: null, reviewCount: 0 },
      { slug: 'rated-ship', name: 'Rated Ship', cruise_line: 'Test Line', rating: 4.5, reviewCount: 3 },
    ],
    articles: [],
    featuredGuideCardsHtml: '',
  });
  assert.ok(html.includes('shipsDirectoryCatalog'));
  assert.ok(html.includes('id="shipSearch"'));
  assert.ok(!html.includes('In-app rating'));
  assert.ok(html.includes('rating-visual') || html.includes('\\u003cspan class=\\"rating-visual\\"'), 'rated ships in catalog JSON');
});

const indexPath = path.join(__dirname, '..', 'ships', 'index.html');
test('committed ships index has no In-app rating label', () => {
  const html = fs.readFileSync(indexPath, 'utf8');
  assert.ok(!html.includes('In-app rating'), 'ships/index.html must not advertise in-app ratings');
  assert.ok(html.includes('ships-directory-v2'), 'ships directory v2 shell');
  assert.ok(html.includes('View ship guide →'), 'ship card CTA in client template');
});

console.log('ships directory rating tests: ok');

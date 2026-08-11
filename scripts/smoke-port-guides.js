#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const root = path.join(__dirname, '..');
const samples = ['hamburg-germany', 'barcelona-spain', 'vigo-spain', 'miami-fl-united-states'];
for (const slug of samples) {
  const html = fs.readFileSync(path.join(root, 'ports', slug, 'index.html'), 'utf8');
  assert.ok(html.includes(`https://seadays.app/ports/${slug}/`), `${slug} canonical`);
  assert.ok(html.includes('Bookable Experiences'), `${slug} booking`);
  assert.ok(html.includes('Traveler questions'), `${slug} questions`);
  assert.ok(html.includes('Reviews'), `${slug} reviews`);
  assert.ok(html.includes('Download on the App Store') || html.includes('Google Play'), `${slug} app cta`);
  assert.ok(!html.includes('service_role'), `${slug} no secrets`);
}
assert.ok(fs.existsSync(path.join(root, 'data', 'public-port-guides.json')));
assert.ok(fs.existsSync(path.join(root, 'data', 'public-port-terminals.json')));
const guides = JSON.parse(fs.readFileSync(path.join(root, 'data', 'public-port-guides.json'), 'utf8'));
assert.ok(guides.byAppPortId.hamburg);

// Phase 1 correction checks
const bcn = fs.readFileSync(path.join(root, 'ports', 'barcelona-spain', 'index.html'), 'utf8');
assert.ok(bcn.includes('id="things-to-do"'), 'barcelona things-to-do section');
assert.ok(bcn.includes('Standard call (about 6–8 hours ashore)'), 'barcelona 6-8h guidance');
assert.ok(!bcn.includes('Photography, markets, and neighborhood walks near'), 'barcelona no SEO template');
assert.ok(bcn.includes('viator.com'), 'barcelona viator');

const civ = fs.readFileSync(path.join(root, 'ports', 'rome-civitavecchia-italy', 'index.html'), 'utf8');
assert.ok(civ.includes('https://seadays.app/ports/rome-civitavecchia-italy/'), 'civitavecchia canonical url');
assert.ok(/Cruise terminals|id="cruise-terminals"/i.test(civ), 'civitavecchia terminals section');
assert.ok(civ.includes('Terminal Donato Bramante'), 'civitavecchia canonical Bramante');
assert.ok(civ.includes('Terminal 10'), 'civitavecchia Terminal 10');
assert.ok(civ.includes('Terminal 25 South'), 'civitavecchia Terminal 25 South');
assert.ok(!civ.includes('>Terminal Bramante (Pier 12)<'), 'civitavecchia removed short duplicate heading');
assert.ok(civ.includes('id="things-to-do"'), 'civitavecchia things-to-do section');
assert.ok(civ.includes('Standard call (about 6–8 hours ashore)'), 'civitavecchia 6-8h guidance');
assert.ok(!civ.includes('Photography, markets, and neighborhood walks near'), 'civitavecchia no SEO template filler');
assert.ok(civ.includes('Bookable Experiences'), 'civitavecchia bookable experiences');
assert.ok(civ.includes('viator.com'), 'civitavecchia viator mapping');

// CI regression: slug→guide ID must resolve without app review-key map
const {
  buildSlugToAppPortIdMap,
} = require('./lib/publicPortGuideAdapter');
const emptyReviewMap = new Map();
const slugMap = buildSlugToAppPortIdMap(
  [
    { slug: 'rome-civitavecchia-italy', name: 'Rome (Civitavecchia)', country: 'Italy' },
    { slug: 'barcelona-spain', name: 'Barcelona', country: 'Spain' },
    { slug: 'athens-piraeus-greece', name: 'Athens (Piraeus)', country: 'Greece' },
  ],
  emptyReviewMap,
  guides.byAppPortId || {}
);
assert.strictEqual(slugMap['rome-civitavecchia-italy'], 'civitavecchia', 'empty-map civitavecchia slug resolve');
assert.strictEqual(slugMap['barcelona-spain'], 'barcelona', 'empty-map barcelona slug resolve');
assert.strictEqual(slugMap['athens-piraeus-greece'], 'piraeus', 'empty-map piraeus slug resolve');

const val = fs.readFileSync(path.join(root, 'ports', 'valencia-spain', 'index.html'), 'utf8');
const berthsChunk = val.match(/Berths[\s\S]{0,120}/)?.[0] || '';
assert.ok(!/>\s*15\s*</.test(berthsChunk), 'valencia berths not 15');

assert.ok(!fs.existsSync(path.join(root, 'ports', 'amsterdam-netherlands')), 'amsterdam not invented');

console.log('smoke-port-guides PASS');

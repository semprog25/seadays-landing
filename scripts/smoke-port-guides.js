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
assert.ok(civ.includes('Terminal Donato Bramante'), 'civitavecchia canonical Bramante');
assert.ok(!civ.includes('>Terminal Bramante (Pier 12)<'), 'civitavecchia removed short duplicate heading');

const val = fs.readFileSync(path.join(root, 'ports', 'valencia-spain', 'index.html'), 'utf8');
const berthsChunk = val.match(/Berths[\s\S]{0,120}/)?.[0] || '';
assert.ok(!/>\s*15\s*</.test(berthsChunk), 'valencia berths not 15');

assert.ok(!fs.existsSync(path.join(root, 'ports', 'amsterdam-netherlands')), 'amsterdam not invented');

console.log('smoke-port-guides PASS');

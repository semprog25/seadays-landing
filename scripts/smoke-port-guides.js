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
console.log('smoke-port-guides PASS');

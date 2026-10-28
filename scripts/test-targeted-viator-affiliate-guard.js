'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { parseGenerateMode, assertTargetedPortAffiliateWritable } = require('./lib/generateMode');
const { resolvePortAffiliateCta } = require('./lib/viatorAffiliate');

const root = path.join(__dirname, '..');
const VIATOR = { pid: 'P00314321', mcid: '42383', medium: 'link', configured: true };
const UNCONFIGURED = { pid: '', mcid: '', medium: 'link', configured: false };

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('targeted halifax affiliate without env is blocked', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only', '--only=halifax-ns-canada']);
  const affiliate = resolvePortAffiliateCta(
    { slug: 'halifax-ns-canada', name: 'Halifax, NS, Canada', appPortId: 'halifax' },
    { knownPortIds: new Set(['halifax']), config: UNCONFIGURED }
  );
  assert.strictEqual(affiliate.show, true);
  assert.strictEqual(affiliate.url, null);
  assert.throws(
    () => assertTargetedPortAffiliateWritable(mode, affiliate, 'halifax-ns-canada'),
    /VIATOR_AFFILIATE_PID/
  );
});

test('targeted halifax with viator config keeps affiliate url', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only', '--only=halifax-ns-canada']);
  const affiliate = resolvePortAffiliateCta(
    { slug: 'halifax-ns-canada', name: 'Halifax, NS, Canada', appPortId: 'halifax' },
    { knownPortIds: new Set(['halifax']), config: VIATOR }
  );
  assert.ok(affiliate.url && affiliate.url.includes('viator.com'));
  assert.ok(affiliate.url.includes('campaign=seadays-web-phalifax'));
  assert.doesNotThrow(() => assertTargetedPortAffiliateWritable(mode, affiliate, 'halifax-ns-canada'));
});

test('targeted private island skips affiliate guard', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only', '--only=perfect-day-at-cococay-bahamas']);
  const affiliate = resolvePortAffiliateCta(
    { slug: 'perfect-day-at-cococay-bahamas', name: 'Perfect Day at CocoCay', appPortId: 'cococay' },
    { knownPortIds: new Set(['cococay']), config: UNCONFIGURED }
  );
  assert.strictEqual(affiliate.privateIsland, true);
  assert.doesNotThrow(() =>
    assertTargetedPortAffiliateWritable(mode, affiliate, 'perfect-day-at-cococay-bahamas')
  );
});

test('non-targeted mode does not enforce affiliate guard', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only']);
  const affiliate = resolvePortAffiliateCta(
    { slug: 'halifax-ns-canada', name: 'Halifax, NS, Canada', appPortId: 'halifax' },
    { knownPortIds: new Set(['halifax']), config: UNCONFIGURED }
  );
  assert.doesNotThrow(() => assertTargetedPortAffiliateWritable(mode, affiliate, 'halifax-ns-canada'));
});

const halifaxPath = path.join(root, 'ports', 'halifax-ns-canada', 'index.html');
const halifaxHtml = fs.readFileSync(halifaxPath, 'utf8');

test('published halifax keeps guest reviews and viator cta', () => {
  assert.ok(halifaxHtml.includes('id="guest-reviews"'));
  assert.ok(halifaxHtml.includes('href="#guest-reviews"'));
  assert.ok(halifaxHtml.includes('viator.com'));
  assert.ok(halifaxHtml.includes('campaign=seadays-web-phalifax'));
  assert.ok(halifaxHtml.includes('Secure checkout · Partner handled'));
  assert.ok(!halifaxHtml.includes('Continue in SeaDays →'));
  assert.ok(halifaxHtml.includes('id="more-reading"'));
});

test('halifax patch touches only bookable experiences block', () => {
  const before = fs.readFileSync(halifaxPath, 'utf8');
  const block = before.match(/<section class="pg-section pg-booking" id="bookable-experiences"[\s\S]*?<\/section>/);
  assert.ok(block, 'bookable-experiences section');
  const stripped = before.replace(block[0], '');
  assert.ok(stripped.includes('id="guest-reviews"'));
  assert.ok(stripped.includes('id="getting-there"'));
});

console.log('targeted viator affiliate guard ok');

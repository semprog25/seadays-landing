'use strict';
const assert = require('assert');
const {
  isShipDetailIndexable,
  isPortDetailIndexable,
  replaceRobotsMeta,
} = require('./lib/adsenseIndexability');

assert.strictEqual(isShipDetailIndexable({
  description: 'x'.repeat(300),
  confidenceScore: 0.8,
  hasContentOverride: true,
}), true);
assert.strictEqual(isShipDetailIndexable({
  description: 'short',
  confidenceScore: 0.9,
  hasContentOverride: true,
}), false);
assert.strictEqual(isShipDetailIndexable({
  description: 'x'.repeat(300),
  confidenceScore: 0.5,
  hasContentOverride: true,
}), false);
assert.strictEqual(isPortDetailIndexable({ name: 'Barcelona', country: 'Spain', description: 'y'.repeat(100) }, null), true);
assert.strictEqual(isPortDetailIndexable({ name: '', country: 'Spain' }, null), false);
const html = '<meta name="robots" content="index,follow">';
assert.ok(replaceRobotsMeta(html, 'noindex, follow').includes('noindex, follow'));
console.log('test-adsense-indexability: PASS');

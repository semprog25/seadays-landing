#!/usr/bin/env node
'use strict';

const assert = require('assert');
const bootstrap = require('./lib/googleCmpHeadBootstrap');
const { getAnalyticsHeadHtml } = require('./lib/analyticsSnippet');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('early head script is no-op unless integration flag is true', () => {
  const html = bootstrap.getGoogleCmpEarlyHeadScriptHtml();
  assert.match(html, /__SEADAYS_GOOGLE_CMP_INTEGRATION__\s*!==\s*true\)\s*return/);
});

test('early head uses official AdSense tag URL only', () => {
  const html = bootstrap.getGoogleCmpEarlyHeadScriptHtml();
  assert.match(html, /pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js/);
  assert.doesNotMatch(html, /fundingchoicesmessages\.google\.com/);
  assert.doesNotMatch(html, /gstatic\.com\/fc/);
});

test('early head registers googlefc callbackQueue before AdSense tag', () => {
  const html = bootstrap.getGoogleCmpEarlyHeadScriptHtml();
  const queueAt = html.indexOf('googlefc.callbackQueue');
  const adsAt = html.indexOf('adsbygoogle.js');
  assert.ok(queueAt > -1 && adsAt > queueAt);
});

test('early head pauses ad requests until SeaDays authorizes fill', () => {
  const html = bootstrap.getGoogleCmpEarlyHeadScriptHtml();
  assert.match(html, /pauseAdRequests\s*=\s*1/);
});

test('shared analytics snippet includes gated CMP bootstrap before gtag.js', () => {
  const snippet = getAnalyticsHeadHtml();
  const bootstrapAt = snippet.indexOf('__SEADAYS_GOOGLE_CMP_HEAD_BOOTSTRAP__');
  const gtagAt = snippet.indexOf('googletagmanager.com/gtag/js');
  assert.ok(bootstrapAt > -1 && gtagAt > bootstrapAt);
});

test('shouldUnpauseAdRequests only when flag on and ads consented', () => {
  assert.strictEqual(bootstrap.shouldUnpauseAdRequests(false, true), false);
  assert.strictEqual(bootstrap.shouldUnpauseAdRequests(true, false), false);
  assert.strictEqual(bootstrap.shouldUnpauseAdRequests(true, true), true);
});

console.log('\nAll google CMP head bootstrap tests passed.');

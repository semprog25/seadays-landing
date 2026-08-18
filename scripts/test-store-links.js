#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  ANDROID_PACKAGE_ID,
  IOS_APP_ID,
  PLAY_STORE_URL,
  APP_STORE_URL,
  sanitizeCampaign,
  playStoreUrl,
  appStoreUrl,
  downloadPagePath,
  stripRedundantCampaignParamsInHtml,
} = require('./lib/storeLinks');

assert.strictEqual(ANDROID_PACKAGE_ID, 'com.seadays.app');
assert.strictEqual(IOS_APP_ID, '6759758357');
assert.ok(PLAY_STORE_URL.includes('id=com.seadays.app'));
assert.ok(APP_STORE_URL.includes('id6759758357'));
assert.strictEqual(sanitizeCampaign('Reddit Cruise!!'), 'reddit_cruise');
assert.strictEqual(sanitizeCampaign('<script>'), 'organic_web');

const play = playStoreUrl({
  source: 'reddit',
  medium: 'cpc',
  campaign: 'reddit_cruise_planners',
});
assert.ok(play.startsWith('https://play.google.com/store/apps/details?id=com.seadays.app'));
assert.ok(play.includes('utm_campaign=reddit_cruise_planners'));
assert.ok(play.includes('referrer='));
assert.ok(!play.includes('id=com.seadays&') && !play.includes('id=com.seadays?'));

const apple = appStoreUrl({
  source: 'seadays_web',
  medium: 'nav',
  campaign: 'organic_nav',
});
assert.ok(apple.startsWith('https://apps.apple.com/app/id6759758357'));
assert.ok(apple.includes('ct=organic_nav'));
assert.ok(apple.includes('mt=8'));
assert.ok(!apple.includes('pt=') , 'pt omitted until App Store Connect token exists');

const path = downloadPagePath({ campaign: 'hamburg_port', medium: 'qr', source: 'offline' });
assert.ok(path.startsWith('/download/'));
assert.ok(path.includes('utm_source=offline'));
assert.ok(path.includes('utm_medium=qr'));
assert.ok(path.includes('utm_campaign=hamburg_port'));
assert.ok(!/[?&]campaign=/.test(path), 'website chrome must not duplicate campaign=');
assert.ok(!path.includes('apps.apple.com/app/seadays?'));

const footer = downloadPagePath({
  source: 'seadays_web',
  medium: 'footer',
  campaign: 'organic_web',
});
assert.strictEqual(
  footer,
  '/download/?utm_source=seadays_web&utm_medium=footer&utm_campaign=organic_web'
);

const compact = downloadPagePath({ campaign: 'hamburg_port', compact: true });
assert.strictEqual(compact, '/download/?campaign=hamburg_port');

const stripped = stripRedundantCampaignParamsInHtml(
  '<a href="/download/?utm_source=seadays_web&amp;utm_medium=footer&amp;utm_campaign=organic_web&amp;campaign=organic_web">Get SeaDays</a>'
);
assert.ok(stripped.includes('utm_campaign=organic_web'));
assert.ok(!/campaign=organic_web/.test(stripped.replace(/utm_campaign=organic_web/g, '')));
assert.strictEqual(
  stripRedundantCampaignParamsInHtml('<a href="/download/?campaign=hamburg_port">QR</a>'),
  '<a href="/download/?campaign=hamburg_port">QR</a>'
);

console.log('test-store-links: PASS');

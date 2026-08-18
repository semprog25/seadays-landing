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
assert.ok(path.includes('campaign=hamburg_port'));
assert.ok(!path.includes('apps.apple.com/app/seadays?'));

console.log('test-store-links: PASS');

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const cmp = require('./lib/seadaysGoogleCmp');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

const GRANTED = cmp.PURPOSE.GRANTED;
const DENIED = cmp.PURPOSE.DENIED;
const N_A = cmp.PURPOSE.NOT_APPLICABLE;
const UNKNOWN = cmp.PURPOSE.UNKNOWN;

test('integration disabled uses custom banner authority and localStorage', () => {
  const prefs = cmp.resolveEffectiveConsentPrefs({
    cmpEnabled: false,
    localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
  });
  assert.strictEqual(prefs.authority, 'custom_banner');
  assert.strictEqual(prefs.advertising, 'granted');
  assert.strictEqual(
    cmp.hasAdvertisingConsentForAds({
      cmpEnabled: false,
      localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
    }),
    true
  );
});

test('analytics granted alone never grants ads when disabled path', () => {
  assert.strictEqual(
    cmp.hasAdvertisingConsentForAds({
      cmpEnabled: false,
      localStoragePrefs: { analytics: 'granted', advertising: 'denied' },
    }),
    false
  );
});

test('CMP regulated ignores stale localStorage advertising', () => {
  const values = {
    analytics_storage: GRANTED,
    ad_storage: DENIED,
    ad_user_data: DENIED,
    ad_personalization: DENIED,
  };
  assert.strictEqual(cmp.isCmpRegulatedRegion(values), true);
  const prefs = cmp.resolveEffectiveConsentPrefs({
    cmpEnabled: true,
    localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
    consentModeValues: values,
  });
  assert.strictEqual(prefs.authority, 'google_cmp');
  assert.strictEqual(prefs.advertising, 'denied');
  assert.strictEqual(
    cmp.hasAdvertisingConsentForAds({
      cmpEnabled: true,
      localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
      consentModeValues: values,
      hasTcfApi: true,
    }),
    false
  );
});

test('CMP regulated requires TCF API for ad requests even if ad_storage granted', () => {
  const values = {
    analytics_storage: GRANTED,
    ad_storage: GRANTED,
    ad_user_data: GRANTED,
    ad_personalization: GRANTED,
  };
  assert.strictEqual(
    cmp.hasAdvertisingConsentForAds({
      cmpEnabled: true,
      localStoragePrefs: { advertising: 'denied' },
      consentModeValues: values,
      hasTcfApi: false,
    }),
    false
  );
  assert.strictEqual(
    cmp.hasAdvertisingConsentForAds({
      cmpEnabled: true,
      localStoragePrefs: { advertising: 'denied' },
      consentModeValues: values,
      hasTcfApi: true,
    }),
    true
  );
});

test('NOT_APPLICABLE region keeps custom banner and localStorage', () => {
  const values = {
    analytics_storage: N_A,
    ad_storage: N_A,
    ad_user_data: N_A,
    ad_personalization: N_A,
  };
  assert.strictEqual(cmp.isCmpRegulatedRegion(values), false);
  assert.strictEqual(
    cmp.shouldShowSeaDaysCustomBanner({
      cmpEnabled: true,
      consentModeValues: values,
    }),
    true
  );
  const prefs = cmp.resolveEffectiveConsentPrefs({
    cmpEnabled: true,
    localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
    consentModeValues: values,
  });
  assert.strictEqual(prefs.authority, 'custom_banner');
  assert.strictEqual(prefs.advertising, 'granted');
});

test('CMP load failure fails closed', () => {
  const prefs = cmp.resolveEffectiveConsentPrefs({
    cmpEnabled: true,
    cmpLoadFailed: true,
    localStoragePrefs: { analytics: 'granted', advertising: 'granted' },
  });
  assert.strictEqual(prefs.authority, 'cmp_fail_closed');
  assert.strictEqual(prefs.advertising, 'denied');
  assert.strictEqual(
    cmp.shouldShowSeaDaysCustomBanner({ cmpEnabled: true, cmpLoadFailed: true }),
    false
  );
});

test('app WebView keeps denied regardless of CMP', () => {
  const prefs = cmp.resolveEffectiveConsentPrefs({
    cmpEnabled: true,
    appClient: true,
    consentModeValues: {
      ad_storage: GRANTED,
      ad_user_data: GRANTED,
      ad_personalization: GRANTED,
    },
  });
  assert.strictEqual(prefs.authority, 'app_webview');
  assert.strictEqual(prefs.advertising, 'denied');
});

test('NPA when no TCF on legacy path; no NPA when CMP regulated + TCF + ads granted', () => {
  assert.strictEqual(
    cmp.shouldRequestNonPersonalizedAds({
      cmpEnabled: false,
      localStoragePrefs: { advertising: 'granted' },
      hasTcfApi: false,
    }),
    true
  );
  const values = {
    ad_storage: GRANTED,
    ad_user_data: GRANTED,
    ad_personalization: GRANTED,
  };
  assert.strictEqual(
    cmp.shouldRequestNonPersonalizedAds({
      cmpEnabled: true,
      localStoragePrefs: { advertising: 'granted' },
      consentModeValues: values,
      hasTcfApi: true,
    }),
    false
  );
});

test('production assets keep CMP integration flag off by default', () => {
  const analytics = fs.readFileSync(
    path.join(__dirname, '../assets/js/seadays-analytics.js'),
    'utf8'
  );
  assert.match(analytics, /__SEADAYS_GOOGLE_CMP_INTEGRATION__ === true/);
  assert.doesNotMatch(analytics, /__SEADAYS_GOOGLE_CMP_INTEGRATION__ = true/);
});

console.log('\nAll consent CMP integration tests passed.');

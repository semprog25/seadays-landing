'use strict';

/**
 * Google Privacy & messaging (googlefc) integration helpers.
 * Source of truth for consent authority rules — keep browser runtime aligned.
 * @see https://developers.google.com/interactive-media-ads/docs/sdks/html5/client-side/consent-mode
 */

const PURPOSE = {
  GRANTED: 'CONSENT_MODE_PURPOSE_STATUS_GRANTED',
  DENIED: 'CONSENT_MODE_PURPOSE_STATUS_DENIED',
  UNKNOWN: 'CONSENT_MODE_PURPOSE_STATUS_UNKNOWN',
  NOT_APPLICABLE: 'CONSENT_MODE_PURPOSE_STATUS_NOT_APPLICABLE',
  NOT_CONFIGURED: 'CONSENT_MODE_PURPOSE_STATUS_NOT_CONFIGURED',
};

const AD_PURPOSE_KEYS = ['ad_storage', 'ad_user_data', 'ad_personalization'];

function isGoogleCmpIntegrationEnabled(flag) {
  return flag === true;
}

function purposeStatus(values, key) {
  if (!values || typeof values !== 'object') return PURPOSE.UNKNOWN;
  var raw = values[key];
  if (typeof raw !== 'string') return PURPOSE.UNKNOWN;
  return raw;
}

/** European regulations path: googlefc reports purposes as applicable (not NOT_APPLICABLE). */
function isCmpRegulatedRegion(consentModeValues) {
  var adStorage = purposeStatus(consentModeValues, 'ad_storage');
  if (adStorage === PURPOSE.NOT_APPLICABLE) return false;
  if (adStorage === PURPOSE.NOT_CONFIGURED) return true;
  return true;
}

function isPurposeGranted(status) {
  return status === PURPOSE.GRANTED;
}

function consentModeUpdateFromGoogleValues(consentModeValues) {
  var analytics = purposeStatus(consentModeValues, 'analytics_storage');
  var adStorage = purposeStatus(consentModeValues, 'ad_storage');
  var adUser = purposeStatus(consentModeValues, 'ad_user_data');
  var adPers = purposeStatus(consentModeValues, 'ad_personalization');
  return {
    analytics_storage: isPurposeGranted(analytics) ? 'granted' : 'denied',
    ad_storage: isPurposeGranted(adStorage) ? 'granted' : 'denied',
    ad_user_data: isPurposeGranted(adUser) ? 'granted' : 'denied',
    ad_personalization: isPurposeGranted(adPers) ? 'granted' : 'denied',
  };
}

function prefsFromConsentModeUpdate(update) {
  var analyticsGranted = update && update.analytics_storage === 'granted';
  var adsGranted =
    update &&
    update.ad_storage === 'granted' &&
    update.ad_user_data === 'granted' &&
    update.ad_personalization === 'granted';
  return {
    analytics: analyticsGranted ? 'granted' : 'denied',
    advertising: adsGranted ? 'granted' : 'denied',
  };
}

function normalizeChoice(v) {
  return v === 'granted' || v === 'denied' ? v : null;
}

/**
 * Effective prefs for seadaysGetConsentPrefs / UI.
 * When CMP owns regulated region, localStorage must not override googlefc.
 */
function resolveEffectiveConsentPrefs(input) {
  var cmpEnabled = isGoogleCmpIntegrationEnabled(input && input.cmpEnabled);
  if (!cmpEnabled) {
    return {
      analytics: normalizeChoice(input && input.localStoragePrefs && input.localStoragePrefs.analytics) || 'denied',
      advertising:
        normalizeChoice(input && input.localStoragePrefs && input.localStoragePrefs.advertising) || 'denied',
      authority: 'custom_banner',
    };
  }

  if (input && input.appClient) {
    return { analytics: 'denied', advertising: 'denied', authority: 'app_webview' };
  }

  if (input && input.cmpLoadFailed) {
    return { analytics: 'denied', advertising: 'denied', authority: 'cmp_fail_closed' };
  }

  var regulated = isCmpRegulatedRegion(input && input.consentModeValues);
  if (regulated) {
    var update = consentModeUpdateFromGoogleValues(input.consentModeValues);
    var fromCmp = prefsFromConsentModeUpdate(update);
    return {
      analytics: fromCmp.analytics,
      advertising: fromCmp.advertising,
      authority: 'google_cmp',
    };
  }

  return {
    analytics: normalizeChoice(input && input.localStoragePrefs && input.localStoragePrefs.analytics) || 'denied',
    advertising:
      normalizeChoice(input && input.localStoragePrefs && input.localStoragePrefs.advertising) || 'denied',
    authority: 'custom_banner',
  };
}

function shouldShowSeaDaysCustomBanner(input) {
  var cmpEnabled = isGoogleCmpIntegrationEnabled(input && input.cmpEnabled);
  if (!cmpEnabled) return !(input && input.appClient);
  if (input && input.appClient) return false;
  if (input && input.cmpLoadFailed) return false;
  if (isCmpRegulatedRegion(input && input.consentModeValues)) return false;
  return true;
}

/**
 * Ad requests require explicit advertising prefs AND (when CMP regulated) IAB TCF API.
 * ad_storage alone is not treated as full TCF authorization.
 */
function hasAdvertisingConsentForAds(input) {
  var prefs = resolveEffectiveConsentPrefs(input);
  if (prefs.advertising !== 'granted') return false;

  var cmpEnabled = isGoogleCmpIntegrationEnabled(input && input.cmpEnabled);
  if (!cmpEnabled) return true;

  if (input && input.cmpLoadFailed) return false;

  var regulated = isCmpRegulatedRegion(input && input.consentModeValues);
  if (!regulated) return true;

  if (!(input && input.hasTcfApi)) return false;

  var values = input.consentModeValues || {};
  for (var i = 0; i < AD_PURPOSE_KEYS.length; i++) {
    if (!isPurposeGranted(purposeStatus(values, AD_PURPOSE_KEYS[i]))) return false;
  }
  return true;
}

function shouldRequestNonPersonalizedAds(input) {
  if (hasAdvertisingConsentForAds(input)) {
    var cmpEnabled = isGoogleCmpIntegrationEnabled(input && input.cmpEnabled);
    var regulated = cmpEnabled && isCmpRegulatedRegion(input && input.consentModeValues);
    if (regulated && input && input.hasTcfApi) return false;
  }
  if (input && input.hasTcfApi) return false;
  return true;
}

function shouldDeferLocalStorageConsentWrite(input) {
  var cmpEnabled = isGoogleCmpIntegrationEnabled(input && input.cmpEnabled);
  if (!cmpEnabled) return false;
  if (input && input.cmpLoadFailed) return true;
  return isCmpRegulatedRegion(input && input.consentModeValues);
}

module.exports = {
  PURPOSE,
  AD_PURPOSE_KEYS,
  isGoogleCmpIntegrationEnabled,
  isCmpRegulatedRegion,
  consentModeUpdateFromGoogleValues,
  prefsFromConsentModeUpdate,
  resolveEffectiveConsentPrefs,
  shouldShowSeaDaysCustomBanner,
  hasAdvertisingConsentForAds,
  shouldRequestNonPersonalizedAds,
  shouldDeferLocalStorageConsentWrite,
};

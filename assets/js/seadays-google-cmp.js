/**
 * Google Privacy & messaging (googlefc) bridge — inactive unless
 * window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ === true before seadays-analytics.js runs.
 */
(function () {
  'use strict';

  if (window.__SEADAYS_GOOGLE_CMP_BRIDGE__) return;
  window.__SEADAYS_GOOGLE_CMP_BRIDGE__ = true;

  var ENABLED = window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ === true;
  var LOAD_TIMEOUT_MS = 8000;
  var state = {
    enabled: ENABLED,
    ready: !ENABLED,
    loadFailed: false,
    regulated: false,
    consentModeValues: null,
  };

  function readGoogleConsentModeValues() {
    try {
      if (window.googlefc && typeof window.googlefc.getGoogleConsentModeValues === 'function') {
        return window.googlefc.getGoogleConsentModeValues() || null;
      }
    } catch (e) {}
    return null;
  }

  function refreshFromGoogleFc() {
    state.consentModeValues = readGoogleConsentModeValues();
    state.regulated = window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues);
    state.ready = true;
    state.loadFailed = false;
    if (typeof window.seadaysOnGoogleCmpReady === 'function') {
      window.seadaysOnGoogleCmpReady(state);
    }
  }

  function markLoadFailed() {
    state.loadFailed = true;
    state.ready = true;
    state.regulated = false;
    state.consentModeValues = null;
    if (typeof window.seadaysOnGoogleCmpReady === 'function') {
      window.seadaysOnGoogleCmpReady(state);
    }
  }

  function bootstrapGoogleFcCallbacks() {
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push({
      CONSENT_MODE_DATA_READY: function () {
        refreshFromGoogleFc();
      },
    });
    if (readGoogleConsentModeValues()) refreshFromGoogleFc();
  }

  function start() {
    if (!ENABLED) return;
    bootstrapGoogleFcCallbacks();
    window.setTimeout(function () {
      if (!state.ready) markLoadFailed();
    }, LOAD_TIMEOUT_MS);
  }

  window.seadaysGoogleCmpGetState = function () {
    return {
      enabled: state.enabled,
      ready: state.ready,
      loadFailed: state.loadFailed,
      regulated: state.regulated,
      consentModeValues: state.consentModeValues,
    };
  };

  window.seadaysGoogleCmpShowRevocation = function () {
    try {
      if (window.googlefc && typeof window.googlefc.showRevocationMessage === 'function') {
        window.googlefc.showRevocationMessage();
        return true;
      }
    } catch (e) {}
    return false;
  };

  var PURPOSE = {
    GRANTED: 'CONSENT_MODE_PURPOSE_STATUS_GRANTED',
    DENIED: 'CONSENT_MODE_PURPOSE_STATUS_DENIED',
    NOT_APPLICABLE: 'CONSENT_MODE_PURPOSE_STATUS_NOT_APPLICABLE',
    NOT_CONFIGURED: 'CONSENT_MODE_PURPOSE_STATUS_NOT_CONFIGURED',
  };
  var AD_KEYS = ['ad_storage', 'ad_user_data', 'ad_personalization'];

  window.seadaysGoogleCmpIsRegulatedRegion = function (values) {
    if (!values || typeof values !== 'object') return false;
    var adStorage = values.ad_storage;
    if (typeof adStorage !== 'string') return true;
    if (adStorage === PURPOSE.NOT_APPLICABLE) return false;
    return true;
  };

  function purposeStatus(values, key) {
    if (!values || typeof values !== 'object') return 'CONSENT_MODE_PURPOSE_STATUS_UNKNOWN';
    var raw = values[key];
    return typeof raw === 'string' ? raw : 'CONSENT_MODE_PURPOSE_STATUS_UNKNOWN';
  }

  function consentUpdateFromValues(values) {
    function granted(key) {
      return purposeStatus(values, key) === PURPOSE.GRANTED ? 'granted' : 'denied';
    }
    return {
      analytics_storage: granted('analytics_storage'),
      ad_storage: granted('ad_storage'),
      ad_user_data: granted('ad_user_data'),
      ad_personalization: granted('ad_personalization'),
    };
  }

  /** Keep aligned with scripts/lib/seadaysGoogleCmp.js */
  window.seadaysGoogleCmpResolveEffectivePrefs = function (localStoragePrefs, appClient) {
    if (!ENABLED) return null;
    if (appClient) return { analytics: 'denied', advertising: 'denied' };
    if (state.loadFailed) return { analytics: 'denied', advertising: 'denied' };
    if (window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues)) {
      var u = consentUpdateFromValues(state.consentModeValues);
      var adsOk =
        u.ad_storage === 'granted' && u.ad_user_data === 'granted' && u.ad_personalization === 'granted';
      return {
        analytics: u.analytics_storage === 'granted' ? 'granted' : 'denied',
        advertising: adsOk ? 'granted' : 'denied',
      };
    }
    var a = localStoragePrefs && localStoragePrefs.analytics;
    var d = localStoragePrefs && localStoragePrefs.advertising;
    return {
      analytics: a === 'granted' || a === 'denied' ? a : 'denied',
      advertising: d === 'granted' || d === 'denied' ? d : 'denied',
    };
  };

  window.seadaysGoogleCmpShouldShowCustomBanner = function (appClient) {
    if (!ENABLED || appClient) return false;
    if (state.loadFailed) return false;
    if (!state.ready) return false;
    return !window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues);
  };

  window.seadaysGoogleCmpHasAdvertisingConsent = function (localStoragePrefs, appClient) {
    var prefs = window.seadaysGoogleCmpResolveEffectivePrefs(localStoragePrefs, appClient);
    if (!prefs || prefs.advertising !== 'granted') return false;
    if (state.loadFailed) return false;
    if (window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues)) {
      if (typeof window.__tcfapi !== 'function') return false;
      var values = state.consentModeValues || {};
      for (var i = 0; i < AD_KEYS.length; i++) {
        if (purposeStatus(values, AD_KEYS[i]) !== PURPOSE.GRANTED) return false;
      }
    }
    return true;
  };

  window.seadaysGoogleCmpShouldRequestNpa = function (localStoragePrefs, appClient) {
    if (window.seadaysGoogleCmpHasAdvertisingConsent(localStoragePrefs, appClient)) {
      if (
        ENABLED &&
        window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues) &&
        typeof window.__tcfapi === 'function'
      ) {
        return false;
      }
    }
    if (typeof window.__tcfapi === 'function') return false;
    return true;
  };

  window.seadaysGoogleCmpShouldDeferLocalStorageWrite = function () {
    if (!ENABLED || state.loadFailed) return true;
    return window.seadaysGoogleCmpIsRegulatedRegion(state.consentModeValues);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

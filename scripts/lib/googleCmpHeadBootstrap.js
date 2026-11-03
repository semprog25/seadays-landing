'use strict';

/**
 * Early head bootstrap for Google Privacy & messaging (European regulations).
 * Official delivery: published AdSense tag loads messaging — see
 * https://developers.google.com/funding-choices/fc-api-docs
 * ("existing … AdSense tag deploys user messages once the message is published").
 *
 * Inactive unless window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ === true before this runs.
 */

const { ADSENSE_CLIENT_ID } = require('./adsenseConfig');

const ADSBYGOOGLE_BASE = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';
const ADSENSE_SCRIPT_ID = 'seadays-adsense-script';
const GOOGLE_CMP_BRIDGE_SRC = '/assets/js/seadays-google-cmp.js';

function isValidAdsenseClient(clientId) {
  return /^ca-pub-\d{10,}$/.test(String(clientId || '').trim());
}

/**
 * Inline script: registers googlefc.callbackQueue, pauses ad requests, loads bridge + AdSense tag.
 * No-op when integration flag is not true (production default).
 */
function getGoogleCmpEarlyHeadScriptHtml() {
  if (!isValidAdsenseClient(ADSENSE_CLIENT_ID)) return '';
  const client = ADSENSE_CLIENT_ID;
  return `<script>
(function(){
  if (window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ !== true) return;
  window.__SEADAYS_GOOGLE_CMP_HEAD_BOOTSTRAP__ = true;
  window.googlefc = window.googlefc || {};
  window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
  window.googlefc.callbackQueue.push({
    CONSENT_MODE_DATA_READY: function () {
      window.__SEADAYS_GOOGLE_CMP_CONSENT_MODE_READY__ = true;
      if (typeof window.seadaysOnGoogleCmpReady === 'function') window.seadaysOnGoogleCmpReady();
    }
  });
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.pauseAdRequests = 1;
  if (!document.getElementById('seadays-google-cmp-bridge')) {
    var bridge = document.createElement('script');
    bridge.id = 'seadays-google-cmp-bridge';
    bridge.src = '${GOOGLE_CMP_BRIDGE_SRC}';
    bridge.async = false;
    document.head.appendChild(bridge);
  }
  if (document.getElementById('${ADSENSE_SCRIPT_ID}')) return;
  var s = document.createElement('script');
  s.id = '${ADSENSE_SCRIPT_ID}';
  s.async = true;
  s.crossOrigin = 'anonymous';
  s.src = '${ADSBYGOOGLE_BASE}?client=' + encodeURIComponent('${client}');
  document.head.appendChild(s);
})();
</script>`;
}

function shouldUnpauseAdRequests(cmpEnabled, hasAdvertisingConsent) {
  return cmpEnabled === true && hasAdvertisingConsent === true;
}

module.exports = {
  ADSBYGOOGLE_BASE,
  ADSENSE_SCRIPT_ID,
  GOOGLE_CMP_BRIDGE_SRC,
  getGoogleCmpEarlyHeadScriptHtml,
  shouldUnpauseAdRequests,
  isValidAdsenseClient,
};

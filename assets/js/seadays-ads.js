/**
 * SeaDays AdSense runtime (manual units only — no Auto Ads).
 * Loads only when:
 *  - page contains .seadays-ad-slot
 *  - advertising consent is granted (Consent Mode ad_* signals)
 *  - slot has data-ad-client + data-ad-slot
 * Does not track ad impressions/clicks.
 */
(function () {
  'use strict';

  if (window.__SEADAYS_ADS_RUNTIME__) return;
  window.__SEADAYS_ADS_RUNTIME__ = true;

  var SCRIPT_ID = 'seadays-adsense-script';
  var SCRIPT_SRC = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js';

  function getSlots() {
    return Array.prototype.slice.call(
      document.querySelectorAll('.seadays-ad-slot[data-ad-placement="article-mid"]')
    );
  }

  function hasAdvertisingConsent() {
    try {
      if (typeof window.seadaysGetConsentPrefs === 'function') {
        var prefs = window.seadaysGetConsentPrefs();
        return prefs && prefs.advertising === 'granted';
      }
    } catch (e) {}
    return false;
  }

  function setSlotInactive(slot, inactive) {
    if (!slot) return;
    if (inactive) {
      slot.classList.add('seadays-ad-slot--inactive');
      slot.classList.remove('seadays-ad-slot--ready');
    } else {
      slot.classList.remove('seadays-ad-slot--inactive');
      slot.classList.add('seadays-ad-slot--ready');
    }
  }

  function ensureAdsByGoogle(clientId) {
    return new Promise(function (resolve, reject) {
      if (window.adsbygoogle && document.getElementById(SCRIPT_ID)) {
        resolve();
        return;
      }
      if (document.getElementById(SCRIPT_ID)) {
        document.getElementById(SCRIPT_ID).addEventListener('load', function () {
          resolve();
        });
        document.getElementById(SCRIPT_ID).addEventListener('error', reject);
        return;
      }
      var s = document.createElement('script');
      s.id = SCRIPT_ID;
      s.async = true;
      s.src = SCRIPT_SRC + '?client=' + encodeURIComponent(clientId);
      s.crossOrigin = 'anonymous';
      s.onload = function () {
        resolve();
      };
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function fillSlot(slot) {
    if (!slot || slot.getAttribute('data-ad-filled') === '1') return;
    var ins = slot.querySelector('ins.adsbygoogle');
    if (!ins) return;
    var client = (ins.getAttribute('data-ad-client') || '').trim();
    var unit = (ins.getAttribute('data-ad-slot') || '').trim();
    if (!/^ca-pub-\d{10,}$/.test(client) || !/^\d{5,}$/.test(unit)) return;

    setSlotInactive(slot, false);
    ensureAdsByGoogle(client)
      .then(function () {
        try {
          window.adsbygoogle = window.adsbygoogle || [];
          // Manual unit only — never enable_page_level_ads / Auto Ads.
          window.adsbygoogle.push({});
          slot.setAttribute('data-ad-filled', '1');
        } catch (e) {}
      })
      .catch(function () {
        setSlotInactive(slot, true);
      });
  }

  function syncAdSlots() {
    var slots = getSlots();
    if (!slots.length) return;

    if (!hasAdvertisingConsent()) {
      slots.forEach(function (slot) {
        setSlotInactive(slot, true);
      });
      return;
    }

    // Custom cookie banner is not an IAB TCF CMP. Until a Google-certified TCF
    // CMP is installed, request non-personalized ads only (EEA/UK policy-safe).
    window.adsbygoogle = window.adsbygoogle || [];
    if (typeof window.__tcfapi !== 'function') {
      window.adsbygoogle.requestNonPersonalizedAds = 1;
    }

    slots.forEach(function (slot) {
      fillSlot(slot);
    });
  }

  window.seadaysSyncAdSlots = syncAdSlots;

  function init() {
    syncAdSlots();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

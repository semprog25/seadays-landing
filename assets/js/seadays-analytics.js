/**
 * SeaDays website analytics runtime (GA4 + Consent Mode v2 + consent UI).
 * Depends on head snippet from scripts/lib/analyticsSnippet.js (gtag + consent defaults).
 *
 * Consent model (Germany/EEA-friendly):
 * - Defaults: all Consent Mode signals denied
 * - Analytics Accept does NOT grant advertising
 * - Advertising requires an explicit separate choice
 * - AdSense loads only via seadays-ads.js when advertising is granted
 */
(function () {
  'use strict';

  if (window.__SEADAYS_ANALYTICS_RUNTIME__) return;
  window.__SEADAYS_ANALYTICS_RUNTIME__ = true;

  var LEGACY_ANALYTICS_KEY = 'seadays_analytics_consent';
  var PREFS_KEY = 'seadays_consent_prefs_v2';
  var MEASUREMENT_ID = 'G-WSQDQ33QZD';
  var BANNER_ID = 'seadays-consent-banner';
  var ADS_SCRIPT_SRC = '/assets/js/seadays-ads.js';

  function normalizeChoice(v) {
    return v === 'granted' || v === 'denied' ? v : null;
  }

  function defaultPrefs() {
    return { analytics: null, advertising: null };
  }

  function readPrefs() {
    try {
      var raw = localStorage.getItem(PREFS_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            analytics: normalizeChoice(parsed.analytics),
            advertising: normalizeChoice(parsed.advertising)
          };
        }
      }
    } catch (e) {}

    // Migrate Phase 1 analytics-only preference. Never infer advertising from analytics.
    try {
      var legacy = localStorage.getItem(LEGACY_ANALYTICS_KEY);
      if (legacy === 'granted' || legacy === 'denied') {
        return { analytics: legacy, advertising: 'denied' };
      }
    } catch (e2) {}

    return defaultPrefs();
  }

  function writePrefs(prefs) {
    var next = {
      analytics: normalizeChoice(prefs && prefs.analytics) || 'denied',
      advertising: normalizeChoice(prefs && prefs.advertising) || 'denied'
    };
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      localStorage.setItem(LEGACY_ANALYTICS_KEY, next.analytics);
    } catch (e) {}
    return next;
  }

  function clearPrefs() {
    try {
      localStorage.removeItem(PREFS_KEY);
      localStorage.removeItem(LEGACY_ANALYTICS_KEY);
    } catch (e) {}
  }

  function ensureGtag() {
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== 'function') {
      window.gtag = function () {
        window.dataLayer.push(arguments);
      };
    }
    return window.gtag;
  }

  function updateConsentMode(prefs) {
    var analyticsGranted = prefs && prefs.analytics === 'granted';
    var adsGranted = prefs && prefs.advertising === 'granted';
    var gtag = ensureGtag();
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: adsGranted ? 'granted' : 'denied',
      ad_user_data: adsGranted ? 'granted' : 'denied',
      ad_personalization: adsGranted ? 'granted' : 'denied'
    });
  }

  function ensureAdsRuntime() {
    if (window.__SEADAYS_ADS_RUNTIME__) {
      if (typeof window.seadaysSyncAdSlots === 'function') window.seadaysSyncAdSlots();
      return;
    }
    if (document.querySelector('script[src="' + ADS_SCRIPT_SRC + '"]')) return;
    if (!document.querySelector('.seadays-ad-slot')) return;
    var s = document.createElement('script');
    s.src = ADS_SCRIPT_SRC;
    s.defer = true;
    s.onload = function () {
      if (typeof window.seadaysSyncAdSlots === 'function') window.seadaysSyncAdSlots();
    };
    document.head.appendChild(s);
  }

  function applyPrefs(prefs) {
    updateConsentMode(prefs);
    ensureAdsRuntime();
    if (typeof window.seadaysSyncAdSlots === 'function') window.seadaysSyncAdSlots();
  }

  function getConsentPrefs() {
    return readPrefs();
  }

  window.seadaysGetConsentPrefs = getConsentPrefs;

  function isRedirectOnlyPage() {
    if (document.querySelector('meta[http-equiv="refresh" i]')) return true;
    var path = (window.location.pathname || '').toLowerCase();
    return path === '/blog.html' || path === '/landing-page.html';
  }

  function injectBannerStyles() {
    if (document.getElementById('seadays-consent-styles')) return;
    var style = document.createElement('style');
    style.id = 'seadays-consent-styles';
    style.textContent =
      '#' + BANNER_ID + '{position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:16px;background:rgba(12,12,12,0.97);border-top:1px solid rgba(255,255,255,0.1);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;}' +
      '#' + BANNER_ID + ' .seadays-consent-inner{max-width:820px;margin:0 auto;display:flex;flex-wrap:wrap;gap:14px 18px;align-items:flex-start;justify-content:space-between;}' +
      '#' + BANNER_ID + ' .seadays-consent-copy{flex:1 1 280px;min-width:0;}' +
      '#' + BANNER_ID + ' .seadays-consent-text{margin:0;font-size:15px;line-height:1.45;color:rgba(255,255,255,0.9);font-weight:500;}' +
      '#' + BANNER_ID + ' .seadays-consent-text + .seadays-consent-text{margin-top:6px;font-size:14px;font-weight:400;color:rgba(255,255,255,0.72);}' +
      '#' + BANNER_ID + ' .seadays-consent-legal{margin:8px 0 0;font-size:12px;line-height:1.4;color:rgba(255,255,255,0.45);}' +
      '#' + BANNER_ID + ' .seadays-consent-legal a{color:rgba(255,255,255,0.55);font-weight:500;text-decoration:underline;text-underline-offset:2px;}' +
      '#' + BANNER_ID + ' .seadays-consent-legal a:hover{color:rgba(255,255,255,0.8);}' +
      '#' + BANNER_ID + ' .seadays-consent-actions{display:flex;flex-wrap:wrap;gap:10px;flex-shrink:0;max-width:100%;}' +
      '#' + BANNER_ID + ' button{min-height:44px;padding:10px 16px;border-radius:999px;font-weight:700;font-size:13px;cursor:pointer;border:1px solid transparent;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept-all{background:#FF0033;color:#fff;border-color:#FF0033;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept-all:hover{background:#cc0029;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept-analytics{background:rgba(255,255,255,0.08);color:#fff;border-color:rgba(255,255,255,0.28);}' +
      '#' + BANNER_ID + ' .seadays-consent-accept-analytics:hover{border-color:rgba(255,255,255,0.55);}' +
      '#' + BANNER_ID + ' .seadays-consent-decline{background:transparent;color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.28);}' +
      '#' + BANNER_ID + ' .seadays-consent-decline:hover{border-color:rgba(255,255,255,0.55);}' +
      '@media (max-width:600px){#' + BANNER_ID + '{padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));}#' + BANNER_ID + ' .seadays-consent-inner{flex-direction:column;align-items:stretch;gap:12px;}#' + BANNER_ID + ' .seadays-consent-actions{width:100%;}#' + BANNER_ID + ' button{flex:1 1 100%;}}';
    document.head.appendChild(style);
  }

  function hideBanner() {
    var el = document.getElementById(BANNER_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function showBanner() {
    if (document.getElementById(BANNER_ID) || isRedirectOnlyPage()) return;
    injectBannerStyles();
    var banner = document.createElement('div');
    banner.id = BANNER_ID;
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-live', 'polite');
    banner.setAttribute('aria-label', 'Cookie preferences');
    banner.innerHTML =
      '<div class="seadays-consent-inner">' +
      '<div class="seadays-consent-copy">' +
      '<p class="seadays-consent-text">We use cookies to improve your experience and understand how SeaDays is used.</p>' +
      '<p class="seadays-consent-text">You can allow analytics cookies and, separately, advertising cookies used for Google AdSense on some blog pages.</p>' +
      '<p class="seadays-consent-legal"><a href="/cookies.html">Cookie Policy</a> · <a href="/privacy.html">Privacy Policy</a></p>' +
      '</div>' +
      '<div class="seadays-consent-actions">' +
      '<button type="button" class="seadays-consent-decline" data-seadays-consent-choice="decline">Decline all</button>' +
      '<button type="button" class="seadays-consent-accept-analytics" data-seadays-consent-choice="analytics">Accept analytics</button>' +
      '<button type="button" class="seadays-consent-accept-all" data-seadays-consent-choice="all">Accept analytics &amp; ads</button>' +
      '</div></div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-seadays-consent-choice]');
      if (!btn) return;
      var choice = btn.getAttribute('data-seadays-consent-choice');
      var prefs;
      if (choice === 'all') {
        prefs = writePrefs({ analytics: 'granted', advertising: 'granted' });
      } else if (choice === 'analytics') {
        prefs = writePrefs({ analytics: 'granted', advertising: 'denied' });
      } else if (choice === 'decline') {
        prefs = writePrefs({ analytics: 'denied', advertising: 'denied' });
      } else {
        return;
      }
      applyPrefs(prefs);
      hideBanner();
    });
  }

  function hostnameOf(url) {
    try {
      return new URL(url, window.location.href).hostname;
    } catch (e) {
      return '';
    }
  }

  function isSeaDaysHost(host) {
    return host === 'seadays.app' || host === 'www.seadays.app' || host === 'auth.seadays.app';
  }

  function classifyStore(href) {
    var host = hostnameOf(href);
    if (host === 'play.google.com') return 'google_play';
    if (host === 'apps.apple.com') return 'app_store';
    return null;
  }

  function trackEvent(name, params) {
    var gtag = ensureGtag();
    var payload = params || {};
    payload.send_to = MEASUREMENT_ID;
    gtag('event', name, payload);
  }

  function isPrimaryCta(anchor) {
    if (!anchor || !anchor.classList) return false;
    var href = anchor.getAttribute('href') || '';
    if (anchor.classList.contains('cta-button')) return true;
    if (anchor.classList.contains('store-badge')) return true;
    if (anchor.classList.contains('download-primary')) return true;
    if (anchor.classList.contains('explore-seadays-link') && /download|get seadays/i.test(anchor.textContent || '')) return true;
    if (/\/download\/?/i.test(href)) return true;
    if (anchor.closest && anchor.closest('#download')) return true;
    if (anchor.closest && anchor.closest('.cta-section') && /play\.google|apps\.apple|#download|\/download/i.test(href)) return true;
    return false;
  }

  function bindClickTracking() {
    document.addEventListener(
      'click',
      function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
        // Never treat AdSense / ad iframe links as CTAs.
        if (a.closest && a.closest('.seadays-ad-slot, .adsbygoogle, ins.adsbygoogle')) return;
        var href = a.getAttribute('href') || '';
        if (!href || href.charAt(0) === '#' || href.indexOf('javascript:') === 0 || href.indexOf('mailto:') === 0) return;

        var store = classifyStore(href);
        if (store) {
          trackEvent('store_click', { store: store, link_url: href });
          return;
        }

        if (isPrimaryCta(a)) {
          trackEvent('cta_click', {
            link_url: href,
            link_text: (a.textContent || '').trim().slice(0, 80)
          });
          return;
        }

        var host = hostnameOf(href);
        if (host && !isSeaDaysHost(host) && /^https?:/i.test(a.href)) {
          trackEvent('outbound_click', { link_url: a.href, link_domain: host });
        }
      },
      true
    );
  }

  function openConsentSettings() {
    clearPrefs();
    applyPrefs({ analytics: 'denied', advertising: 'denied' });
    showBanner();
  }

  window.seadaysOpenCookieSettings = openConsentSettings;

  function isAppClientOpen() {
    try {
      var params = new URLSearchParams(window.location.search || '');
      var client = params.get('seadays_client') || '';
      return client === 'ios_app' || client === 'android_app' || client === 'app';
    } catch (e) {
      return false;
    }
  }

  function init() {
    // Opened from the SeaDays native app (SFSafariViewController / Custom Tab):
    // never show marketing cookie / advertising consent UI, and keep Consent Mode denied
    // for ad storage so ATT "Ask App Not to Track" is not undermined by a second cookie prompt.
    if (isAppClientOpen()) {
      applyPrefs({ analytics: 'denied', advertising: 'denied' });
      bindClickTracking();
      return;
    }

    var prefs = readPrefs();
    var hasDecision = prefs.analytics === 'granted' || prefs.analytics === 'denied';
    if (hasDecision) {
      prefs = writePrefs({
        analytics: prefs.analytics || 'denied',
        advertising: prefs.advertising || 'denied'
      });
      applyPrefs(prefs);
    } else {
      applyPrefs({ analytics: 'denied', advertising: 'denied' });
      showBanner();
    }
    bindClickTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

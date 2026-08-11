/**
 * SeaDays website analytics runtime (GA4 + Consent Mode v2 + lightweight consent UI).
 * Depends on head snippet from scripts/lib/analyticsSnippet.js (gtag + consent defaults).
 */
(function () {
  'use strict';

  if (window.__SEADAYS_ANALYTICS_RUNTIME__) return;
  window.__SEADAYS_ANALYTICS_RUNTIME__ = true;

  var STORAGE_KEY = 'seadays_analytics_consent';
  var MEASUREMENT_ID = 'G-WSQDQ33QZD';
  var BANNER_ID = 'seadays-consent-banner';

  function getStoredConsent() {
    try {
      var v = localStorage.getItem(STORAGE_KEY);
      if (v === 'granted' || v === 'denied') return v;
    } catch (e) {}
    return null;
  }

  function setStoredConsent(value) {
    try {
      if (value === 'granted' || value === 'denied') localStorage.setItem(STORAGE_KEY, value);
      else localStorage.removeItem(STORAGE_KEY);
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

  function updateConsent(analyticsGranted) {
    var gtag = ensureGtag();
    gtag('consent', 'update', {
      analytics_storage: analyticsGranted ? 'granted' : 'denied',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
  }

  function applyStoredConsent() {
    var stored = getStoredConsent();
    if (stored === 'granted') updateConsent(true);
    else if (stored === 'denied') updateConsent(false);
  }

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
      '#' + BANNER_ID + ' .seadays-consent-inner{max-width:720px;margin:0 auto;display:flex;flex-wrap:wrap;gap:14px 18px;align-items:center;justify-content:space-between;}' +
      '#' + BANNER_ID + ' .seadays-consent-copy{flex:1 1 260px;min-width:0;}' +
      '#' + BANNER_ID + ' .seadays-consent-text{margin:0;font-size:15px;line-height:1.45;color:rgba(255,255,255,0.9);font-weight:500;}' +
      '#' + BANNER_ID + ' .seadays-consent-text + .seadays-consent-text{margin-top:6px;font-size:14px;font-weight:400;color:rgba(255,255,255,0.72);}' +
      '#' + BANNER_ID + ' .seadays-consent-legal{margin:8px 0 0;font-size:12px;line-height:1.4;color:rgba(255,255,255,0.45);}' +
      '#' + BANNER_ID + ' .seadays-consent-legal a{color:rgba(255,255,255,0.55);font-weight:500;text-decoration:underline;text-underline-offset:2px;}' +
      '#' + BANNER_ID + ' .seadays-consent-legal a:hover{color:rgba(255,255,255,0.8);}' +
      '#' + BANNER_ID + ' .seadays-consent-actions{display:flex;flex-wrap:nowrap;gap:10px;flex-shrink:0;}' +
      '#' + BANNER_ID + ' button{min-height:44px;min-width:96px;padding:10px 18px;border-radius:999px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid transparent;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept{background:#FF0033;color:#fff;border-color:#FF0033;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept:hover{background:#cc0029;}' +
      '#' + BANNER_ID + ' .seadays-consent-decline{background:transparent;color:rgba(255,255,255,0.9);border-color:rgba(255,255,255,0.28);}' +
      '#' + BANNER_ID + ' .seadays-consent-decline:hover{border-color:rgba(255,255,255,0.55);}' +
      '@media (max-width:600px){#' + BANNER_ID + '{padding:14px 14px calc(14px + env(safe-area-inset-bottom,0px));}#' + BANNER_ID + ' .seadays-consent-inner{flex-direction:column;align-items:stretch;gap:12px;}#' + BANNER_ID + ' .seadays-consent-actions{width:100%;}#' + BANNER_ID + ' button{flex:1 1 0;}}';
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
      '<p class="seadays-consent-text">You can choose whether to allow analytics cookies.</p>' +
      '<p class="seadays-consent-legal"><a href="/cookies.html">Cookie Policy</a> · <a href="/privacy.html">Privacy Policy</a></p>' +
      '</div>' +
      '<div class="seadays-consent-actions">' +
      '<button type="button" class="seadays-consent-decline" data-seadays-consent="denied">Decline</button>' +
      '<button type="button" class="seadays-consent-accept" data-seadays-consent="granted">Accept</button>' +
      '</div></div>';
    document.body.appendChild(banner);
    banner.addEventListener('click', function (e) {
      var btn = e.target.closest('[data-seadays-consent]');
      if (!btn) return;
      var choice = btn.getAttribute('data-seadays-consent');
      if (choice !== 'granted' && choice !== 'denied') return;
      setStoredConsent(choice);
      updateConsent(choice === 'granted');
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
    if (anchor.classList.contains('cta-button')) return true;
    if (anchor.classList.contains('store-badge')) return true;
    if (anchor.classList.contains('explore-seadays-link') && /download/i.test(anchor.textContent || '')) return true;
    if (anchor.closest && anchor.closest('#download')) return true;
    if (anchor.closest && anchor.closest('.cta-section') && /play\.google|apps\.apple|#download/i.test(anchor.getAttribute('href') || '')) return true;
    return false;
  }

  function bindClickTracking() {
    document.addEventListener(
      'click',
      function (e) {
        var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
        if (!a) return;
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
    setStoredConsent(null);
    updateConsent(false);
    showBanner();
  }

  window.seadaysOpenCookieSettings = openConsentSettings;

  function init() {
    applyStoredConsent();
    bindClickTracking();
    if (!getStoredConsent()) showBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

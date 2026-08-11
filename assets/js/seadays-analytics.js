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
      '#' + BANNER_ID + '{position:fixed;left:0;right:0;bottom:0;z-index:99999;padding:14px 16px;background:rgba(10,10,10,0.96);border-top:1px solid rgba(255,0,51,0.35);box-shadow:0 -8px 32px rgba(0,0,0,0.45);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#fff;}' +
      '#' + BANNER_ID + ' .seadays-consent-inner{max-width:960px;margin:0 auto;display:flex;flex-wrap:wrap;gap:12px 16px;align-items:center;justify-content:space-between;}' +
      '#' + BANNER_ID + ' .seadays-consent-copy{flex:1 1 280px;font-size:14px;line-height:1.5;color:rgba(255,255,255,0.85);}' +
      '#' + BANNER_ID + ' .seadays-consent-copy a{color:#FF0033;font-weight:600;text-decoration:none;}' +
      '#' + BANNER_ID + ' .seadays-consent-copy a:hover{text-decoration:underline;}' +
      '#' + BANNER_ID + ' .seadays-consent-actions{display:flex;flex-wrap:wrap;gap:10px;}' +
      '#' + BANNER_ID + ' button{min-height:44px;padding:10px 16px;border-radius:999px;font-weight:700;font-size:14px;cursor:pointer;border:1px solid transparent;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept{background:#FF0033;color:#fff;border-color:#FF0033;}' +
      '#' + BANNER_ID + ' .seadays-consent-accept:hover{background:#cc0029;}' +
      '#' + BANNER_ID + ' .seadays-consent-decline{background:transparent;color:#fff;border-color:rgba(255,255,255,0.28);}' +
      '#' + BANNER_ID + ' .seadays-consent-decline:hover{border-color:rgba(255,255,255,0.55);}' +
      '@media (max-width:600px){#' + BANNER_ID + ' .seadays-consent-actions{width:100%;}#' + BANNER_ID + ' button{flex:1 1 auto;}}';
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
    banner.setAttribute('aria-label', 'Cookie and analytics consent');
    banner.innerHTML =
      '<div class="seadays-consent-inner">' +
      '<div class="seadays-consent-copy">' +
      'We use Google Analytics (GA4) to understand how visitors use seadays.app. Analytics cookies are used only if you Accept. ' +
      '<a href="/cookies.html">Cookie Policy</a> · <a href="/privacy.html">Privacy Policy</a>' +
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

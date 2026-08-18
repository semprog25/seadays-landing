/**
 * SeaDays download routing + campaign tracking (website only).
 * Rewrites real store URLs with campaign params. Never invents store IDs.
 * Does not auto-redirect to stores (no misleading jumps).
 */
(function () {
  'use strict';

  if (window.__SEADAYS_DOWNLOAD_RUNTIME__) return;
  window.__SEADAYS_DOWNLOAD_RUNTIME__ = true;

  var ANDROID_PACKAGE_ID = 'com.seadays.app';
  var IOS_APP_ID = '6759758357';
  var PLAY_STORE = 'https://play.google.com/store/apps/details?id=' + ANDROID_PACKAGE_ID;
  var APP_STORE = 'https://apps.apple.com/app/id' + IOS_APP_ID;
  var SESSION_KEY = 'seadays_acq_v1';
  var CAMPAIGN_RE = /^[a-z0-9][a-z0-9_]{1,63}$/;

  function campaignSafe(value, fallback) {
    var input = String(value || '');
    if (/[<>]|javascript:/i.test(input)) return fallback || 'organic_web';
    var raw = input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 64);
    return CAMPAIGN_RE.test(raw) ? raw : fallback || 'organic_web';
  }

  function tokenSafe(value, max) {
    var raw = String(value || '').trim().slice(0, max || 40);
    return /^[A-Za-z0-9._-]{1,64}$/.test(raw) ? raw : '';
  }

  function detectPlatform() {
    var ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua)) return 'ios';
    if (/Android/i.test(ua)) return 'android';
    return 'desktop';
  }

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && parsed.campaign) return parsed;
    } catch (e) {}
    return null;
  }

  function writeSession(tracking) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(tracking));
    } catch (e) {}
  }

  /**
   * Canonical website links use utm_campaign only.
   * Compact QR/print links use campaign only.
   * Older duplicated URLs (both keys, same value) still work.
   */
  function trackingFromSearch() {
    var params = new URLSearchParams(window.location.search || '');
    var campaign = params.get('campaign') || params.get('utm_campaign') || params.get('ct') || '';
    var source = params.get('utm_source') || params.get('source') || '';
    var medium = params.get('utm_medium') || params.get('medium') || '';
    var content = params.get('utm_content') || '';
    var term = params.get('utm_term') || '';
    var pt = params.get('pt') || '';
    if (!campaign && !source && !medium) return null;
    return {
      source: tokenSafe(source, 40) || 'seadays_web',
      medium: tokenSafe(medium, 40) || (campaign ? 'campaign' : 'web'),
      campaign: campaignSafe(campaign, 'organic_web'),
      content: tokenSafe(content, 64),
      term: tokenSafe(term, 64),
      applePt: tokenSafe(pt, 20)
    };
  }

  function pageDefaults() {
    var path = (window.location.pathname || '/').toLowerCase();
    if (path === '/' || path === '/index.html') {
      return { source: 'seadays_web', medium: 'hero', campaign: 'organic_hero' };
    }
    if (path.indexOf('/download') === 0) {
      return { source: 'seadays_web', medium: 'download', campaign: 'organic_web' };
    }
    if (path.indexOf('/blog/') === 0) {
      return { source: 'seadays_web', medium: 'blog', campaign: 'blog' };
    }
    if (path.indexOf('/ships/') === 0) {
      return { source: 'seadays_web', medium: 'ship_guide', campaign: 'ship_guide' };
    }
    if (path.indexOf('/ports/') === 0) {
      return { source: 'seadays_web', medium: 'port_guide', campaign: 'port_guide' };
    }
    if (
      path.indexOf('/cruise-planner') === 0 ||
      path.indexOf('/cruise-roll-calls') === 0 ||
      path.indexOf('/cruise-community') === 0 ||
      path.indexOf('/cruise-budget') === 0 ||
      path.indexOf('/cruise-drink') === 0
    ) {
      return { source: 'seadays_web', medium: 'feature', campaign: 'feature_landing' };
    }
    return { source: 'seadays_web', medium: 'web', campaign: 'organic_web' };
  }

  function resolveTracking() {
    var fromUrl = trackingFromSearch();
    if (fromUrl) {
      writeSession(fromUrl);
      return fromUrl;
    }
    var existing = readSession();
    if (existing) return existing;
    return pageDefaults();
  }

  function playUrl(t) {
    var referrer =
      'utm_source=' +
      encodeURIComponent(t.source) +
      '&utm_medium=' +
      encodeURIComponent(t.medium) +
      '&utm_campaign=' +
      encodeURIComponent(t.campaign);
    if (t.content) referrer += '&utm_content=' + encodeURIComponent(t.content);
    var url = new URL(PLAY_STORE);
    url.searchParams.set('utm_source', t.source);
    url.searchParams.set('utm_medium', t.medium);
    url.searchParams.set('utm_campaign', t.campaign);
    if (t.content) url.searchParams.set('utm_content', t.content);
    url.searchParams.set('referrer', referrer);
    return url.toString();
  }

  function appleUrl(t) {
    var url = new URL(APP_STORE);
    url.searchParams.set('utm_source', t.source);
    url.searchParams.set('utm_medium', t.medium);
    url.searchParams.set('utm_campaign', t.campaign);
    url.searchParams.set('ct', t.campaign);
    url.searchParams.set('mt', '8');
    if (t.applePt) url.searchParams.set('pt', t.applePt);
    if (t.content) url.searchParams.set('utm_content', t.content);
    return url.toString();
  }

  function isStoreHref(href) {
    return /play\.google\.com\/store\/apps\/details\?id=com\.seadays\.app/i.test(href) ||
      /apps\.apple\.com\/.*id6759758357/i.test(href);
  }

  function rewriteStoreAnchors(tracking) {
    var play = playUrl(tracking);
    var apple = appleUrl(tracking);
    var anchors = document.querySelectorAll('a[href*="play.google.com/store/apps/details"], a[href*="apps.apple.com"]');
    for (var i = 0; i < anchors.length; i++) {
      var a = anchors[i];
      var href = a.getAttribute('href') || '';
      if (!isStoreHref(href)) continue;
      if (/play\.google\.com/i.test(href)) a.setAttribute('href', play);
      else a.setAttribute('href', apple);
    }

    var playNodes = document.querySelectorAll('[data-seadays-store="play"]');
    for (var p = 0; p < playNodes.length; p++) playNodes[p].setAttribute('href', play);
    var appleNodes = document.querySelectorAll('[data-seadays-store="apple"]');
    for (var q = 0; q < appleNodes.length; q++) appleNodes[q].setAttribute('href', apple);
  }

  function applyPlatformUi(platform) {
    document.documentElement.setAttribute('data-seadays-platform', platform);
    var androidOnly = document.querySelectorAll('[data-platform-show="android"]');
    var iosOnly = document.querySelectorAll('[data-platform-show="ios"]');
    var desktopOnly = document.querySelectorAll('[data-platform-show="desktop"]');
    function show(nodes, on) {
      for (var i = 0; i < nodes.length; i++) nodes[i].hidden = !on;
    }
    show(androidOnly, platform === 'android');
    show(iosOnly, platform === 'ios');
    show(desktopOnly, platform === 'desktop');
  }

  function track(name, params) {
    if (typeof window.gtag !== 'function') return;
    var payload = params || {};
    payload.send_to = 'G-WSQDQ33QZD';
    window.gtag('event', name, payload);
  }

  function renderQr(tracking) {
    var img = document.getElementById('seadays-download-qr');
    var caption = document.getElementById('seadays-download-qr-caption');
    if (!img) return;
    var campaign = tracking.campaign || 'organic_web';
    img.src = '/download/qr/' + encodeURIComponent(campaign) + '.svg';
    img.alt = 'QR code to download SeaDays (' + campaign + ')';
    img.onerror = function () {
      img.src = '/download/qr/organic_web.svg';
      img.onerror = function () {
        img.hidden = true;
      };
    };
    if (caption) caption.textContent = 'Scan to open this download page · ' + campaign;
  }

  function fillCopy(tracking, platform) {
    var exp = '';
    try {
      exp = new URLSearchParams(window.location.search || '').get('exp') || '';
    } catch (e) {}
    var h1 = document.querySelector('.download-card h1');
    if (h1 && exp === 'companion') h1.textContent = 'Your Complete Cruise Companion';
    if (h1 && exp === 'ship-port') h1.textContent = 'Know Your Ship. Plan Every Port.';
    var campaignEl = document.getElementById('seadays-download-campaign');
    if (campaignEl) campaignEl.textContent = tracking.campaign;
    var primary = document.getElementById('seadays-download-primary');
    if (!primary) return;
    if (platform === 'android') {
      primary.setAttribute('href', playUrl(tracking));
      primary.textContent = 'Get SeaDays on Google Play';
    } else if (platform === 'ios') {
      primary.setAttribute('href', appleUrl(tracking));
      primary.textContent = 'Get SeaDays on the App Store';
    } else {
      primary.setAttribute('href', '#store-badges');
      primary.textContent = 'Get SeaDays';
    }
  }

  function init() {
    var tracking = resolveTracking();
    var platform = detectPlatform();
    window.__SEADAYS_ACQUISITION__ = { tracking: tracking, platform: platform };
    document.documentElement.setAttribute('data-seadays-campaign', tracking.campaign);
    rewriteStoreAnchors(tracking);
    applyPlatformUi(platform);
    renderQr(tracking);
    fillCopy(tracking, platform);

    var path = (window.location.pathname || '').toLowerCase();
    if (path.indexOf('/download') === 0) {
      track('download_page_view', {
        campaign: tracking.campaign,
        source: tracking.source,
        medium: tracking.medium,
        platform: platform
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

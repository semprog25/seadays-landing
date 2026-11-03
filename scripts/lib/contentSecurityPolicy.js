'use strict';

/**
 * Single source for SeaDays landing CSP (meta tag + CDN _headers template).
 * GitHub Pages serves meta CSP only on selected root pages; see inject-csp-meta.js.
 */

const FUNDING_CHOICES_ORIGIN = 'https://fundingchoicesmessages.google.com';

function buildBasePolicyParts() {
  return [
    "default-src 'self'",
    [
      "script-src 'self' 'unsafe-inline'",
      'https://www.googletagmanager.com',
      'https://www.google-analytics.com',
      'https://unpkg.com',
      'https://pagead2.googlesyndication.com',
      FUNDING_CHOICES_ORIGIN,
    ].join(' '),
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data:",
      'https://auth.seadays.app',
      'https://soqkgrfzluewpuiguypm.supabase.co',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://pagead2.googlesyndication.com',
    ].join(' '),
    [
      "connect-src 'self'",
      'https://soqkgrfzluewpuiguypm.supabase.co',
      'https://auth.seadays.app',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://region1.google-analytics.com',
      'https://pagead2.googlesyndication.com',
      FUNDING_CHOICES_ORIGIN,
    ].join(' '),
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    ["form-action 'self'", 'https://soqkgrfzluewpuiguypm.supabase.co'].join(' '),
    'upgrade-insecure-requests',
  ];
}

function joinPolicyParts(parts) {
  return parts.join('; ');
}

/** Meta tag and page-embedded CSP (no frame-src; matches pre-PR shape + Funding Choices). */
function getContentSecurityPolicyMetaDirectives() {
  return joinPolicyParts(buildBasePolicyParts());
}

/** CDN _headers CSP includes frame-src for ads and Funding Choices UI. */
function getContentSecurityPolicyDirectives() {
  const parts = buildBasePolicyParts();
  parts.splice(
    parts.indexOf("font-src 'self'") + 1,
    0,
    [
      'frame-src',
      'https://googleads.g.doubleclick.net',
      'https://tpc.googlesyndication.com',
      'https://www.google.com',
      FUNDING_CHOICES_ORIGIN,
    ].join(' ')
  );
  return joinPolicyParts(parts);
}

function getContentSecurityPolicyMetaHtml() {
  const policy = getContentSecurityPolicyMetaDirectives();
  return `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
}

const CSP_META_RE =
  /<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>\s*/gi;

function injectContentSecurityPolicyMeta(html) {
  if (!html || typeof html !== 'string') return html;
  const meta = getContentSecurityPolicyMetaHtml();
  const policy = getContentSecurityPolicyMetaDirectives();
  const existing = html.match(/<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>/i);
  if (existing && existing[0].includes(policy)) return html;
  let next = html.replace(CSP_META_RE, '');
  const charsetMatch = next.match(/<meta\s+charset=["']?UTF-8["']?\s*\/?>/i);
  if (charsetMatch && charsetMatch.index != null) {
    const at = charsetMatch.index + charsetMatch[0].length;
    return next.slice(0, at) + '\n' + meta + '\n' + next.slice(at);
  }
  const viewportMatch = next.match(/<meta\s+name=["']viewport["'][^>]*>/i);
  if (viewportMatch && viewportMatch.index != null) {
    const at = viewportMatch.index;
    return next.slice(0, at) + meta + '\n\n' + next.slice(at);
  }
  const headMatch = next.match(/<head[^>]*>/i);
  if (headMatch && headMatch.index != null) {
    const at = headMatch.index + headMatch[0].length;
    return next.slice(0, at) + '\n' + meta + '\n' + next.slice(at);
  }
  return meta + '\n' + next;
}

function getContentSecurityPolicyHeaderValue(options) {
  const opts = options || {};
  let policy = getContentSecurityPolicyDirectives();
  if (opts.frameAncestorsNone) {
    policy += "; frame-ancestors 'none'";
  }
  return policy;
}

module.exports = {
  FUNDING_CHOICES_ORIGIN,
  getContentSecurityPolicyDirectives,
  getContentSecurityPolicyMetaDirectives,
  getContentSecurityPolicyHeaderValue,
  getContentSecurityPolicyMetaHtml,
  injectContentSecurityPolicyMeta,
};

'use strict';

/**
 * Single source for SeaDays landing CSP (meta tag + CDN _headers template).
 * GitHub Pages serves meta CSP only on selected root pages; see inject-csp-meta.js.
 *
 * ponytail: Chromium caps meta http-equiv CSP around ~769 chars; meta policy trims
 * non-essential entries (upgrade-insecure-requests, duplicate GA script host) to fit FC.
 */

const FUNDING_CHOICES_ORIGIN = 'https://fundingchoicesmessages.google.com';
const META_CSP_MAX_LENGTH = 769;

function buildPolicyParts(options) {
  const opts = options || {};
  const scriptSrc = [
    "script-src 'self' 'unsafe-inline'",
    'https://www.googletagmanager.com',
    'https://unpkg.com',
    'https://pagead2.googlesyndication.com',
    FUNDING_CHOICES_ORIGIN,
  ];
  if (!opts.forMeta) {
    scriptSrc.splice(2, 0, 'https://www.google-analytics.com');
  }

  const connectSrc = [
    "connect-src 'self'",
    'https://soqkgrfzluewpuiguypm.supabase.co',
    'https://auth.seadays.app',
    'https://www.google-analytics.com',
    'https://www.googletagmanager.com',
    'https://pagead2.googlesyndication.com',
    FUNDING_CHOICES_ORIGIN,
  ];
  if (!opts.forMeta) {
    connectSrc.splice(5, 0, 'https://region1.google-analytics.com');
  }

  const parts = [
    "default-src 'self'",
    scriptSrc.join(' '),
    "style-src 'self' 'unsafe-inline'",
    [
      "img-src 'self' data:",
      'https://auth.seadays.app',
      'https://soqkgrfzluewpuiguypm.supabase.co',
      'https://www.google-analytics.com',
      'https://www.googletagmanager.com',
      'https://pagead2.googlesyndication.com',
    ].join(' '),
    connectSrc.join(' '),
    "font-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    ["form-action 'self'", 'https://soqkgrfzluewpuiguypm.supabase.co'].join(' '),
  ];

  if (!opts.forMeta) {
    parts.push('upgrade-insecure-requests');
  }

  if (opts.forHeader) {
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
  }

  return parts;
}

function joinPolicyParts(parts) {
  return parts.join('; ');
}

/** Full policy for CDN _headers (may exceed meta length cap). */
function getContentSecurityPolicyDirectives() {
  return joinPolicyParts(buildPolicyParts({ forHeader: true }));
}

/** Policy embedded in HTML meta tags (Chromium length cap). */
function getContentSecurityPolicyMetaDirectives() {
  return joinPolicyParts(buildPolicyParts({ forMeta: true }));
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
  META_CSP_MAX_LENGTH,
  getContentSecurityPolicyDirectives,
  getContentSecurityPolicyMetaDirectives,
  getContentSecurityPolicyHeaderValue,
  getContentSecurityPolicyMetaHtml,
  injectContentSecurityPolicyMeta,
};

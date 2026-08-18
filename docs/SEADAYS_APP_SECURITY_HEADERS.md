# seadays.app HTTP security headers

**Status (17 August 2026):** Not live. GitHub Pages + GitHub’s Fastly cache does not allow custom response headers from this repository.

## What was verified

```
dig NS seadays.app  →  shades05.rzone.de / docks07.rzone.de  (Strato)
dig A  seadays.app  →  185.199.108.153                     (GitHub Pages)
curl -sI https://seadays.app/
  HTTP/2 200
  server: GitHub.com
  via: 1.1 varnish
  x-served-by: cache-ams-…  (GitHub Pages Fastly)
  access-control-allow-origin: *
  (no CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy)
```

A `<meta http-equiv="Content-Security-Policy">` tag is **not** HSTS, **not** `X-Frame-Options`, and **not** `frame-ancestors`. Browsers ignore those as meta tags.

The `_headers` file in this repo is for Cloudflare Pages / Netlify. **GitHub Pages ignores it.**

## Safest practical architecture (do not apply from this repo)

Keep GitHub Pages as origin. Put a DNS proxy that can set response headers in front of `seadays.app` (typical: Cloudflare orange-cloud on the apex `A`/`AAAA` / `CNAME`).

Do **not** change nameservers or DNS from an agent session. An operator must:

1. Add the zone in Cloudflare (or equivalent) without changing product URLs.
2. Point `seadays.app` at GitHub Pages as origin (same 185.199.x.x / `seadays.github.io` pattern already in use).
3. Enable HTTPS (already true today via GitHub Pages).
4. Add a **Response Header Transform Rule** (or equivalent) for `https://seadays.app/*`.

### Headers to set on the CDN

```
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://unpkg.com https://pagead2.googlesyndication.com;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data: https://auth.seadays.app https://soqkgrfzluewpuiguypm.supabase.co https://www.google-analytics.com https://www.googletagmanager.com https://pagead2.googlesyndication.com;
  connect-src 'self' https://soqkgrfzluewpuiguypm.supabase.co https://auth.seadays.app https://www.google-analytics.com https://www.googletagmanager.com https://region1.google-analytics.com https://pagead2.googlesyndication.com;
  font-src 'self';
  frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://www.google.com;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self' https://soqkgrfzluewpuiguypm.supabase.co;
  object-src 'none';
  upgrade-insecure-requests

Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), usb=()
```

### Why `'unsafe-inline'` remains

Marketing HTML still contains inline `<script>` (Consent Mode bootstrap, homepage blog grid, Lucide `createIcons`, JSON-LD is `application/ld+json` and is not JS). GitHub Pages cannot issue CSP nonces. Removing `'unsafe-inline'` without extracting those scripts will blank the homepage.

`unsafe-eval` is **not** required and must stay absent.

### After CDN cutover

Re-run `curl -sI https://seadays.app/` and confirm each header above. Only then may the public Security page claim HTTP security headers.

## Local `_headers` file

`/_headers` matches the CDN policy for a future Cloudflare Pages or Netlify host. It has no effect on current GitHub Pages.

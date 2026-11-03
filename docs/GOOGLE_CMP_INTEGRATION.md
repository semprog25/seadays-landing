# Google Privacy & messaging (CMP) integration

**Status:** Code present, **disabled in production** (`window.__SEADAYS_GOOGLE_CMP_INTEGRATION__` is not set to `true` on any page).

## Architecture

| Layer | Role |
|-------|------|
| `scripts/lib/googleCmpHeadBootstrap.js` | Flag-gated head: `googlefc.callbackQueue`, `pauseAdRequests`, official `adsbygoogle.js` loader |
| `scripts/lib/seadaysGoogleCmp.js` | Consent authority rules (Node tests) |
| `assets/js/seadays-google-cmp.js` | `CONSENT_MODE_DATA_READY` handler, `getGoogleConsentModeValues()`, revocation |
| `assets/js/seadays-analytics.js` | Custom banner when `NOT_APPLICABLE`; defers localStorage in regulated regions |
| `assets/js/seadays-ads.js` | Unpauses `pauseAdRequests` only when SeaDays ad consent + TCF rules pass; slot fill unchanged |

**Google loader (documented):** Published European regulations messages deploy via the **AdSense tag** (`adsbygoogle.js` with your `ca-pub-…`), not the account meta alone. When the integration flag is on, the shared head snippet loads that tag early with `pauseAdRequests=1` so the CMP can run **before** any slot `push({})`.

**Single authority:** In EEA-regulated visits (`ad_storage` ≠ `NOT_APPLICABLE`), Google CMP owns consent; SeaDays localStorage cannot grant ads. Outside regulated scope, existing custom banner + v2 prefs apply.

**Fail closed:** CMP script error or `googlefc` timeout → all denied, no custom banner, no ad requests.

**No geo inference:** Regulated vs not uses only `googlefc.getGoogleConsentModeValues()` statuses, not language, timezone, or IP.

**TCF:** Regulated ad requests require `__tcfapi` and all ad Consent Mode purposes granted — not `ad_storage` alone.

## Activation prerequisites (owner)

1. AdSense → **Privacy & messaging** → European regulations message **published** (verify in normal Chrome; console state was unverified in agent audit).
2. Confirm `googlefc` and TCF load on a staging URL.
3. Set flag **only on test/staging** first:

```html
<script>window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ = true;</script>
```

Must appear **before** the shared SeaDays analytics head block (so the gated bootstrap runs). Then run `npm run inject-analytics` if static HTML predates the bootstrap snippet.

4. QA: first visit, accept/reject/customize, return visit, revocation (`googlefc.showRevocationMessage` via Cookie settings when regulated), CMP blocked (fail closed).
5. Production: enable flag only after QA; never enable without published CMP.

## Rollback

1. Remove or set `window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ = false`.
2. Unpublish or pause European regulations message in AdSense (owner).
3. Revert deploy to prior commit if needed.

## Tests

```bash
node scripts/test-consent-cmp-integration.js
node scripts/test-google-cmp-head-bootstrap.js
npm run test-seo-remediation
npm run test-site-layout
```

## Assumptions needing console verification

- Privacy & messaging message is draft vs published.
- `googlefc` injection requires the **AdSense tag** in head when flag is on (not account meta alone).
- Revocation UI copy and TCF vendor list match SeaDays privacy policy (policy pages unchanged in this PR).
- **Meta CSP length:** Chromium enforces an ~769-character cap on `http-equiv` CSP; Funding Choices hosts are added within that budget on the four root pages that carry meta CSP (`scripts/lib/contentSecurityPolicy.js`). Ship/blog/port pages have no meta CSP today.

# Google Privacy & messaging (CMP) integration

**Status:** Code present, **disabled in production** (`window.__SEADAYS_GOOGLE_CMP_INTEGRATION__` is not set to `true` on any page).

## Architecture

| Layer | Role |
|-------|------|
| `scripts/lib/seadaysGoogleCmp.js` | Consent authority rules (Node tests) |
| `assets/js/seadays-google-cmp.js` | `googlefc` callback queue (`CONSENT_MODE_DATA_READY`), `getGoogleConsentModeValues()`, revocation |
| `assets/js/seadays-analytics.js` | Loads CMP bridge only when flag true; custom banner when `NOT_APPLICABLE`; defers localStorage in regulated regions |
| `assets/js/seadays-ads.js` | `seadaysHasAdvertisingConsent()` / NPA via analytics helpers |

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

Must run **before** `/assets/js/seadays-analytics.js` (inline in `<head>` or early snippet).

4. QA: first visit, accept/reject/customize, return visit, revocation (`googlefc.showRevocationMessage` via Cookie settings when regulated), CMP blocked (fail closed).
5. Production: enable flag only after QA; never enable without published CMP.

## Rollback

1. Remove or set `window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ = false`.
2. Unpublish or pause European regulations message in AdSense (owner).
3. Revert deploy to prior commit if needed.

## Tests

```bash
node scripts/test-consent-cmp-integration.js
npm run test-seo-remediation
npm run test-site-layout
```

## Assumptions needing console verification

- Privacy & messaging message is draft vs published.
- `googlefc` injection is tied to existing AdSense account meta / tag (no extra ad units added in this PR).
- Revocation UI copy and TCF vendor list match SeaDays privacy policy (policy pages unchanged in this PR).

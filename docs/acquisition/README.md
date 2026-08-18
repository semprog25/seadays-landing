# SeaDays App Acquisition System

Policy-safe measurement and conversion infrastructure. **No paid spend is launched from this repo.**

Verified 18 August 2026:

| Store | Status | ID | Version |
|---|---|---|---|
| Google Play | **Live** | `com.seadays.app` | listing updated 13 Aug 2026 · **10+** installs |
| Apple App Store | **Live** | Apple ID `6759758357` · bundle `com.seadays.app` | **1.0.90** · 0 ratings |

Canonical download page: [https://seadays.app/download/](https://seadays.app/download/)

## Funnel

```
Impression → Ad / Search / Reddit / Social
  → seadays.app (often /download/ or a guide page)
  → Store product page
  → Download
  → first_open (Firebase automatic)
  → onboarding_complete
  → activated_user   ← optimize here
  → returning user
  → premium_started / purchase
```

**Activated SeaDays user** = first voyage created (`activated_user`).  
Do not optimize paid campaigns for installs alone.

## Website routing

- **Get SeaDays** in inner-page headers and the site footer goes to `/download/` (not `#download`). Homepage header keeps Features / Ships / Ports / Blog / Press so the snap layout is unchanged; homepage hero store badges and in-page Download buttons still convert.
- Homepage hero store badges remain in place (`#download` still exists for old links).
- Android UA → Play is the primary button on `/download/`.
- iPhone/iPad UA → App Store is the primary button.
- Desktop → both stores + campaign QR.
- Campaign params (`utm_*`, `campaign`, Apple `ct`/`pt`/`mt`, Play `referrer`) are applied to **real** store URLs only.

Campaign taxonomy: [`data/acquisition-campaigns.json`](../../data/acquisition-campaigns.json)  
URL builder: [`scripts/lib/storeLinks.js`](../../scripts/lib/storeLinks.js)  
Runtime: [`assets/js/seadays-download.js`](../../assets/js/seadays-download.js)

Example QR / print / bio links:

```
https://seadays.app/download/?campaign=hamburg_port
https://seadays.app/download/?campaign=instagram
https://seadays.app/download/?campaign=organic_reddit
https://seadays.app/download/?campaign=print
```

QR SVGs: [`download/qr/`](../../download/qr/).

## Analytics

Website (GA4 `G-WSQDQ33QZD`, Consent Mode v2):

- `page_view` (gtag)
- `store_click`, `cta_click`, `outbound_click`
- `download_page_view` on `/download/`

App (native Firebase, no extra PII):

| Event | When |
|---|---|
| `first_open` | SDK automatic |
| `onboarding_complete` | First-run onboarding closes |
| `voyage_created` | Every new voyage |
| `activated_user` | **Once**, first voyage |
| `first_ship_viewed` / `first_port_viewed` | Once |
| `first_plan_created` | Once (packing or todo) |
| `first_seastory_view` | Once |
| `premium_started` | Once, with `subscription_started` |

## Experiments (download page only)

Do not run all variants on the homepage at once.

| ID | URL | Headline |
|---|---|---|
| Control | `/download/` | Get SeaDays |
| A | `/download/?exp=companion` | Your Complete Cruise Companion |
| B | `/download/?exp=ship-port` | Know Your Ship. Plan Every Port. |

Measure `download_page_view` → `store_click` → Play/App install → `activated_user`.

## What this system does not do

- Does not spend advertising budget
- Does not post to Reddit
- Does not fake reviews, rankings, awards, or download counts
- Does not auto-redirect QR traffic to a store (user taps Get SeaDays)
- Does not invent App Store / Play URLs

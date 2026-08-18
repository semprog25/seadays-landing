# Paid ads — prepared, not launched

**Status: 2026-08-18 — no campaigns created, no money spent.**

Conversion to optimize everywhere: Firebase `activated_user` (first voyage created). Do **not** bid on raw installs.

Final URL for all web destinations: `https://seadays.app/download/?campaign={id}`  
Play: `com.seadays.app` · App Store: `id6759758357`

---

## Google Ads — Android Germany

Campaign name: **SeaDays Cruise Planner**  
Type: App campaign (Android)  
Daily budget (recommendation only): **€10/day**  
Geo: Germany  
Language: German + English  
Primary conversion: `activated_user`  
Diagnostic only: `first_open`, `onboarding_complete`

Campaign ID in taxonomy: `google_android_cruise_planner`

### Headlines (honest, 30-char class)

- Plan your cruise in one app
- Know your ship before you sail
- Plan every port day
- Cruise planner in 11 languages
- Packing, ports, expenses
- First cruise? Start here
- Free on Google Play
- Ship and port guides

### Descriptions

- Plan sailings, packing, and port days in one cruise companion. Free on Android.
- Catalog ship and port guides plus packing and expenses. No live AIS. No offline maps claim.
- SeaDays is a cruise planner for before, during, and after your trip.

### Creative requirements

- Brand: dark `#0a0a0a`, neon red `#FF0033`, white type, existing wordmark.
- Use real `press/` screenshots. DE + EN text overlays.
- Sizes: 1200×628, 1200×1200, 9:16 10–30s, plus 320×50 / 300×250 if needed.
- Do not show fake ratings, download counts, or “#1 cruise app”.

### Audience / theme

- People planning a cruise (travel intent).
- First-time cruisers (later campaign `google_android_first_time`).
- Port-day planners (later `google_android_cruise_ports`).

### Conversion setup (account — blocked here)

1. Link Google Play app `com.seadays.app` to Google Ads.
2. Link Firebase / GA4 property to Google Ads.
3. Import `activated_user` as the primary conversion.
4. Do not set install as the bid target.

Later: iOS app campaign `google_ios_cruise_planner` after Android CPA is known.

---

## Apple Search Ads

**Do not launch.** Billing and provider token `pt` are incomplete.

| Campaign | Daily | Keywords |
|---|---|---|
| Brand Exact | €5/day | SeaDays, Sea Days, SeaDays app |
| Category Exact | €5/day | cruise planner, cruise planning app, cruise port guide |

Campaign IDs: `apple_search_brand`, `apple_search_category`  
Destination: `https://apps.apple.com/app/id6759758357?pt=PROVIDER&ct=CAMPAIGN&mt=8`  
Paste `pt` into `data/acquisition-campaigns.json` (`appleProviderToken`) before any live links.

Negatives: AIS, live tracking, cruise jobs, dating, cheap tickets.

---

## Reddit Ads

**Do not launch.**

| Ad group | Campaign ID | Angle |
|---|---|---|
| Cruise Planner | `reddit_cruise_planners` | One app for the sailing |
| First-Time Cruiser | `reddit_first_time_cruisers` | What to pack / first port day |
| Port-Day Planning | `reddit_cruise_ports` | Save the port, plan the day |

Destination: `/download/?campaign={id}`  
Optimize to `activated_user` after the pixel/app events are connected. Organic Reddit remains answer-first (`organic_reddit`); no automated posting.

---

## Authorization still required

- Google Ads account + billing + Firebase conversion import
- Apple Ads billing + App Store Connect provider token
- Reddit Ads account + billing
- Explicit spend approval before any campaign is switched on

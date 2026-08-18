# SeaDays acquisition baseline

**Date:** 2026-08-18  
**State:** website `/download/` going live; **no paid campaigns launched**.

Do not invent GA4 or store-console numbers. Values below are what was verified from public listings and this repo.

| Metric | Value | Source |
|---|---|---|
| Android installs | 10+ (Play install bucket) | Google Play listing `com.seadays.app`, verified 2026-08-18 |
| iOS downloads | Not published on the public product page | App Store `id6759758357` · SeaDays 1.0.90 · 0 ratings |
| Website `/download/` page views | 0 historical (page was not in production before this deploy) | GitHub Pages; GA4 `download_page_view` starts after deploy |
| Store clicks (`store_click`) | Not exported here | GA4 `G-WSQDQ33QZD` — requires Analytics account |
| Activated users (`activated_user`) | Not exported here | Firebase — first voyage created, once per install |
| Activation rate (activated / first_open) | Unknown | Need Firebase + enough volume |
| Traffic sources | Organic / direct / QR prepared; paid = none | `data/acquisition-campaigns.json` |

Campaigns prepared (not spending):

- Google Android DE cruise planner €10/day → `activated_user`
- Apple Search Ads Brand Exact + Category Exact €5/day — blocked on billing + `pt`
- Reddit Cruise Planner / First-Time / Port-Day — not launched

This file is the pre-paid snapshot. Update after the first week of `/download/` traffic, still before any spend.

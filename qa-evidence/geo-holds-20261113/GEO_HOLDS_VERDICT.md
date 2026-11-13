# Geographic holds — Dubai & Aberdeen (2026-11-13)

**Baseline:** `origin/main` @ `a2ddaa5b8aa3edc1b4a134e40fd0cf23ede8e68f` · **humanApproved:** 108

## Dubai — `pexels:7168553` (frozen APPROVE_B)

| Classification | Assessment |
|----------------|------------|
| Verified destination identity | **Yes** — Pexels location *Dubai, United Arab Emirates*; description/tags *Dubai Marina*, *Dubai Skyline* |
| Incorrect destination | **No** |
| Generic without identification | **No** — city pinned on source page (not GPS in file) |
| Inconclusive | **No** for Dubai city waterfront card |
| Cruise terminal accuracy | **Not shown** — Marina/waterfront, not Port Rashid |

**Evidence (on main):** `data/destination-photo-batch-05-owner-review-v1-decisions.json` → `geographicResolution[].verdict: VERIFIED`; `qa-evidence/destination-batch-05-20261106/BATCH05_GEO_FLAG_RESOLUTION.md` (city-or-landmark rule).

**Note:** `manifestGeoStatus` in ledger still says `NEEDS_GEO_REVIEW` while `geographicResolution` is `VERIFIED` — publication was blocked on manifest flag; evidence supports clearing for directory use.

**Local prep:** worktree `geo-holds-dubai-20261113` — script `scripts/apply-dubai-batch05-geo-resolution-local.js` (not committed).

## Aberdeen — `pexels:5684661` (frozen APPROVE_B)

| Classification | Assessment |
|----------------|------------|
| Verified destination identity | **No** — not conclusively Aberdeen |
| Incorrect destination | **Unknown** — England-region tags conflict with title |
| Generic / unverified landmark | **Yes** — stone arch bridge; no GPS; location field UK-only |
| Inconclusive | **Yes** |

**Evidence:** ledger `geographicResolution` → `NEEDS_GEO_REVIEW`; `ABERDEEN_ALTERNATIVES.md` documents **VERIFIED** Commons options A (harbour GPS 57.145, -2.089) and B (Marischal College GPS 57.148, -2.097). Owner retained pexels B with `geoReviewStillOpen`.

**Required to publish frozen choice:** independent proof tying image to Aberdeen, **or** owner switch to verified Wikimedia A/B (CC BY-SA 2.0 attribution), **or** explicit owner acceptance of unverified geo risk (policy decision).

**No local publication prep** for Aberdeen.

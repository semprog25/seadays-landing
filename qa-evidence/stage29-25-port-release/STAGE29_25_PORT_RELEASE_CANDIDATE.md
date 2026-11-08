# Stage 29 — 24-port release candidate

**Verdict:** PASS — READY FOR REVIEW  
**Stage 28 source bundle:** `50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad`  
**Stage 31 release bundle:** `6998864e9ef53526c7ab0811007cee1b65b695da8a31eb1f2ca8d1475507daca`  
**Superseded:** `a2b8efa26a281ec9fc3315136e1b75fb41651e87d80ce4f0826e78377450e35e`

## Final cohort (24)

`aberdeen-united-kingdom`, `ajaccio-corsica-france`, `alexandria-egypt`, `alicante-spain`, `amber-cove-puerto-plata-dominican-republic`, `antalya-turkey`, `antigua-st-john-s-antigua`, `auckland-new-zealand`, `bali-benoa-indonesia`, `baltimore-md-united-states`, `barbados-bridgetown-barbados`, `belize-city-belize`, `bruges-zeebrugge-belgium`, `casablanca-morocco`, `charlottetown-pe-canada`, `colon-panama`, `corfu-greece`, `cork-cobh-ireland`, `costa-maya-mexico`, `da-nang-hue-chan-may-vietnam`, `emden-germany`, `fort-de-france-martinique`, `fujairah-united-arab-emirates`, `fukuoka-japan`

## Excluded from cohort (deterministic)

| Slug | Reason |
|------|--------|
| `venice-ravenna-trieste-italy` | Identity split — owner hold (Stage 28) |
| `bod-norway` | Stage 29 HTML gate failure (replaced by `fukuoka-japan`) |
| `eilat-israel` | Stage 31 owner gate — restore main; future enrichment requires verified arrival ops |
| Stage 28 `NEEDS_FACT_CHECK` / `NEEDS_EDITORIAL_FIX` | Not in Stage 28 READY queue |
| Previously published Stage 25–27 guides | Not re-imported |
| Collision secondaries (`goa-india`, terminal-only Doha/Dubai slugs, etc.) | Policy |

**Replacement:** `fukuoka-japan` — next `READY_FOR_OWNER_APPROVAL` slug after `bod-norway` removal (sorted `landing_slug`, unique `app_port_id`).

## QA

- `STAGE29_VALIDATION_REPORT.json` — Hamburg/Aalborg unchanged, terminals unchanged, 24 cohort guide mutations  
- `STAGE29_VISUAL_QA_REPORT.json` — desktop + mobile Playwright PASS (overflow + cohort HTML)  
- Rollback: `rollback-pre-apply/` + per-port `rollback/*.production-snapshot.json`

## Owner approval still required

- Manifest `owner_approval_status: PENDING` on all ports  
- Automated editorial/factual gates are not a substitute for owner spot-check on high-touch claims (especially `alexandria-egypt`, `da-nang-hue-chan-may-vietnam`)

## Stage 31

- **`eilat-israel` excluded** from publication cohort; guide + HTML restored from `origin/main`.
- **Chan May** call-plan copy corrected for remote-port transfers.
- **Supersedes** 25-port bundle `a2b8efa2…`.
- **New release bundle:** `6998864e9ef53526c7ab0811007cee1b65b695da8a31eb1f2ca8d1475507daca`.

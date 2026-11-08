# Stage 29 — 25-port release candidate

**Verdict:** PASS — READY FOR REVIEW  
**Stage 28 source bundle:** `50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad`  
**Stage 29 release bundle:** `a2b8efa26a281ec9fc3315136e1b75fb41651e87d80ce4f0826e78377450e35e`

## Final cohort (25)

`aberdeen-united-kingdom`, `ajaccio-corsica-france`, `alexandria-egypt`, `alicante-spain`, `amber-cove-puerto-plata-dominican-republic`, `antalya-turkey`, `antigua-st-john-s-antigua`, `auckland-new-zealand`, `bali-benoa-indonesia`, `baltimore-md-united-states`, `barbados-bridgetown-barbados`, `belize-city-belize`, `bruges-zeebrugge-belgium`, `casablanca-morocco`, `charlottetown-pe-canada`, `colon-panama`, `corfu-greece`, `cork-cobh-ireland`, `costa-maya-mexico`, `da-nang-hue-chan-may-vietnam`, `eilat-israel`, `emden-germany`, `fort-de-france-martinique`, `fujairah-united-arab-emirates`, `fukuoka-japan`

## Excluded from cohort (deterministic)

| Slug | Reason |
|------|--------|
| `venice-ravenna-trieste-italy` | Identity split — owner hold (Stage 28) |
| `bod-norway` | Release QA fail: missing call-plan cards / cruise tip / FAQ JSON-LD on regenerated HTML; replaced by next eligible slug |
| Stage 28 `NEEDS_FACT_CHECK` / `NEEDS_EDITORIAL_FIX` | Not in Stage 28 READY queue |
| Previously published Stage 25–27 guides | Not re-imported |
| Collision secondaries (`goa-india`, terminal-only Doha/Dubai slugs, etc.) | Policy |

**Replacement:** `fukuoka-japan` — next `READY_FOR_OWNER_APPROVAL` slug after `bod-norway` removal (sorted `landing_slug`, unique `app_port_id`).

## QA

- `STAGE29_VALIDATION_REPORT.json` — Hamburg/Aalborg unchanged, terminals unchanged, 25 guide mutations  
- `STAGE29_VISUAL_QA_REPORT.json` — desktop + mobile Playwright PASS (overflow + cohort HTML)  
- Rollback: `rollback-pre-apply/` + per-port `rollback/*.production-snapshot.json`

## Owner approval still required

- Manifest `owner_approval_status: PENDING` on all ports  
- Automated editorial/factual gates are not a substitute for owner spot-check on high-touch claims (especially `eilat-israel`, `alexandria-egypt`, multi-name Vietnam slug)

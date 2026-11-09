# Bulk port release (up to 50) — Stage 61

**Status: PARTIAL** — inventory allows **5** gated candidates, not 50.  
**Production baseline:** `9ea50c967a26a705fbbf93ab196b39f8b7835cbe`  
**Release bundle hash:** `516b00b7956318f98362637259392aed988b064e053fc0acc045efa03fe2287c`

## Inventory

| Metric | Value |
|--------|------:|
| Research ports | 406 |
| Passenger-editorial published (baseline) | **106** (includes Trieste) |
| Remaining unpublished research | **300** |
| Stage 45 `READY` still unpublished | **0** (cohort fully shipped) |
| Exclusion-path candidates (`portInfo.description` held) | **5** |

**Stage 60 policy check:** Trieste-only exception verified — `trieste-italy` on historical ledger, not in active hard-exclude; Ravenna/Eilat/Bod/Mumbai/Mormugao remain hard-excluded.

## Approved cohort (5)

| Slug | Track | Field exclusions |
|------|-------|------------------|
| `corner-brook-canada` | stage45_exclusion_path | `portInfo.description` |
| `horta-azores-portugal` | stage45_exclusion_path | `portInfo.description` |
| `lofoten-islands-norway` | stage45_exclusion_path | `portInfo.description` |
| `reykjavik-iceland` | stage45_exclusion_path | `portInfo.description` |
| `sydney-australia` | stage45_exclusion_path | `portInfo.description` |

Draft source: `qa-evidence/stage45-rescore/drafts` (v2.5 sanitizer). Terminals JSON untouched.

## Exception queue (not in PR)

- **Policy / hard exclude:** `bod-norway`, `eilat-israel`, `mormugao-port-goa-india`, `mumbai-india`, `ravenna-italy`, `venice-ravenna-trieste-italy`, terminal alias slugs (ledger).
- **Already passenger-editorial:** all other Stage 45 `READY` rows (40) + prior releases.
- **Scale gap:** no additional unpublished rows with cached v2.5 drafts passing gates without weakening Stage 43–52 rules — next tranche needs per-slug sanitizer runs on `NEEDS_REVIEW` pool (~121), not bulk-50 from existing artifacts alone.

## Owner decisions

1. Approve **5-port exclusion-path** PR vs defer.
2. Accept **description field exclusions** on all five (live `portInfo.description` retained from production).
3. **Corner Brook / Reykjavik:** residual timing-scan risks from Stage 52 — spot-check call-plan copy before merge.
4. Policy-held India/Norway/Italy ports — separate owner clearance (not part of this bundle).

## Artifacts

- `qa-evidence/bulk-50-port-release/BULK_50_RELEASE_MANIFEST.json`
- `qa-evidence/bulk-50-port-release/FACTUAL_AND_EDITORIAL_GATES.json`
- `qa-evidence/bulk-50-port-release/EXCEPTION_QUEUE.json`
- `qa-evidence/bulk-50-port-release/INVENTORY_RECONCILE.json`
- `qa-evidence/bulk-50-port-release/APPLY_REPORT.json`
- `qa-evidence/bulk-50-port-release/RELEASE_VALIDATION.json`
- `qa-evidence/bulk-50-port-release/VISUAL_QA.json`
- Rollback: `qa-evidence/bulk-50-port-release/rollback-pre-apply/`

**No merge / deploy** in this stage.

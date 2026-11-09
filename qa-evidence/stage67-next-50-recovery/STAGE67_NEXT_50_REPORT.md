# Stage 67 — Next 50 recovery (PARTIAL)

## Verdict

**PARTIAL — READY FOR OWNER REVIEW** (2/50 approved for publication prep; 5 held in manifest with evidence)

## Baseline

| Field | Value |
|--------|--------|
| Verified main | `92788f0b4df5f578b4e10508854f251c5e4d4c51` |
| Published (guide-based) | 270 / 406 |
| Remaining `app_port_id` | 136 |
| Bundle hash | `d80526154dbd3d5d11116a312231f6b6a5b229faea68a5ec99fe8414f1cbd767` |

## Cohort

| Metric | Count |
|--------|------:|
| Bootstrap `policy_ok` (reconcile) | 7 |
| Selected for prepare | 7 |
| Passing all gates | 2 |
| **Approved (`slugs_approved`)** | **2** |
| Held (gates fail, evidence retained) | 5 |

**Approved:** `victoria-bc-canada`, `vlore-albania`

**Held:** `ponce-puerto-rico`, `fort-lauderdale-fl-united-states`, `juneau-ak-united-states`, `long-beach-ca-united-states`, `montreal-qc-canada` — see `RECOVERY_RESULTS.json`

## Evidence

| Artifact | Result |
|----------|--------|
| `REMAINING_INVENTORY.json` | Canonical 136 remaining |
| `RELEASE_VALIDATION.json` | 2/2 PASS |
| `BROWSER_QA.json` | 2/2 PASS (desktop + mobile) |
| `APPLY_REPORT.json` | 2 slugs, bundle match |
| `test-stage67-*` | PASS |

## Release guards

- Owner holds: Glasgow, Rostock, Tokyo/Yokohama, Kirkenes, Ocho Rios
- Partial `--only` apply cannot overwrite full cohort evidence (Stage 66 guard reused)
- `test-stage67-approved-html-call-plans` — post-apply call-plan cards on generated HTML

## Merge projection

**272 / 406** published · **134** remaining (not 320/86 — inventory cannot supply 50 net-new PASS rows without research/policy recovery on the remaining **48** YAML-blocked bootstrap ports).

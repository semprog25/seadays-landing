# Stage 62 — NEEDS_REVIEW 25-port targeted recovery

**Status:** `READY_FOR_REVIEW`  
**Production baseline (owner):** `d15a5deb5b5f7e7eb187a402d11f911e856c204a`  
**Prep head (parent):** `f2524d49788618e4c30ac0f339a03371642fd4a3`  
**Release bundle (immutable):** `9183aac34842fcd9c72f349e69b21237fb0a441b6362605034a85117c71ba421`

## Summary

| Metric | Value |
|--------|------:|
| Original NEEDS_REVIEW report (rollback baseline) | 108 |
| Current unpublished NEEDS_REVIEW (production guides) | 103 |
| Recovery pool (QA pass, SHA, identity, policy dry-run ok, no holds) | 63 |
| Candidates inspected (targeted recovery) | 25 |
| **Newly READY_FOR_OWNER_APPROVAL (all gates)** | **25** |
| Browser QA (desktop + mobile, file URLs) | 25/25 pass |

## Method (not Stage 61 synthesis pilot)

1. Reconciled inventory on **current** `data/public-port-guides.json` (111 passenger editorial at baseline).
2. Ranked ports by evidence score (thin score, v2.5 markdown patchability, no research leak, policy dry-run ok).
3. **Targeted recovery** (`targetedNeedsReviewRecovery.js`): reuse live `topThings`/description where strong; v2.5 `preparePassengerGuideText` on surfaces; generic hedged call plans; distance fallback without invented minutes; fact-pack-backed synthesis only as a base layer.
4. Same editorial, factual, marker, HTML, and Playwright gates as prior bulk releases.
5. Passenger-only apply + `--ports-only --only=` regen (terminals, maps, Viator, reviews preserved).

## Approved candidate slugs (25)

`honolulu-hi-united-states`, `izmir-turkey`, `jacksonville-fl-united-states`, `kavala-greece`, `kristiansand-norway`, `le-havre-paris-france`, `liverpool-united-kingdom`, `menorca-mahon-spain`, `messina-sicily-italy`, `mykonos-greece`, `nafplio-greece`, `norfolk-va-united-states`, `olbia-italy`, `osaka-kyoto-kobe-japan`, `portland-me-united-states`, `portsmouth-united-kingdom`, `rhodes-greece`, `saint-john-nb-canada`, `salerno-italy`, `samos-greece`, `san-diego-ca-united-states`, `san-francisco-ca-united-states`, `santander-spain`, `sicily-palermo-italy`, `split-croatia`

## Remaining NEEDS_REVIEW blockers (not in this PR)

| Root cause | Approx. count (multi-label) |
|------------|----------------------------:|
| `gateway_terminal_policy_block` | 39 (of 103) |
| `historical_policy_exclusion` | policy holds (Bod, Eilat, Mumbai, Ravenna, Mormugao, aliases) |
| `draft_sanitizer_markdown_leak` | fixable cohort outside top-25 score |
| `missing_weak_passenger_content` / unsupported factual layer | remaining thin research rows |
| Stage 61 pilot auto-synthesis | **0** auto-ready (unchanged; this release does not use that path) |

## Artifacts

- `qa-evidence/needs-review-25-recovery/NEEDS_REVIEW_25_MANIFEST.json`
- `qa-evidence/needs-review-25-recovery/RECONCILE.json`
- `qa-evidence/needs-review-25-recovery/RECOVERY_RESULTS.json`
- `qa-evidence/needs-review-25-recovery/RELEASE_VALIDATION.json`
- `qa-evidence/needs-review-25-recovery/BROWSER_QA.json`
- `qa-evidence/needs-review-25-recovery/rollback-pre-apply/`

## Owner actions

- **Do not merge** until spot-check approved.
- **No deploy** from this branch without owner sign-off.
- After merge: expect catalogue regen workflow on `main` (same pattern as PR #81).

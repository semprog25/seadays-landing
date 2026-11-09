# Stage 63 — Targeted recovery batch (owner review, no merge)

**Baseline:** PR #82 merge `f75811f82b732e173a8c81646f8c2d76823cd94e`, parent `af0a95f7a`  
**Status:** `PARTIAL` (35/38 reviewed pass all gates)  
**Bundle:** `28ddf82d6f92065d8d7bf82c2e33db9f3b74144d1e3381cac7e8aaa5c96f7ae8`

## Inventory (reconciled on `af0a95f7a`)

| Metric | Count |
|--------|------:|
| Research manifest ports | 406 |
| Published passenger editorial (pre-PR) | 136 |
| Unpublished researched ports | 270 |
| — NEEDS_REVIEW unpublished | 85 |
| — BLOCKED (research QA / import) | 184 |
| — PASS bucket unpublished | 1 |
| Recovery pool (QA, SHA, identity, policy dry-run ok) | 38 |

Cohort cap 50; **pool exhausted at 38**.

## Outcomes

| | Count |
|--|------:|
| Selected for targeted recovery | 38 |
| **Passing all gates (in PR)** | **35** |
| Held (excluded from apply) | 3 |

### Held

| Slug | Reason |
|------|--------|
| `tokyo-yokohama-japan` | `NEEDS_FACT_CHECK` (owner bucket) |
| `kirkenes-norway` | `NEEDS_FACT_CHECK` |
| `ocho-rios-jamaica` | `NEEDS_EDITORIAL_FIX` — insufficient supported `topThings` |

## QA

- HTML / editorial / factual gates: `RELEASE_VALIDATION.json` — **35/35**
- Playwright desktop+mobile (file): `BROWSER_QA.json` — **35/35**
- `public-port-terminals.json`: unchanged vs rollback

## Post-merge workload (if approved)

| | Count |
|--|------:|
| Published after batch | 171 |
| Remaining unpublished | 235 |
| Remaining NEEDS_REVIEW (est.) | ~43 |
| Recovery pool left (est.) | ~3 (+ gateway/policy blocked) |

## Pipeline

Same as Stage 62: `targetedNeedsReviewRecovery.js` + existing validation (no synthesis pilot).

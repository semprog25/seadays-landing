# Stage 66 — Next 50 unpublished recovery

**Production baseline:** `30018ceacb0165d6d5e2f659ca030531228bb2c1`  
**Bundle hash:** `0d1e71cb015d0dc4c9de83b6a33c445e06457d9c8b769a15fc5009aec4173274`  
**Status:** READY_FOR_OWNER_REVIEW — not merged.

## Reconciled inventory (post–PR #86)

| Recovery class | Count |
|----------------|------:|
| `bootstrap_missing_guide` (qa PASS) | 107 |
| `needs_review_existing_guide` | 33 |
| `research_qa_blocked` | 27 |
| `historical_policy_hold` | 14 |
| `owner_factual_hold` | 4 |

**Owner holds (not selected):** `tokyo-yokohama-japan`, `kirkenes-norway`, `ocho-rios-jamaica`, `glasgow-united-kingdom`

**Unpublished remaining (research manifest):** 185  
**Prepared / inspected:** 58  
**Gates passed:** 53  
**Approved for apply:** **50**

**Swap:** `rostock-germany` removed post-apply (generated HTML lacked passenger call-plan cards); replaced with **`thessaloniki-greece`**.

## Validation

| Check | Result |
|-------|--------|
| HTML validate (`stage66-validate-next-50-release.js`) | 50/50 |
| Playwright desktop+mobile (`BROWSER_QA.json`) | 50/50 |
| Glasgow exclusion (`test-stage66-release-guards.js`) | PASS |
| Terminals JSON | unchanged vs rollback |

## Post-merge expectation (if owner approves)

- **Published passenger editorial:** 270 / 406  
- **Remaining:** 136  

Confirm latest successful `pages-build-deployment` on final `main` HEAD after catalogue auto-commit.

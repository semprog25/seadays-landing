# Stage 65 — Next 25 unpublished recovery

**Production baseline:** `c68abdaf1024d968744fbdcb0a10b4c6d2afbc79`  
**Bundle hash:** `4f8ad40fd7c138c2b3bf52579fb7787e28ff9c168433b2e478653a6c6ccab490`  
**Status:** READY_FOR_OWNER_REVIEW — not merged.

## Inventory (210 remaining @ baseline)

| Recovery class | Count |
|----------------|------:|
| `bootstrap_missing_guide` (qa PASS) | 132 |
| `needs_review_existing_guide` | 34 |
| `research_qa_blocked` | 27 |
| `historical_policy_hold` | 14 |
| `owner_factual_hold` | 3 |

**Owner holds (not selected):** `tokyo-yokohama-japan`, `kirkenes-norway`, `ocho-rios-jamaica`

## Cohort

| Metric | Value |
|--------|------:|
| Prepared | 38 |
| Gates passed | 36 |
| **Approved** | **25** |
| HTML validate | 25/25 |
| Playwright | 25/25 |

**Swap:** `glasgow-united-kingdom` removed post-apply (legacy HTML lacked passenger call-plan cards after regen); replaced with **`greifswald-germany`** (passed all gates). Glasgow guide/HTML restored from rollback.

## Approved slugs (25)

beirut-lebanon, castaway-cay-bahamas, chania-crete-greece, chios-greece, cuxhaven-germany, dammam-saudi-arabia, douglas-isle-of-man, ensenada-mexico, esbjerg-denmark, flekkefjord-norway, flensburg-germany, galveston-tx-united-states, galway-ireland, gdansk-poland, gdynia-poland, gothenburg-sweden, greenock-united-kingdom, greifswald-germany, savona-italy, sibenik-croatia, sorrento-italy, st-tropez-france, syracuse-italy, tromso-norway, villefranche-nice-france

**Mix:** 24 bootstrap + 1 existing-guide (`villefranche-nice-france`).

## Held / not in PR

| Reason | ~Count |
|--------|-------:|
| YAML import errors (research pack) | 48 |
| Research QA BLOCKED | 27 |
| Stage 43 policy | 14 |
| Owner factual holds | 3 |
| Prepare pool fail / cap | 2+ |

## Post-merge expectation

Confirm **latest** successful `pages-build-deployment` on final `main` HEAD (not an intermediate cancelled merge-SHA run).

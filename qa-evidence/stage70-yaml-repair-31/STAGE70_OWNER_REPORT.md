# Stage 70 — Repair 31 Category B research YAML blockers (owner review)

**Landing baseline:** `26b35d693f78e3f7db101b7ad333cec2b8259f4f` (**319/406** passenger editorial)  
**Stage 69 inventory:** [#97](https://github.com/semprog25/seadays-landing/pull/97) @ `59f7599e` (unchanged)  
**Status:** Research syntax repair verified locally — **no merge, no deploy, no guide apply**

## 31/31 failure accounting (pre-repair)

| # | Slug | Pre-repair YAML failure |
|---|------|-------------------------|
| 1 | hobart-australia | flow-sequence `unverified_fields` (`terminals[0].latitude`) |
| 2 | lanzarote-spain | same |
| 3 | madeira-funchal-portugal | same |
| 4 | marigot-st-maarten | same |
| 5 | melbourne-australia | same |
| 6 | molde-norway | same |
| 7 | nagasaki-japan | same |
| 8 | narvik-norway | same (+ bracketed field ids) |
| 9 | nordfjordeid-norway | same |
| 10 | okinawa-naha-japan | same |
| 11 | olden-norway | same |
| 12 | ponta-delgada-azores-portugal | same |
| 13 | port-canaveral-fl-united-states | same (`terminals[*].latitude`) |
| 14 | safaga-egypt | compact mapping `transit_notes` (colons) |
| 15 | salvador-de-bahia-brazil | flow-sequence |
| 16 | santiago-san-antonio-chile | flow-sequence |
| 17 | sharm-el-sheikh-egypt | flow-sequence |
| 18 | skagen-denmark | flow-sequence |
| 19 | skjolden-norway | flow-sequence |
| 20 | st-george-s-grenada | flow-sequence |
| 21 | st-lucia-castries-st-lucia | flow-sequence |
| 22 | stornoway-united-kingdom | flow-sequence |
| 23 | tauranga-new-zealand | flow-sequence |
| 24 | tenerife-spain | flow-sequence |
| 25 | tortola-british-virgin-islands | flow-sequence |
| 26 | trondheim-norway | flow-sequence |
| 27 | turku-finland | flow-sequence |
| 28 | ulvik-norway | flow-sequence |
| 29 | ushuaia-argentina | flow-sequence |
| 30 | visby-sweden | flow-sequence |
| 31 | wellington-new-zealand | flow-sequence |

**Substantive policy failures before repair:** 0/31 (all blocked at YAML read).

## Repair outcome

| Metric | Count |
|--------|------:|
| YAML repaired (auto) | 30 |
| YAML repaired (manual `safaga-egypt` transit_notes quote) | 1 |
| Still YAML-blocked | **0** |
| Research `qa_verdict` promoted to PASS via metadata hack | **0** |
| `publication_bucket` left as NEEDS_REVIEW | **31/31** |

Artifacts: `GATE_REPORT.json`, `RECONCILE_SUMMARY.json`, `PORTS_MASTER_INDEX_SHA_PATCH.json`, `COMPOSITE_SHA_PATCH.json` (Stage 67 + 70 SHA overlay, 79 slugs).

## Post-repair inventory (87-port universe preserved)

| Category | Stage 69 | After composite repair |
|----------|---------:|------------------------:|
| A | 1 | **32** (+31 from B) |
| B | 31 | **0** |
| C | 8 | 8 |
| D | 24 | 24 |
| E | 21 | 21 |
| F | 2 | 2 |

`POST_REPAIR_CATEGORY_B_DELTA.json`, `post_repair_REMAINING_87_INVENTORY.json`.

## Policy / identity gates (31-cohort)

From `GATE_REPORT.json` (per slug):

- **YAML parse:** 31/31  
- **SHA match (patched index):** 31/31  
- **policy_dry_run.ok:** 31/31  
- **identifier resolved:** 31/31  
- **publication_bucket:** NEEDS_REVIEW (unchanged — not elevated to PASS)

## Net-new publication candidates (not applied)

`stage69-select-next-cohort.js` with composite research patch:

- **Selected:** **25** NEEDS_REVIEW recovery slugs (`COHORT_MANIFEST.json` in `post_repair_*`)  
- **Held from cohort:** `hamburg-germany` (pilot PASS bucket)  
- **Category A but not in top-25 pool:** hobart-australia, marigot-st-maarten, nagasaki-japan, nordfjordeid-norway, okinawa-naha-japan, stornoway-united-kingdom (rank/limit — still prep-ready after YAML fix)

**Projected passenger editorial after a future approved 25-port apply:** **319 + 25 = 344/406** (not including Hamburg pilot or the 6 additional Category A slots unless a follow-on cohort is approved).

## Changed files

**Research repo (`seadays-ports-deliverables`):** 31× `by-port/*.md` (frontmatter quoting only) + fixture/test/evidence.

**Landing repo (this branch):** scripts + `qa-evidence/stage70-yaml-repair-31/` only — no `data/public-port-guides.json`, no HTML.

## Validation commands

```bash
# Research
cd seadays-ports-deliverables && npm run test:yaml-stage70-category-b

# Landing worktree
node scripts/stage70-reconcile-research-yaml-31.js
node scripts/stage70-build-composite-sha-patch.js
node scripts/stage70-reconcile-remaining-87-after-repair.js
node scripts/test-stage70-yaml-repair-31.js
```

## PRs (owner to open/merge)

1. **Research:** branch `feat/stage70-research-yaml-31` → `seadays-ports-deliverables` `main`  
2. **Landing evidence (optional):** branch `feat/stage70-research-yaml-31` — validation artifacts only  

Do **not** merge PR #97 for this work. Hamburg pilot promotion remains a separate owner decision.

## Smallest defensible next cohort

**25 ports** from `post_repair_COHORT_MANIFEST.json` after research PR merge + landing SHA composite is pinned on `main`.

## Remaining blockers (56 unpublished excl. cohort)

- **C** research QA / missing md: 8  
- **D** identity: 24  
- **E** owner/historical holds: 21  
- **F** alias conflicts: 2  
- **A not in cohort limit:** 6 (+ Hamburg pilot)

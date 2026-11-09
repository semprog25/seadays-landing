# Stage 76 — Six-guide publication candidate (owner review)

- **Baseline main:** `59653e6203ab66623a7f53e5572395b401ec140b` (live **344/406** passenger editorial)
- **Prep:** Stage 75 PR #102 bundle `87483ccb…` (unchanged)
- **Research pin:** `e5680f19` (merged PR #3 — **not** re-run for Cape Liberty/Vancouver)
- **Candidate branch:** `feat/stage76-six-guide-publication-candidate`
- **Slugs (6):** hobart-australia, marigot-st-maarten, nagasaki-japan, nordfjordeid-norway, okinawa-naha-japan, stornoway-united-kingdom
- **Projected if merged:** **350/406** on branch only
- **Authorization:** `owner_publication_authorized` and `production_apply_permitted` remain **false**
- **Rollback:** `qa-evidence/stage76-publication-6/rollback-pre-apply/`
- **Validation:** `RELEASE_VALIDATION.json` — preserved CocoCay/Oslo/Vancouver HTML; FAQ/schema + Viator guards on targeted HTML test

## Merge order (owner)

1. Stage 75 PR #102 (inventory/prep evidence) if not already merged
2. Stage 76 publication PR (6-guide candidate apply on branch)
3. Future owner-authorized apply stage only — **no deploy in Stage 76**

# Stage 74 — Targeted legacy copy cleanup (owner review)

**Baseline:** production `53736b985e82d17457522e37aaa637ecfb46f0cf` (344/406 passenger editorial)  
**Scope:** `cape-liberty-bayonne-nj-united-states`, `vancouver-bc-canada` only  
**Not in scope:** publication tier changes, Stage 73 candidate merge/apply, deploy

## Leak summary

| Slug | Verdict | Scanner hit | Passenger surface |
|------|---------|-------------|-------------------|
| cape-liberty-bayonne-nj-united-states | Genuine leak | `Not verified on the FAQ page` | Getting there + FAQ JSON-LD |
| vancouver-bc-canada | Genuine leak | `Not verified on the Canada Place page captured` | Getting there + FAQ JSON-LD |

Both are **genuine** internal-research wording (not false positives). Article `#things-to-do` blocks were already clean.

## Source trace (regeneration)

| Layer | Path | Role |
|-------|------|------|
| Research markdown | `seadays-ports-deliverables/by-port/*.md` § Getting there | Upstream wording imported via `transformResearchToPublic.js` → `gettingThere.publicTransport` |
| Landing catalogue | `data/public-port-guides.json` | Canonical published copy for HTML + FAQ |
| HTML | `ports/<slug>/index.html` | Regenerated via targeted `generateBlogs.js --ports-only --only=` |

Landing JSON + research markdown are both patched so a future research re-merge does not reintroduce the scanner hits.

## Tests

| Script | Result |
|--------|--------|
| `node scripts/stage74-apply-legacy-copy-cleanup.js` | Applied 2 slugs, targeted HTML regen |
| `node scripts/test-stage74-legacy-copy-cleanup.js` | **PASS** (JSON + HTML leak scan, 344 count, research patch check) |

## Owner actions

- Review copy in `STAGE74_REPAIRS_APPLIED.json`
- Merge landing PR only when satisfied; **do not deploy** until authorized
- Merge matching research-repo commit for `by-port/cape-liberty-*.md` and `vancouver-bc-canada.md` before any bulk research SHA refresh

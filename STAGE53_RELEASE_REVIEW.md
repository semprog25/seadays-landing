# Stage 53 — 11-port passenger-editorial release

> **Stage 55 update:** PR #79 is now scoped to **5** editorial ports. See `STAGE55_SCOPE_DECISION.md` and bundle `6d6e0088…`. This file documents the original 11-port prep.

## Status: **SUPERSEDED for merge scope** (5-port subset active)

| Item | Value |
|------|--------|
| Main SHA (branch base) | `c90cb145c9b089ece02b02be8e5dbadbe809458e` |
| Stage 52 planning baseline | `02f2a75506422e58c4819a745bdbdd8aad71e08e` |
| Delta since Stage 52 | `c90cb145` — port catalogue regen (`chore: regenerate port catalogue [skip generate]`) |
| Release bundle hash | `d521c5a24120ae12a3dd7dd46a8238dc877e1ff745ec4324d86cdc241332285f` |
| Cohort | **11** / **11** gates pass |
| Merge / deploy | **Not authorized** |

## Selected ports (11 unique `appPortId`)

| Landing slug | appPortId | Draft source | Field exclusions |
|--------------|-----------|--------------|------------------|
| `bod-norway` | `bodo` | Stage 28 | — |
| `mormugao-port-goa-india` | `mormugao` | Stage 28 | `thingsToDo.topThings[2]` |
| `mumbai-india` | `mumbai` | Stage 28 | `thingsToDo.topThings[2]` |
| `ravenna-italy` | `ravenna` | Stage 28 | — |
| `trieste-italy` | `trieste` | Stage 28 | — |
| `eilat-israel` | `eilat` | Stage 28 | — |
| `almeria-spain` | `almeria` | Stage 52 corrected | — |
| `harstad-norway` | `harstad` | Stage 52 corrected | — |
| `montego-bay-jamaica` | `montego-bay` | Stage 52 corrected | — |
| `roseau-dominica` | `dominica` | Stage 52 corrected | — |
| `la-romana-dominican-republic` | `la-romana` | Stage 52 corrected | — |

**Excluded (not in this PR):** `venice-ravenna-trieste-italy` (composite hard exclude). Five Stage 45 description-exclusion ports unchanged.

**Note:** Stage 28 slugs overlap `STAGE43_HARD_EXCLUDE` for automated bulk picking; this release uses the **locked Stage 28 manifest** + fresh gate re-run, not the Stage 43 auto-filter.

## Verification

| Check | Result |
|-------|--------|
| `stage53-prepare-11-port-release.js` | 11/11 current gates |
| `stage53-apply-candidate-worktree.js` | Applied; terminals JSON **unchanged** |
| `generateBlogs.js --ports-only --only=<11>` | 11 HTML pages |
| `stage53-validate-release.js` | **PASS** |
| Marker tests (strip / boundary / JSON) | **PASS** |
| `stage53-visual-qa.js` (structural) | **11/11** |
| `stage53-playwright-visual-audit.js` | **INCOMPLETE** (Playwright module not installed in this environment) |
| `test-site-layout.js` | **PASS** (no preview fragments committed) |

Rollback: `qa-evidence/stage53-11-port-release/rollback-pre-apply/` (guides, terminals, per-port HTML).

## PR scope

- `data/public-port-guides.json` — 11 entries → `publication_tier: passenger_editorial`
- `ports/<slug>/index.html` — 11 pages
- `qa-evidence/stage53-11-port-release/` manifest, proposed guides, rollback snapshots, apply + validation reports
- `STAGE53_*.json`, this file, `scripts/stage53-*.js`, minimal `bulkPortPublication` / `portResearchImport` deps for release scripts

## Owner decisions

1. Spot-check gateway / transfer wording (`mumbai-india`, `mormugao-port-goa-india`, `bod-norway` vs `bodo` slug).
2. Authorize merge after review (no auto-approve factual changes).
3. Optional Playwright pass on 2–3 samples when CI/agent has Playwright installed.

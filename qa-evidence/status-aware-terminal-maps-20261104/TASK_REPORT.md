# Status-aware terminal maps — Barcelona & Miami (local pilot)

**Date:** 2026-11-04  
**Worktree:** `/Users/sharanestone/Semprog/seadays-landing/.worktrees/status-aware-terminal-maps-20261104`  
**Branch:** `pilot/status-aware-terminal-maps-20261104`  
**Baseline:** `origin/main` @ `dde1806e5d8c411a4cc790c8fe0295d2cc418671` (post-PR59)

**Research (not repeated):**

- `.worktrees/three-port-shared-ui-20261104/qa-evidence/three-port-shared-ui-20261104/TERMINAL_COORDINATE_RESEARCH.md`
- `.worktrees/three-port-shared-ui-20261104/qa-evidence/three-port-shared-ui-20261104/TERMINAL_STATUS_AND_COORDINATE_VERIFICATION.md`

---

## A. Worktree and baseline SHA

| Item | Value |
|------|--------|
| Worktree path | `.worktrees/status-aware-terminal-maps-20261104` |
| Branch | `pilot/status-aware-terminal-maps-20261104` |
| Base commit | `dde1806e5d8c411a4cc790c8fe0295d2cc418671` |
| `SEADAYS_APP_ROOT` (generation) | `/Users/sharanestone/Semprog/Seadays-trust-boundary` |

Primary WIP (`fix/port-ship-content-recovery` @ `5186233`) and `.worktrees/three-port-shared-ui-20261104` were not modified.

---

## B. Data and renderer changes

### Shared logic

- **`scripts/lib/terminalOperationalStatus.js`** (new): `active` / `closed` / `transitioning` / `planned`; missing/empty status → **active**; unknown status → **not active**; `filterActiveTerminalsForDisplay()`, `collectTransitioningVisitorNotices()` (uses `visitor_notice` only).
- **`scripts/lib/portGuideSections.js`**: Map pins and terminal cards use **active** terminals only; transitioning records render **`pg-terminal-transition-notice`** (not active cards/pins); exports `buildOsmTerminalMap`.

### Data

- **`data/public-port-terminals.json`**: Barcelona coords/addresses on A,B,D,E; legacy **`adossat-terminal-c`** → `closed` (no lat/lon); **`world-trade-center-pier`** → `transitioning` + `visitor_notice`; Miami all seven → `active` with verified addresses and coordinates from §B of verification doc.

### Tests

- **`scripts/test-terminal-operational-status-map.js`** (new): status filtering, map pin counts, Barcelona/Miami/Hamburg data expectations.
- **`scripts/test-ports-phase1.js`**: Barcelona published HTML expects 4 active cards, 4 map pins, WTC transition notice, no legacy C card, Terminal B photo preserved.
- **`package.json`**: `test:ci-channels` includes new test.

### Generated HTML (scoped)

- **`ports/barcelona-spain/index.html`**, **`ports/miami-fl-united-states/index.html`** via `generateBlogs.js --ports-only --only=…` + per-file `rewriteHtml` + `injectAnalyticsHead` (not full-repo rewrite).

---

## C. Barcelona — active / closed / transitioning

| Slug | Status | Map pin | Active card |
|------|--------|---------|-------------|
| `adossat-terminal-a` | active | yes | yes |
| `adossat-terminal-b` | active | yes | yes (verified photo card) |
| `adossat-terminal-c` | **closed** | no | no (record retained in JSON) |
| `adossat-terminal-d` | active | yes | yes |
| `adossat-terminal-e` | active | yes | yes |
| `world-trade-center-pier` | **transitioning** | no | no — **visitor notice** in Getting there |

**Verified on built HTML:** 4 pins, 4 cards, transition notice present, no legacy C summary card.

---

## D. Miami — pin results

All seven terminals **active**; map shows **7 distinct pins** with addresses in popups.

| Terminal | Address (JSON) | Confidence (per research) |
|----------|----------------|---------------------------|
| AA | 2200 N Cruise Blvd | Medium |
| A | 2000 N Cruise Blvd | Medium–High |
| B–F | 1761 … 1103 N Cruise Blvd | High |

**A vs AA:** `25.775097,-80.168737` vs `25.771194,-80.158201` (~650 m apart; not swapped, not identical).

---

## E. Screenshot locations

Directory: `qa-evidence/status-aware-terminal-maps-20261104/`

| File |
|------|
| `barcelona-spain-390x844.png` |
| `barcelona-spain-1280x800.png` |
| `miami-fl-united-states-390x844.png` |
| `miami-fl-united-states-1280x800.png` |
| `hamburg-germany-390x844.png` (regression) |
| `hamburg-germany-1280x800.png` (regression) |
| `screenshots.json` (pin counts per capture) |

Capture: `node qa-evidence/status-aware-terminal-maps-20261104/run-screenshots.cjs` (Playwright from `SEADAYS_APP_ROOT` / app `node_modules`).

---

## F. Test results

| Test | Result | Notes |
|------|--------|-------|
| `node scripts/test-terminal-operational-status-map.js` | **PASS** | |
| `node scripts/test-ports-phase1.js` | **FAIL** (pre-existing) | Fails on **repeat-sentence** scan across many indexed ports (line ~247) before Barcelona block; not introduced by this pilot. Barcelona asserts updated for 4 cards / transition notice. |
| `node scripts/smoke-port-guides.js` | **FAIL** (pre-existing) | Looks for ASCII `6-8h`; page has `6–8 hours` (en dash). |
| Hamburg HTML | **unchanged** | `git diff ports/hamburg-germany/index.html` empty |

---

## G. SEO / affiliate / shell regression

| Check | Barcelona / Miami | Hamburg |
|-------|---------------------|---------|
| `ports/hamburg-germany/index.html` diff | n/a | **none** |
| Canonical / JSON-LD | Present on regen pages | unchanged |
| `seadays-site-shell` header/footer | Present | unchanged |
| Viator `campaign=` on Barcelona | Present after regen + rewrite | n/a |
| Sitemap / ads.txt | Not rewritten (`--only=` mode) | — |
| Full catalogue regen | **not run** | — |

---

## H. Changed files (exact)

**Modified**

- `data/public-port-terminals.json`
- `scripts/lib/portGuideSections.js`
- `scripts/test-ports-phase1.js`
- `package.json`
- `ports/barcelona-spain/index.html`
- `ports/miami-fl-united-states/index.html`

**Added**

- `scripts/lib/terminalOperationalStatus.js`
- `scripts/test-terminal-operational-status-map.js`
- `qa-evidence/status-aware-terminal-maps-20261104/*` (report, screenshots, `run-screenshots.cjs`, `run-screenshots.mjs`, `screenshots.json`)

---

## I. Remaining coordinate uncertainty

- **Miami Terminal AA:** Medium confidence (PDF/MSC address + building POI; no OSM `cruise_terminal` tag yet).
- **Miami Terminal A:** Medium–High (house geocode; visual check against PortMiami PDF recommended).
- **Barcelona:** A/B/D/E per research table; legacy C intentionally **without** coordinates.

---

## J. Recommended minimal PR

1. Merge **`terminalOperationalStatus.js`** + **`portGuideSections.js`** status-aware filtering (no unrelated refactors).
2. Merge **`public-port-terminals.json`** Barcelona + Miami rows only (status + coords + addresses).
3. Add **`test-terminal-operational-status-map.js`** + Barcelona assert updates in **`test-ports-phase1.js`**.
4. Regenerate **only** `barcelona-spain` and `miami-fl-united-states` in CI (`--ports-only --only=…`) with Viator secrets + existing post-process (`rewrite-download-ctas`, `inject-analytics-head` scoped or full per pipeline policy).
5. **Do not** bundle unrelated port HTML or Hamburg changes.

---

## K. READY FOR OWNER REVIEW

**YES** — local implementation complete: status-aware maps, Barcelona/Miami data, scoped HTML, focused tests pass, visual QA captured, Hamburg untouched. Resolve pre-existing `test-ports-phase1` repeat-sentence failures separately if CI must go green before merge.

**Strict compliance:** No PR opened, no merge, no deploy, no full catalogue regen, no Supabase/Wikimedia KV writes, no indexing changes.

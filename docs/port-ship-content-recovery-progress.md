# Port and ship content recovery progress

Local only. No push, merge, or deploy.

- **Repository:** `semprog25/seadays-landing`
- **Branch:** `fix/port-ship-content-recovery`
- **Base:** `fix/adsense-content-recovery` @ `8ff50c0efab5975a6c9f0a6aab87e475e82c1c8b`
- **References:** `scripts/test-publish-gate.js`, `data/content-quality-checklist.csv` (699 rows), `docs/adsense-content-recovery-progress.md` (SD-01–06, SD-09, SD-35, SD-40, SD-41 scope). `seadays-master-change-list.md` is not in this repo; checklist + gate tests are the working backlog index.
- **Blog / Appendix B:** unchanged on this branch (completed on `fix/adsense-content-recovery`).

## Phase 1 — publish gate classification (baseline @ branch start)

`node scripts/test-publish-gate.js` → **indexed ports 220**, **indexed ships 30**, **pages with any gate issue 179**, **sitemap URLs 389**. CI assertion: **0** indexed Phase‑1 port / ship pages with blocking gate issues.

| Group | Page count | Notes |
|--------|------------|--------|
| Correctly excluded (audit noindex) | 177 | `data/audit-holdback.json` / `isAuditNoindexPort`; expected gate failures, not indexable |
| Expedition ship spec heuristic (`spec gt/pax`) | 2 | `le-commandant-charcot`, `ms-spitsbergen`; both **noindex**, not in sitemap (intentional) |
| Indexed Phase‑1 / ship gate failures | 0 | No mass rewrite required for indexability |
| Shared sentence duplication (>6 pages) on indexed ports | 0 | |
| Placeholder / doubled-country on indexed ports | 0 | `test-ports-phase1.js` scan |

**Root-cause summary:** Most “179 failures” are **expected audit holdbacks**, not open defects on indexed URLs. Remaining indexed work is **data hygiene** and **per-slug editorial**, not generator-wide breakage.

## Phase 2 — shared defects (this branch)

| Change | Files | Evidence |
|--------|-------|----------|
| Canada entry copy: nationality-dependent wording (SD-style politics hygiene) | `data/public-port-guides.json` (7 guide keys: charlottetown, corner-brook, halifax, saguenay, saint-john, st-john-s-canada, sydney-canada) | Aligns with Phase 1 visa softening pattern in `data/reports/PHASE_1_PORT_CORRECTION_REPORT.md`; Government of Canada eTA named without blanket “visa-free” claims |
| Rendered entry + Halifax FAQ | `ports/*-canada/index.html` (4 **indexed** slugs) | Removes definitive US visa-free boilerplate on live indexable pages |
| Regression guard | `scripts/test-ports-phase1.js` | Fails if any **index** port still contains `Visa-free for US citizens and many others` |

**Preserved:** Barcelona, Hamburg, Marigot custom page, audit noindex set, ship overview holdbacks, blog/CMS reconciliation docs.

**Not changed:** `publishGate.js` expedition ratio (charcot/spitsbergen stay noindex); embarkation line for verified homeports; 177 audit noindex ports; `marigot-st-maarten` (curated non–Phase‑1 template, indexed by design).

## Phase 3 — individual repair backlog (unresolved)

| Priority | Item | Count / slug | Blocker |
|----------|------|----------------|---------|
| P1 | Audit noindex / rewrite ports | 177 | Spreadsheet audit; no mass reindex |
| P2 | Marigot Phase‑1 terminal template | 1 (`marigot-st-maarten`) | No `public-port-guides` / terminal dataset; custom copy kept |
| P2 | Thin ship pages (noindex) | e.g. `ms-spitsbergen` | Needs sourced specs + overview before index |
| P3 | Checklist “getting-there” / terminal rows | see CSV | Per-port sourced terminals |

## Phase 4 — verification log

| Step | Result |
|------|--------|
| `node scripts/test-publish-gate.js` | PASS (counts unchanged vs baseline) |
| `node scripts/test-ports-phase1.js` | PASS after Canada patches |
| `npm run test:ci-channels` | Run at end of session (see commit message / below) |
| Full `regenerate-port-pages` | **Not** committed (accidental run reverted; 4-port HTML patched surgically) |

## Owner decisions

1. Re-index any of the 177 audit noindex ports only with spreadsheet approval + sourced rewrite.
2. `marigot-st-maarten`: migrate to Phase‑1 generator when terminal/guide data exists.
3. Expedition ships: widen `spec gt/pax` band vs keep noindex until editorial pass.
4. Blog merge proposals remain on `fix/adsense-content-recovery` (unchanged here).

## Release readiness (port/ship)

**Indexed catalogue:** gate-clean for Phase‑1 ports and ships; sitemap matches indexable set. **Not AdSense-submit ready** for the long tail of audit-held ports; safe to ship **incremental** Canada entry fix + data sync without changing index counts.

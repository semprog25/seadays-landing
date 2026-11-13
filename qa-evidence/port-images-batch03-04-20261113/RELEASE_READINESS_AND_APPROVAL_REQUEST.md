# Port images — Batch 03 + 04 publication release candidate (local only)

**Status:** `PORT_IMAGES_BATCH_READY`  
**Worktree:** `seadays-landing/.worktrees/port-images-batch03-04-20261113`  
**Branch:** `chore/port-images-batch03-04-publication-prep` (tracks `origin/main` @ `d002a6a8e`)  
**Tracker:** SeaDays Command Center `17vVLDSiEEXaDkd7MO19N875Vgp9S4QZy9WRaB3sp6eA` — **SD-UX-02** (paste this scope); **SD-UX-01** remains **IN_PROGRESS**

No commit, push, PR, merge, or deploy performed in this task.

---

## Release scope (11 ports)

| Port slug | Batch | Provider / ID | Notes |
|-----------|-------|---------------|--------|
| `juneau-ak-united-states` | 03 | pexels:12847675 | VERIFIED |
| `sydney-australia` | 03 | pexels:32311511 (B) | VERIFIED |
| `helsinki-finland` | 03 | pexels:38424230 | VERIFIED |
| `auckland-new-zealand` | 03 | pexels:30285119 | VERIFIED |
| `nice-france` | 03 | pexels:28602953 (B) | VERIFIED |
| `tallinn-estonia` | 03 | pexels:37690012 | VERIFIED |
| `le-havre-paris-france` | 03 | pexels:11691091 (B) | Owner-approved; `providerGeoNeedsReview` retained |
| `valparaiso-chile` | 03 | pexels:33139344 | VERIFIED |
| `malaga-spain` | 04 | pexels:38322213 | VERIFIED |
| `casablanca-morocco` | 04 | unsplash:JkG4jwyZaL4 | Hassan II — VERIFIED |
| `buenos-aires-argentina` | 04 | pexels:40135622 | VERIFIED |

**Intentionally excluded from replace:** `rotterdam-netherlands`, `mumbai-india` (already `humanApproved` via owner-downloads-53; different assets than Batch 03 ledger).

**Deferred (not in this PR):** Batch 05 frozen ledger (15 approvals; 2 chosen slots flagged `NEEDS_GEO_REVIEW`: Dubai B, Aberdeen B; Port Canaveral Wikimedia CC BY) — requires separate owner sign-off.

---

## Owner release approval request

Please approve **one scoped PR** from this worktree containing only:

1. `data/destination-photo-batch-03-*.json`, `data/destination-photo-batch-04-*.json`, `data/destination-photo-batch-03-04-scoped-release-manifest.json`
2. `data/ports-directory-image-review-state.json`, `data/ports-directory-destination-owner-candidates.json`, `data/destination-image-catalog.json`
3. `assets/img/ports-directory/ports/{11 slugs}/destination-exterior-batch03|batch04-*.webp`
4. `ports/index.html` + `ports/{11 slugs}/index.html` (hero/OG/Twitter/JSON-LD + figcaption attribution only; no editorial body rewrites)
5. Prep scripts/tests under `scripts/` and `qa-evidence/port-images-batch03-04-20261113/`

**Pre-merge checks to run in CI:** `test-port-images-batch03-04-publication.js`, `test-destination-photo-batch-04-owner-decisions.js`, `test-destination-image-catalog.js`, `test-destination-image-source-policy.js`.

**Post-merge:** GitHub Pages deploy only (no full-catalogue `generateBlogs` bot regen required — HTML already in PR). Confirm `ports-directory-photography` / generate classify **channel=ports** or **skip** if paths stay within scoped manifest.

**Le Havre:** Accept geo review flag on owner-chosen B, or reply with rejection before merge.

---

## Evidence paths

- Apply report: `qa-evidence/port-images-batch03-04-20261113/BATCH03_04_APPLY_REPORT.json`
- Coverage reconciliation: `qa-evidence/port-images-batch03-04-20261113/PORT_IMAGE_COVERAGE_RECONCILIATION.json`
- Prior batch ledgers (source): `qa-evidence/destination-batch-03-20261105/BATCH03_DECISIONS_RECONCILIATION_REPORT.md`, `destination-batch-04-20261106/BATCH04_DECISIONS_RECONCILIATION_REPORT.md`, `destination-batch-05-20261106/BATCH05_DECISIONS_RECONCILIATION_REPORT.md`

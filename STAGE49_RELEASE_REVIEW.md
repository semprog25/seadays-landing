# Stage 49 — 33-port release (review bundle)

## Status: **READY FOR REVIEW**

| Item | Value |
|------|--------|
| Production baseline | `aa14e0f19f1df22f933fc25368bae82f5941a0e1` |
| Stage 45 rescore file bundle | `f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214` |
| Owner bundle ref (prompt) | `01fde17fccfd4708abd77664807d53773b2c7f5731c01e1f8efea113f53a34aa` (**does not match** on-disk rescore; see note below) |
| Stage 49 release bundle | `74305cf8a7298f1ec9bcb23806119e12ace6448c25b02e80c7094738a606a789` |
| Cohort | **33** ports (`READY_FOR_OWNER_APPROVAL`, minus PR #76 seven) |
| Gates passing | **33 / 33** |
| Merge / deploy | **Not authorized** |

## Membership (33)

Excluded (already on main via PR #76): `kagoshima-japan`, `katakolon-olympia-greece`, `korcula-croatia`, `malmo-sweden`, `penang-malaysia`, `rio-de-janeiro-brazil`, `shanghai-china`.

Remaining publish candidates: see `STAGE49_33_PORT_RELEASE_PROPOSAL.json` → `slugs_locked` and `app_port_ids`.

## Bundle hash note

Step 1 used immutable `STAGE45_50_PORT_RESCORE.json` / `STAGE45_NEWLY_READY_QUEUE.json` (40 newly ready, 0 marker-blocked). The on-file `bundle_idempotency_hash` is **`f13e73e56c…`**, not the owner prompt value **`01fde17f…`**. No substitute ports were added. **`01fde17f` should be reconciled by owner** (alternate artifact or typo) before treating it as a hard gate.

## Pipeline integration

- Drafts sourced from `qa-evidence/stage45-rescore/drafts` (Stage 45 rescore run, `PROMPT_VERSION` **`stage22-deterministic-v2.5-marker-strip`**).
- `passengerDraftSynthesize` + `sanitizePassengerDraftSurfaces` on **main** (PR #77) match rescore sanitizer generation path.
- Apply uses `stage24ApplyEditorialDraft`; stronger live fields preserved; **terminals JSON untouched**.
- HTML regen: `generateBlogs.js --ports-only --only=<33 slugs>` (local test Viator PID/MCID only for regen guard).

## Verification

| Check | Result |
|-------|--------|
| `test-research-source-marker-strip.js` | PASS |
| `test-draft-passenger-marker-boundary.js` | PASS |
| `test-public-port-guides-no-research-markers.js` | PASS |
| `stage49-validate-release.js` | PASS (33 HTML + guides) |
| `stage49-visual-qa.js` | **33/33** structural heuristics; **no Playwright** — not a claimed visual PASS |

Rollback: `qa-evidence/stage49-33-port-release/rollback-pre-apply/` (guides, terminals, per-port HTML).

## Outstanding owner decisions

1. Reconcile **`01fde17f…`** vs **`f13e73e56c…`** rescore bundle reference.
2. Spot-check gateway ports (e.g. `ho-chi-minh-city-phu-my-vietnam`, `port-said-egypt`, `princess-cays-bahamas`).
3. Authorize publication (not done in this stage).
4. Optional human visual pass on 3–5 sample pages before merge.

## PR scope (when opened)

- `data/public-port-guides.json` — 33 entries only
- `ports/<slug>/index.html` — 33 pages
- `qa-evidence/stage49-33-port-release/*` evidence
- `STAGE49_*.json` / this file
- `scripts/stage49-*.js` + minimal release libs (no Supabase / app repo changes)

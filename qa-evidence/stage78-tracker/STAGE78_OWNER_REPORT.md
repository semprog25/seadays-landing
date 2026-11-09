# Stage 78 — Five-guide candidate + four legacy leaks (owner review)

**Status:** Evidence complete on two branches — **no merge, deploy, or production authorization.**

## Baseline (unchanged on `main`)

- Production `79bad426` — **350/406** passenger editorial  
- Stage 77 evidence PR [#104](https://github.com/semprog25/seadays-landing/pull/104) unchanged (not merged)

## Track A — Five publication candidates → **355/406** if merged

| Port | `app_port_id` | Research QA | Identity |
|------|---------------|-------------|----------|
| fort-lauderdale-fl-united-states | fort-lauderdale | PASS | Stage 77 VERIFIED_MAPPING |
| juneau-ak-united-states | juneau | PASS | Stage 77 VERIFIED_MAPPING |
| long-beach-ca-united-states | long-beach | PASS | Stage 77 VERIFIED_MAPPING |
| montreal-qc-canada | montreal | PASS | Stage 77 VERIFIED_MAPPING |
| ponce-puerto-rico | ponce | PASS | Stage 77 VERIFIED_MAPPING |

- Landing-only **identity wiring** for these five slots (`stage78-apply-identity-wiring-5.js`)  
- Hamburg-style prep bundle `05565400…` — call plans, getting there, FAQ/schema, Viator env on targeted regen  
- Long Beach + Ponce editorial repair (`stage78-editorial-repair-two.js`) for ≥3 supported attractions  
- Rollback: `qa-evidence/stage78-publication-5/rollback-pre-apply/`  
- Tests: `npm run test:stage78-publication-5` (validate + leak guard)

## Track B — Legacy leak cleanup (separate PR)

Boston, Cabo, Galveston, Seattle — pre-Stage 76 leaks documented in Stage 77 Phase 0.  
Passenger-safe JSON + targeted HTML regen; **350** PE count preserved.

## Track C — Remaining backlog

Unchanged Stage 77 holds: 21 policy, Hamburg pilot, 2 aliases, 8 Category C blocked, **19** identity mappings not bulk-applied. No new research repair PR.

## Owner decisions

1. Merge **legacy cleanup PR first** (optional) — no count change.  
2. Merge **five-guide PR** only after publication authorize — still `owner_publication_authorized: false` in manifest.  
3. Do not merge PR #104 automatically.  
4. No deploy / full `generate-blogs` on production.

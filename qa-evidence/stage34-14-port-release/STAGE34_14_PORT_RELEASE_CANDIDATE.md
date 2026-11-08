# Stage 34 — 14-port release candidate

**Verdict:** PASS — READY FOR OWNER APPROVAL  
**Stage 33 source bundle:** `2b15a9d47cd2a964ab9fb9a214522b4116ddde4b514b978d8c70e308cbfd80fa`  
**Stage 34 release bundle:** `de3707a73b6abe37e51f1197a4d04d454aefab5c3f870d1e18b9ca11accee14b`  
**Production baseline (main @ prep):** `c02de1f1ba57ce036d45390d279a59c09ab70f7d`

## Final cohort (14, locked)

`helsinki-finland`, `hvar-croatia`, `isafjordur-iceland`, `klaipeda-lithuania`, `koper-slovenia`, `kotor-montenegro`, `kuala-lumpur-port-klang-malaysia`, `limassol-cyprus`, `muscat-oman`, `nice-france`, `philipsburg-st-maarten`, `san-juan-puerto-rico`, `sicily-catania-italy`, `singapore-singapore`

## Gateway identity review

| Slug | Note |
|------|------|
| `nice-france` | Port Lympia vs Villefranche — practical tip |
| `muscat-oman` | Port Sultan Qaboos framing |
| `kuala-lumpur-port-klang-malaysia` | Port Klang / PKCT — not downtown KL |
| `philipsburg-st-maarten` | Pier 2 Wathey vs Marigot |
| `singapore-singapore` | MBCCS vs HarbourFront SCC |

No cohort exclusions. Terminal coordinates/maps unchanged (no new terminal maps).

## QA artifacts

- `STAGE34_RELEASE_MANIFEST.json` — locked cohort, draft/research SHAs, field exclusions  
- `STAGE34_VALIDATION_REPORT.json` — Hamburg/Aalborg unchanged, terminals unchanged, 14 guide mutations, scoped HTML validation  
- `STAGE34_VISUAL_QA_REPORT.json` — desktop + mobile Playwright on release `ports/*/index.html` — PASS  
- `STAGE34_APPLY_REPORT.json` — apply audit (local `rollback-pre-apply/` not committed; restore via manifest + Stage 33 per-port snapshots)

## Release fix (Nice mobile overflow)

Markdown `[label](url)` in `topThings` is stripped to label text in `preparePassengerGuideText`; `pg-top-things-list` gets `overflow-wrap` for passenger HTML.

## Rollback

1. Revert PR commit (or restore `qa-evidence/stage34-14-port-release/rollback-pre-apply/public-port-guides.json` from local apply + per-slug HTML under `rollback-pre-apply/ports/`).  
2. Regenerate affected slugs or run inverse apply from `qa-evidence/stage33-remaining-ports/rollback/*.production-snapshot.json`.

## Owner approval still required

Manifest `owner_approval_status: PENDING`. Spot-check gateway ports (Nice/Monaco excursions, Muscat PSQ, Port Klang transfers).

# Stage 79 — Research-blocked 27 + Oslo legacy leak (owner review)

**Status:** Evidence complete — **no merge, deploy, or publication authorize.**

## Baseline

| Item | Value |
|------|------:|
| Production `main` | `0d1d845345b191e2b44ecd393062213e88fd3946` |
| Live passenger editorial | **355 / 406** |
| Remaining unpublished | **51** |

## Phase 2 — 27 research blockers

| Disposition | Count |
|-------------|------:|
| **RECOVERED** | **0** |
| **STILL_BLOCKED** | **9** |
| **NEEDS_OWNER_EVIDENCE** | **18** |

No research correction PR recommended (`research_pr_recommended: false`). Index `qa_verdict: BLOCKED` unchanged on pinned composite research.

**STILL_BLOCKED (9):** anchorage, gythion, houston, monemvasia, naxos, porto-cervo, adabya + structural cruise-facility gaps per `PORTS_MASTER_INDEX` `blocked_reason`.

**NEEDS_OWNER_EVIDENCE (18):** primary port pages still TLS/403/404/unread or thin ministry hubs — owner PDF, audited capture, or on-site terminal verification required before research PR.

Evidence: `qa-evidence/stage79-research-27/STAGE79_RESEARCH_DISPOSITION.json`

## Phase 3 — Identity wiring (19)

`STAGE79_IDENTITY_WIRING_PROPOSAL.json` — 19 remaining Category D **VERIFIED_MAPPING** rows (excludes 5 Stage 78 wired slugs). `safe_to_apply: false`; no JSON apply in this stage.

## Phase 4 — Publication prep

**0** newly publication-ready (identity + research PASS). No Hamburg-quality editorial bundle prepared.

## Phase 5 — Oslo legacy leak

**Genuine** scanner hit: `portInfo.description` contained “captured page” (live + JSON-LD). Repair on branch `feat/stage79-oslo-legacy-leak-cleanup`; `test:stage79-oslo-legacy-leak` PASS. Separate landing PR — no passenger editorial count change.

## Phase 6 — 51-port summary

| Hold / bucket | Count |
|---------------|------:|
| Owner/policy holds | 21 |
| Hamburg pilot | 1 |
| Canonical aliases | 2 |
| Research-blocked (27) | 27 |
| **Max defensible net-new without owner auth** | **0** |

## Owner decisions

1. Review Oslo legacy leak PR (copy-only on one live guide).
2. Review identity wiring proposal PR (19 mappings — no apply).
3. No research merge until owner supplies unread primaries or accepts STILL_BLOCKED for structural ports.
4. Stage 78 five-guide PR remains owner publication authorize only (355 projected).

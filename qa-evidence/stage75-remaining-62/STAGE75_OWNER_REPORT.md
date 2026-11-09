# Stage 75 — Complete 62 remaining ports (owner review, no merge/deploy)

**Landing baseline:** `59653e6203ab66623a7f53e5572395b401ec140b` (344/406 live passenger editorial)  
**Research pin (deferred-6 prep):** `0abbeb7f8f1049047e12f950588c16175c7830fe` (`seadays-ports-deliverables`)  
**Production writes:** none  
**Owner publication authorized:** false

## Phase 0 — Stage 74 closure

| Check | Result |
|-------|--------|
| Live PE count | **344** |
| Cape Liberty / Vancouver leak scan | clean |
| CocoCay call-plan cards | **12** |
| CDN JSON Last-Modified | 2026-11-09 ~17:30 UTC |

## Phase 1 — 62/62 reconcile

Authoritative reconcile: `qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json`

| Category | Count | Meaning |
|----------|------:|---------|
| A | 1 | Hamburg pilot (prep candidate; held) |
| B | 6 | Policy YAML was failing on stale composite; **resolved on live research** |
| C | 8 | Research `qa_verdict: BLOCKED` |
| D | 24 | `missing_app_port_id` |
| E | 21 | Owner / policy holds |
| F | 2 | Alias — canonical PE already on slot |

## Phase 2–3 — Recovery prepared

**Deferred Category A (6)** — full Hamburg-quality prep bundle:

- Bundle hash: `87483ccb0c21b1d92b6aa119231369b7e5309ec6ba5e020424f33478a2f8233c`
- Slugs: hobart, marigot, nagasaki, nordfjordeid, okinawa-naha, stornoway
- **6/6** `READY_FOR_OWNER_REVIEW`, all gates pass (call plans ≥3, leak scan clean)

**Hamburg** — **not** prepared for net-new publication (PASS-bucket pilot; existing non-PE guide).

**Categories C/D/E/F** — documented in `STAGE75_COMPLETION_LEDGER.json`; no fabricated data.

## Totals

1. **Publication-ready (prepared):** 6  
2. **Owner approval / pilot / policy:** 22 (21 policy + Hamburg pilot)  
3. **Unresolvable without new evidence:** 32 (24 identity + 8 research)  
4. **Genuine aliases:** 2  
5. **Max defensible after deferred-6 apply:** 350 live PE (not 406/406)

## Owner decisions

1. Approve landing PR (evidence + prep only) — no apply.  
2. Optional: authorize `stage75-apply-deferred-6` implementation + apply (future stage).  
3. Identity cohort (24): approve app_port_id mappings per `IDENTITY_RESOLUTION` holds.  
4. Research cohort (8): owner source verification or retire slots.  
5. Policy holds (21): per-port factual sign-off.  
6. Merge research PR #3 if not already on landing pins (Stage 74).

## Regression protections

No changes to live `data/public-port-guides.json` or `ports/` HTML on this branch.

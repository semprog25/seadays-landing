# Stage 44 — Bulk blocker diagnosis (Stage 43 batch)

**Source:** `STAGE43_EXCEPTION_QUEUE.json` gate_rows (50-port pilot)  
**Production baseline:** `f3b05d0bf4dcf2ab7b77ebdcb5900c99ec328618`

## Executive summary

| Bucket (Stage 43 batch of 50) | Count |
|-------------------------------|------:|
| READY_FOR_OWNER_APPROVAL | 7 |
| NEEDS_FACT_CHECK | 2 |
| NEEDS_EDITORIAL_FIX | 1 |
| BLOCKED | 40 |

The **40 BLOCKED** rows in the pilot cohort share **one deterministic root cause** in this run: `[S#]` / inline research source markers survived draft synthesis (`research_source_marker_in_draft`). That is a **pipeline hygiene** failure, not ambiguous port identity or research QA BLOCKED for those rows.

**Excluded-from-selection** (not in the 50 batch) is a separate queue: mostly `identifier_unresolved` / missing `app_port_id` / `missing_public_guide_entry` and a small set of `qa_blocked` rows (e.g. Chennai).

## Root-cause taxonomy (40 BLOCKED in pilot)

| Root cause | Count | Recoverable with deterministic fix? |
|------------|------:|:-----------------------------------:|
| Research source marker in draft JSON (`[S1]`… in passenger fields) | **40** | **Yes** — extend `stripWikiCitationMarkers` / draft sanitizer pass (same class as Stages 40–42) before gate classification |
| Missing / ambiguous identifier | 0 *in pilot blocked set* | — |
| Research QA BLOCKED | 0 *in pilot blocked set* | — |
| Incomplete attractions / transport | 0 *as primary bucket label* | Secondary gate failures folded into READY vs FACT_CHECK vs EDITORIAL |
| Factual uncertainty (`exclude_from_release`) | 0 *in 40 blocked* | — |
| Editorial transform limitations | 0 | — |
| No meaningful improvement vs live thin guide | 0 *in 40 blocked* | — |
| Stale / strict validation | 0 | Marker gate is strict by design |

\*The 40 blocked slugs are exactly those that failed the `RESEARCH_SOURCE_MARKER_RE` scan in `stage43-prepare-next-cohort.js` after drafting.

## Excluded-from-selection (outside the 50 pilot)

Approximate reason families from `excluded_from_selection` (global eligibility scan, not double-counted with the 40):

| Reason family | Representative slugs | Notes |
|---------------|-------------------------|-------|
| Identifier unresolved / missing app port id | Bremen, Cartagena×2, Gdansk, Glasgow, Hamburg (duplicate gateway), etc. | Needs manifest / `public-port-guides` id wiring before any bulk import |
| QA BLOCKED | Chennai | Research pack blocked — not auto-recoverable |
| Gateway / duplicate slug collisions | Jeddah variants, Manama variants, Muscat duplicate, Venice-area hard excludes | Policy-held per Stage 43 rules |

## Proposed pipeline improvements (prioritized)

1. **Pre-gate citation strip on drafts (P0)** — Run the same marker cleanup used for published JSON on synthesized drafts before `RESEARCH_SOURCE_MARKER_RE` and HTML preview. **Expected recoverable:** up to **40** ports from the Stage 43 pilot alone, assuming no secondary factual/editorial failures (assumption: most are thin-guide upgrades already passing other gates).
2. **Identifier manifest batch (P1)** — Resolve `missing_app_port_id` for European river/secondary gateways; unlocks excluded pool, not the 40 marker rows.
3. **Fact-check queue ergonomics (P2)** — Corner Brook / Horta (`NEEDS_FACT_CHECK`) need owner exclusion review, not re-research.
4. **Editorial hold (P2)** — Harstad failed `publication_gates_pass` — inspect `validateEditorialDraft` failures before cohort selection.

## Expected recoverable count (assumptions stated)

| Scenario | Ports | Assumptions |
|----------|------:|-------------|
| Marker-only fixes on pilot 40 | **25–40** | Single sanitizer pass removes all `[S#]`; validation and factual gates unchanged; no new leaks |
| + identifier wiring (excluded pool) | **+15–40** | Each resolved id becomes importable; still subject to marker + editorial gates |
| QA BLOCKED research | **0** until research re-run | Chennai-class rows |

## Owner decisions remaining

- Approve Stage 44 **7-port** bundle `cd0ca7725432c3424e9439d913ac7e7ac362ce6fc6080c91030971b13ed1ddb0` (from Stage 43 source `40be0c1e…`).
- Shanghai field exclusion `thingsToDo.topThings[2]` — already applied in proposal.
- Whether to fund **P0 marker pass** before the next 40-port cohort vs one-off manual fixes.

## Highest-impact next action

**Implement draft-stage citation stripping (P0)** and re-run Stage 43 selection on the same 50 slugs without re-researching 406 ports — expect the blocked rate in the pilot to drop from **80%** to near **0%** for marker-only failures.

# Stage 59 — Trieste factual / editorial clearance

**Slug:** `trieste-italy` · **App id:** `trieste`  
**Overall readiness:** **READY FOR OWNER PUBLICATION APPROVAL** (candidate prepared; **not** published)  
**Factual verdict:** **CONDITIONAL PASS** (automated gates pass; residual uncertainties documented)

## Stage 58 baseline consumed

- `STAGE58_FACTUAL_VERIFICATION.json` (Stage 57 worktree) — Trieste CONDITIONAL, Adriatic policy hold.
- `qa-evidence/stage57-hold-reconciliation/draft-corrected/trieste-italy.json` — starting point superseded by verified draft below.

## HOLD conditions — resolution

| Original hold | Addressed in Stage 59? | Notes |
|---------------|------------------------|--------|
| Adriatic gateway / Venice–Ravenna–Trieste identity | **Yes (editorial)** | Description names Trieste as its own gateway; not Venice/Ravenna interchange. |
| Stage 33/43 hard-exclude | **Unchanged (policy)** | Exception is preparation-only; ledger not edited. |
| Qualified walk time | **Yes** | Replaced fixed “10–15 min” with “a few minutes” when at central Stazione Marittima + berth confirm. |
| Miramare on short calls | **Yes** | Half-day framing; ship excursion or pre-arranged bus/taxi; hours not asserted. |
| Thin / synthetic overview | **Partially** | Authority-sourced lead; `facts` / `climate` / `politics` blocks **preserved** from production. |

## Authoritative verification used

| Source | Claim supported |
|--------|-----------------|
| [Trieste Terminal Passeggeri — terminal crocieristico](https://www.triesteterminal.it/en/terminal-crocieristico/) | Stazione Marittima in city centre, short walk to Piazza Unità; berths 29–30; other areas (e.g. Sistiana) mentioned only as conditional. |

No new terminal coordinates or berth assignments were invented. Overflow / Ormeggio berths referenced only as “confirm programme / ship transfer”.

## Passenger-surface review

| Area | Assessment |
|------|------------|
| Gateway identity | **Defensible** — distinct Trieste framing. |
| Terminal access | **Defensible** — Stazione Marittima / Molo dei Bersaglieri area with berth confirm. |
| Walking | **Qualified** — “few minutes” only for central station berth. |
| Miramare transport | **Realistic** — not bundled into standard call; longer call requires 8h+ window. |
| Call plans | **Feasible** — generic templates; no minute-sum itinerary blocks. |
| Field exclusions | **None** on manifest; none silently restored. |
| Terminals JSON | **Unchanged** (byte-identical rollback check). |
| Terminal map in HTML | **Not introduced** (rollback vs post-regen). |

## Automated gates (targeted)

| Gate | Result |
|------|--------|
| `validateEditorialDraft` | **PASS** |
| `validateGeneratedPortHtml` | **PASS** |
| `test-draft-passenger-marker-boundary` | **PASS** |
| `test-site-layout.js` | **PASS** (full site scan) |
| Playwright desktop + mobile | **PASS** (`STAGE59_TRIESTE_VISUAL_QA.json`) |

Visual checks: 3 call-plan cards, Getting There, cruise tip, nav/logo, canonical `https://seadays.app/ports/trieste-italy/`, no overflow, no `[S#]` / raw markdown.

## Unresolved uncertainties (acceptable for CONDITIONAL)

- Overflow berths (e.g. Ormeggio / non-central landings) — transfer not verified in copy.
- Miramare opening hours and exact bus routes — not stated.
- `factually_verified` flag remains **false** in machine validation (owner spot-check still appropriate).

## Changed fields (candidate only)

`portInfo`, `gettingThere`, `thingsToDo`, `shorePlansFirst`, `researchImport` — see `STAGE59_TRIESTE_RELEASE_PROPOSAL.json`.

**Preserved:** `facts`, `size`, `climate`, `politics`; terminal data; SEO slug; canonical URL; images/Viator/reviews behaviour via unchanged non-passenger integrations and targeted HTML regen.

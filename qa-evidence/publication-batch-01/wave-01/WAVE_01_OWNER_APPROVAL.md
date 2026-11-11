# Wave 1 — Owner approval text (not authorized)

**Wave:** `mumbai-india`, `ravenna-italy`, `bod-norway`  
**Deferred:** `mormugao-port-goa-india`, `goa-india` (unchanged)  
**Reconciled main:** `c14c7792` · **PE today:** 356 → **359** if all three authorized with apply

## Required owner decisions (publication)

### mumbai-india
- **Stage 43:** Lift hard-exclude for passenger editorial publication only (India gateway batch decision).
- **Bodø-style flags:** Set `owner_publication_authorized: true` in guide `researchImport` at apply; keep `owner_indexing_authorized: false` unless separate indexing wave.
- **Indexing default:** `noindex, follow` preserved; no sitemap inclusion without indexing auth.

### ravenna-italy
- **Stage 43:** Lift hard-exclude with Adriatic gateway policy sign-off (`venice-ravenna-trieste-italy` stays excluded).
- **Publication flags:** Same as Mumbai (`publication` yes / `indexing` separate).
- **Editorial note:** Sanitized candidates (no GAP/Sum); Porto Corsini/Molo Crociere retained.

### bod-norway
- **Stage 43:** Lift hard-exclude.
- **Stage 29 acknowledgment:** Owner confirms historical HTML gate failure reviewed; candidate passes `validateGeneratedPortHtml` without terminal map (stub contract).
- **Publication flags:** Same pattern; reuse Stage 89 candidate-applied path on apply.

## Explicitly not in Wave 1
- Mormugao proposed/candidate corrections in local worktree — **must not ship** in Wave 1 PR.
- `goa-india` / Mormugao policy resolution.
- Any `owner_indexing_authorized: true` or Stage 43 ledger edit without signed manifest.

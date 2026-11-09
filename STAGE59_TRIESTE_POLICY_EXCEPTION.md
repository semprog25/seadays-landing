# Stage 59 — Trieste-only policy exception (preparation scope)

**Repository:** `seadays-landing`  
**Worktree:** `.worktrees/stage59-trieste-pilot`  
**Baseline:** `main` @ `8a6eec9f98f5220057a61ff63506f943b47c3cf0`  
**Owner decision (Stage 59):** Conditional policy clearance for **`trieste-italy` only** to prepare a verified publication **candidate**.

## What this exception authorizes

- Isolated worktree preparation applying **only** Trieste passenger surfaces from `qa-evidence/stage59-trieste-pilot/trieste-italy.verified-draft.json`.
- Setting `researchImport.stage59_policy_exception` = `trieste-italy-only-stage59-owner-conditional` on the **candidate** guide entry.
- Regenerating **`ports/trieste-italy/index.html`** (targeted `generateBlogs.js --ports-only --only=trieste-italy`).
- Updating **`data/public-port-guides.json`** for app id `trieste` in this worktree only.

## What this exception does **not** authorize

- **No** merge, PR, deploy, or production push.
- **No** change to `STAGE43_HARD_EXCLUDE` / `scripts/lib/bulkPortPublication/stage43PublishedBaseline.js` (if present on branch).
- **No** removal of `ravenna-italy`, `bod-norway`, `mumbai-india`, `mormugao-port-goa-india`, or `eilat-israel` from historical hold ledgers.
- **No** change to global Venice / Ravenna / Trieste policy text in Stage 57/58 documents.
- **`owner_publication_authorized`** remains **false** on the candidate (`STAGE59_TRIESTE_RELEASE_PROPOSAL.json`).

## Ravenna and composite slugs

- `ravenna-italy` stays **OWNER_APPROVAL_REQUIRED** per Stage 58.
- `venice-ravenna-trieste-italy` remains excluded; Trieste copy explicitly states it is **not** a Venice/Ravenna terminal substitute.

## Provenance

| Item | Value |
|------|--------|
| Research SHA (unchanged) | `c015164efee5670cd2f216f8939495bd79bd773d1e8fc2350b10e3ba9d3b1ddf` |
| Verified draft SHA | `6f772bfeeba2ecd5782f450e8a2863bb2d15d1426da49124e2ca058bed859aea` |
| Passenger delta SHA | `f86d3d9b6bf94af452becb2e8ecdfe632fee9693f15faf7544a6de13224550fe` |
| Release bundle hash | `d7ac66c00c4eef89011ead8dd189a2f791e1eec003d51a5877d000fad2b2150f` |
| Sanitizer / prompt | `stage22-deterministic-v2.5-marker-strip`; Stage 28 `cache_key` invalidated (`null`) on candidate |
| Rollback | `qa-evidence/stage59-trieste-pilot/rollback-pre-apply/` |

## Consequence if owner later approves publication

A future scoped PR would lift **only** `trieste-italy` from hold ledgers by explicit owner commit to exclusion config—**not** implied by this preparation step.

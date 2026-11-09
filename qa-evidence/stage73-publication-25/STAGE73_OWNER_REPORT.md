# Stage 73 — Publication candidate (25 ports)

**Status:** READY_FOR_OWNER_REVIEW (candidate PR only — not authorized for production merge/deploy without owner approval)

| Item | Value |
|------|--------|
| Preparation PR | [#99](https://github.com/semprog25/seadays-landing/pull/99) @ `f5dde5afa91aa3f5564389148389224c51eb31cd` |
| Preparation bundle | `0e115b7f34302350026a532e8c8f9add4bb9965e77584894181059f80f0f0f8b` |
| Baseline `main` | `989c709f82ab8642ff285468998e41d8895a6a8c` |
| Rollback baseline passenger editorial | **319/406** |
| Candidate passenger editorial | **344/406** |
| Candidate slugs | **25** (`slugs_publication_candidate` — `slugs_approved` remains **[]**) |

## Authorization boundary (unchanged)

- `STAGE71_MANIFEST.json`: `owner_publication_authorized` **false**, `slugs_approved` **[]**, per-port `production_apply_allowed` **false**
- `stage71-apply-bootstrap-25.js`: **fail-closed** (exit 42)
- Candidate apply uses `publication_candidate_apply_permitted` on `STAGE73_PUBLICATION_MANIFEST.json` only

## Verification

| Check | Result |
|-------|--------|
| `stage73-prepare-publication-candidate.js` | PASS |
| `stage73-apply-publication-candidate.js` | PASS (targeted `generateBlogs --only=`, sitemap preserved) |
| `stage73-validate-publication-candidate.js` | PASS (25/25 HTML) |
| `test-stage73-publication-candidate.js` | PASS |
| Second apply (idempotency) | FAIL closed (`already passenger_editorial`) |
| Terminals JSON | unchanged vs rollback |
| CocoCay / Oslo / Kefalonia HTML | unchanged vs rollback |
| Unrelated guide mutations | none |

## Rollback blast radius

`qa-evidence/stage73-publication-25/rollback-pre-apply/` — full `public-port-guides.json`, `public-port-terminals.json`, and protected port HTML snapshots.

Reverting this PR restores **319** passenger editorial on `main`.

## Residual risks

- `research_status` remains **NEEDS_REVIEW** in research metadata (documented per-slug in sign-off report).
- Terminal map pins may remain unimported where research lacked coordinates (uncertainty preserved in passenger copy).
- Merge to `main` triggers GitHub Pages deploy for all touched `ports/*/index.html` — owner must approve before merge.

## Owner action required

Explicit approval to merge Stage 73 publication PR and deploy (separate from prep PR #99).

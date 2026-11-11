# Wave 1 — draft PR verification (branch only)

- **Branch:** `release/wave-01-batch-publication`
- **Reconciled main:** `c14c7792bc7ea3d2e4a49d836d3a103a867d5828` (PR #121 Ports V2)
- **Live production (unchanged until merge/deploy):** PE **356** / **406**
- **Branch PE:** **359** (post-promotion contract)

## Targeted tests (branch @ verification)

| Check | Result |
|-------|--------|
| `node scripts/test-wave01-publication-release.js` | PASS (PE 359) |
| `node scripts/assert-pages-deploy-publication-gate.js` | PASS |
| `npm run test:publication-batch-apply-safety` | PASS (idempotent apply skipped when PE≠356) |
| `npm run test:barcelona-publish-gate-known-failure` | PASS (EXPECTED_FAIL documented) |

## Policy exception scope

- **Runtime Stage 43 exceptions:** `mumbai-india`, `ravenna-italy`, `bod-norway` only (`WAVE01_OWNER_POLICY_EXCEPTION_SLUGS`)
- **Historical ledger:** unchanged
- **Indexing:** `owner_indexing_authorized=false`; pages retain **noindex, follow**
- **Deferred:** `mormugao-port-goa-india`, `goa-india`

## Production rollback plan (post-merge only)

1. Revert merge commit or restore `data/public-port-guides.json` + three `ports/*/index.html` from `qa-evidence/publication-batch-01/rollback-pre-apply/{slug}/`
2. Revert `stage43PublishedBaseline.js` / `historicalPolicyPublicationGate.js` exception wiring
3. Confirm PE **356** and `assert-pages-deploy-publication-gate` on main

## Command Center (paste)

- **Wave 1 publication:** DRAFT PR open — **359 PE on branch**; production **356** until owner merge/deploy
- **Slugs:** mumbai-india, ravenna-italy, bod-norway (noindex; no sitemap)
- **Excluded:** Mormugao/Goa
- **Barcelona publish gate:** known failure — not masked

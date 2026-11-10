# Stage 82 — Hamburg pilot graduation (owner review)

## Scope

Upgrade-in-place: single slug `hamburg-germany` (`appPortId` `hamburg`). **No** second Hamburg guide. **No** merge/deploy.

## Baselines

| Item | Value |
|------|--------|
| Production `main` | `0d1d845345b191e2b44ecd393062213e88fd3946` |
| Live passenger editorial | **355** / 406 |
| Projected if authorized | **356** / 406 (+1 Hamburg tier in JSON) |
| URL | `https://seadays.app/ports/hamburg-germany/` (unchanged) |

## Research

| Field | Value |
|-------|--------|
| `qa_verdict` | **PASS** |
| `research_sha256` | `e563b7c1ef6dd455adf4a08a1576388e73bc8c3bfccb4e93f4b2d5a01ddf1e82` |
| Research pin | `e5680f19d3ea86ce2261c3027894f2a45124e36b` |
| Index | `PORTS_MASTER_INDEX.json` (Downloads bundle 2026-11-06) |

## Candidate change (minimal)

- Add `researchImport` on existing `hamburg` guide with `publication_tier: passenger_editorial`
- Flags: `owner_publication_authorized: false`, `owner_indexing_authorized: false`
- Pilot HTML regen **only** `hamburg-germany`; robots kept **`noindex, follow`** until owner indexing authorization

## Stage 81 evidence reused

- **355/406** PE ceiling; Hamburg **Category A** `PILOT_HOLD_UPGRADE_ONLY` (not net-new cohort)
- **27** research-blocked ports untouched; no Stage 43 policy releases

## Rollback

`qa-evidence/stage82-hamburg-graduation/rollback-pre-apply/` — `public-port-guides.json` + `ports/hamburg-germany/index.html`

## Owner authorization required

1. **Publication:** set `owner_publication_authorized: true` on manifest + guide `researchImport` (merge PR only after)
2. **Indexing:** separate explicit flag `owner_indexing_authorized: true` to allow `index, follow` + sitemap eligibility

## Commands (candidate branch)

```bash
node scripts/stage82-prepare-hamburg-graduation.js
node scripts/stage82-apply-hamburg-candidate.js
node scripts/stage82-validate-hamburg-candidate.js
npm run test:stage82-hamburg-graduation
```

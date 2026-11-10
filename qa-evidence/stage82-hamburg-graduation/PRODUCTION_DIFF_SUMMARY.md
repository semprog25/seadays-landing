# Stage 82 production diff (candidate vs `origin/main` @ `0d1d8453`)

## Files touched (expected)

| Path | Change |
|------|--------|
| `data/public-port-guides.json` | `hamburg.researchImport` only (+ PE count 355→356 on branch) |
| `ports/hamburg-germany/index.html` | Targeted regen; `noindex, follow` preserved |
| `scripts/stage82-*.js` | Prep / apply / validate |
| `scripts/test-stage82-*.js` | Gate tests |
| `qa-evidence/stage82-hamburg-graduation/*` | Manifest, rollback, validation |

## Explicitly unchanged

- All other `355` passenger editorial guides (byte-stable vs rollback except Hamburg slot)
- `data/public-port-terminals.json`
- Sitemap / catalogue bulk regen
- 27 research-blocked ports
- Second Hamburg URL or slug

## Indexing

- **Candidate:** `meta robots` = `noindex, follow`
- **Live after merge without owner indexing auth:** still noindex until `owner_indexing_authorized: true`

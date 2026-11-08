# Stage 44 — Release file list

## Production (ship in PR)

- `data/public-port-guides.json` — 7 `byAppPortId` entries → `passenger_editorial`
- `ports/kagoshima-japan/index.html`
- `ports/katakolon-olympia-greece/index.html`
- `ports/korcula-croatia/index.html`
- `ports/malmo-sweden/index.html`
- `ports/penang-malaysia/index.html`
- `ports/rio-de-janeiro-brazil/index.html`
- `ports/shanghai-china/index.html`

## Release tooling (local / optional in PR)

- `scripts/stage44-prepare-release-candidate.js`
- `scripts/stage44-apply-7-port-release.js`
- `scripts/stage44-validate-release.js`
- `scripts/lib/publicGuideCopySanitize.js` — exports `isResearchItineraryCopy` for editorial gates

## Evidence (qa-evidence/stage44-7-port-release/)

- `STAGE44_RELEASE_MANIFEST.json`
- `STAGE44_APPLY_REPORT.json`
- `STAGE44_VALIDATION_REPORT.json`
- `STAGE44_FACTUAL_SPOT_CHECK.json`
- `proposed-guides/*.json` (7)
- `rollback/*.production-snapshot.json` (7 pre-apply snapshots)
- `rollback-pre-apply/` (full JSON + HTML snapshots — large, for owner rollback)

## Integrity

| Item | Value |
|------|-------|
| Stage 43 source bundle | `40be0c1e5d0d3c9b0578b745875ce78375173d25b2af8cfe2300aad4da567b66` |
| Stage 44 release bundle | `cd0ca7725432c3424e9439d913ac7e7ac362ce6fc6080c91030971b13ed1ddb0` |

## Tests (2026-11-08)

| Test | Result |
|------|--------|
| `node scripts/stage44-validate-release.js` | PASS |
| `node scripts/test-public-port-guides-no-research-markers.js` | PASS |
| `npm run test-seo-phase1` | PASS |
| `node scripts/smoke-port-guides.js` | FAIL (pre-existing barcelona assertion; unrelated to 7-port diff) |

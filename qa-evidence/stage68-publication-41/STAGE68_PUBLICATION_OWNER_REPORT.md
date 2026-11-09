# Stage 68 publication — 41 guides (owner review)

**Status:** READY FOR OWNER REVIEW  
**Preparation PR:** [#94](https://github.com/semprog25/seadays-landing/pull/94) (not merged)  
**Preparation bundle:** `d5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583`  
**Baseline main:** `cade908f94b1ff2fbcac86e14adca61c59db2f0b`  

## Applied cohort (41)

Exactly `STAGE68_MANIFEST.json` → `slugs_approved` from preparation bundle.

## Validation

| Check | Result |
|-------|--------|
| Release validation (`stage68-validate-publication-41.js`) | 41/41 PASS |
| Browser QA (`BROWSER_QA.json`) | 41/41 desktop + mobile PASS |
| Catalogue regen QA (`CATALOGUE_REGEN_QA.json`) | PASS (no body score downgrade) |
| `test-stage68-publication-41-release.js` | PASS |
| Terminals JSON | unchanged vs rollback |
| CocoCay call-plan cards | unchanged |
| Falmouth Jamaica | not published |
| Held slugs (6) | not in apply set |

## Projected totals after merge

- **313 / 406** passenger editorial (`public-port-guides.json`)
- **93** remaining in universe

## Rollback

`qa-evidence/stage68-publication-41/rollback-pre-apply/` — guides, terminals, port HTML snapshots (incl. CocoCay).

## Scope notes

- Alias facility pages (`jeddah-islamic-port`, `mina-salman`, `nordkapp`, `rugen`) published as standalone passenger guides for this release via `STAGE68_PUBLICATION_STANDALONE_ALIAS_SLUGS` (see `STAGE68_PUBLICATION_SLUG_MAP.json`).
- Corrected-draft `portInfo.description` merged when proposed guides had empty descriptions (generateBlogs passenger lead gate).

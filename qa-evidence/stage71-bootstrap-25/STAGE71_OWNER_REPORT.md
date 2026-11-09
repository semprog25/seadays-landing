# Stage 71 — Bootstrap 25 NEEDS_REVIEW ports (preparation only)

**Landing baseline:** `989c709f82ab8642ff285468998e41d8895a6a8c` (**319/406** passenger editorial, unchanged)  
**Research pin:** `77968a38ba420a4011af3b83b9d444c3e1552ad1` (research PR #2)  
**Status:** Preparation evidence only — **no merge, no deploy, no prod JSON/HTML apply**

## Merge deployment verification (landing PR #98)

| Check | Result |
|-------|--------|
| `main` HEAD | `989c709f82ab8642ff285468998e41d8895a6a8c` |
| Pages build `42639513202` | **success** @ merge SHA |
| Landing deploy `42639514418` | **success** |
| Live passenger editorial | **319** |
| CocoCay / Oslo / Kefalonia | HTTP **200**, call-plan cards present, **0** QA leak tokens |

Full artifact: `STAGE71_MERGE_DEPLOY_VERIFY.json`.

## Cohort lock (Stage 70 post-repair manifest)

- **25** slugs locked from `qa-evidence/stage70-yaml-repair-31/post_repair_COHORT_MANIFEST.json`
- **Hamburg** pilot held; **Category A deferred** slugs excluded by policy
- **`publication_bucket`:** unchanged **NEEDS_REVIEW** for all 25
- **Research SHA:** **25/25** verified against merged research commit

## Preparation gates

| Bucket | Count |
|--------|------:|
| Technical preparation **PASS** (all publication prep gates) | **25** |
| **HELD** (prep blocked) | **0** |
| **BLOCKED** | **0** |
| Owner bucket `READY_FOR_OWNER_APPROVAL` | **25** |

Bundle hash: `83ae6cd1be69d37c061035f44f222e30e886c40e29ec2f28d3fd84950cdbe944` (`STAGE71_MANIFEST.json`).

Per slug: passenger short / standard / longer call plans in `corrected-drafts/*.json` (`shoreTimePlanner.plans`); terminal proposals in `terminals-proposed/`; HTML previews under `previews-local-only/` (not published).

## Pipeline

1. `node scripts/stage71-lock-cohort-25.js`
2. `node scripts/stage71-prepare-bootstrap-25.js`
3. `node scripts/test-stage71-bootstrap-25-prep.js`

## Owner approval required before any apply

- Review `STAGE71_MANIFEST.json`, `RECOVERY_RESULTS.json`, and spot previews.
- **Do not merge this PR** until owner authorizes a separate publication stage.
- Category **C/D/E/F** holds remain untouched; no promotion of Hamburg or deferred Category A pilots.

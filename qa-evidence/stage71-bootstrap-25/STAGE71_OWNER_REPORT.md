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

Bundle hash: `ad302209b9024cb33def7bed45e6b3558c5deaafc5b91b5eb41ebac2c4f54ace` (`STAGE71_MANIFEST.json` after Stage 72 repairs).

**Stage 72 editorial review:** `STAGE72_OWNER_REPORT.md`, `EDITORIAL_REVIEW_REPORT.json`, `STAGE72_REPAIRS_APPLIED.json` — **25/25 EDITORIAL_PASS** for passenger copy (metadata uncertainties remain; no `owner_publication_authorized`).

## Publication safety (final review)

| Field | Meaning |
|-------|---------|
| `technical_apply_eligible` | **25/25** — prep gates only |
| `production_apply_allowed` | **false** on every port until a future owner-authorized apply stage |
| `owner_publication_authorized` / `production_apply_permitted` | **false** at manifest root |
| `slugs_approved` | **[]** (empty — use `slugs_technical_eligible`) |

Apply path: `scripts/stage71-apply-bootstrap-25.js` — **fail-closed** (exit 42) without owner authorization. Stage 68 apply remains bound to its own bundle hash.

## Cohort exclusions (not in the locked 25)

| Class | Slugs |
|-------|--------|
| **Category A deferred prep (6)** | hobart, marigot, nagasaki, nordfjordeid, okinawa-naha, stornoway |
| **Pilot hold** | hamburg-germany |
| **Historical owner/policy (6)** | tokyo-yokohama, kirkenes, ocho-rios, glasgow, rostock, falmouth-jamaica |

Artifact: `PUBLICATION_AUTHORIZATION_BOUNDARY.json`, tests: `test-stage71-publication-safety.js`.

Per slug: passenger short / standard / longer call plans in `corrected-drafts/*.json` (`shoreTimePlanner.plans`); terminal proposals in `terminals-proposed/`; HTML previews under `previews-local-only/` (not published).

## Pipeline

1. `node scripts/stage71-lock-cohort-25.js`
2. `node scripts/stage71-prepare-bootstrap-25.js`
3. `node scripts/test-stage71-bootstrap-25-prep.js`

## Owner approval required before any apply

- Review `STAGE71_MANIFEST.json`, `RECOVERY_RESULTS.json`, and spot previews.
- **Do not merge this PR** until owner authorizes a separate publication stage.
- Category **C/D/E/F** holds remain untouched; no promotion of Hamburg or deferred Category A pilots.

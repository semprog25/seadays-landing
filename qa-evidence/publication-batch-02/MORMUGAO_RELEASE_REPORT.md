# Batch 02 — Mormugao publication prep (local only)

**Verdict:** **PASS** (identity + isolated candidate prep)  
**Worktree:** `.worktrees/publication-batch-02-mormugao` @ `bdd1802dd639a388268dcba5d154c5c12fd93e79`  
**Production PE (unchanged):** **359 / 406**  
**Projected PE after authorized merge:** **360 / 406**  
**Not authorized:** publication, indexing, Stage 43 clearance, commit, push, merge, deploy

---

## Owner decisions recorded

| Artifact | Status |
|----------|--------|
| `GOA_CANONICAL_OWNER_DECISION.json` | **APPROVE_GOA_CANONICAL_IDENTITY** (identity only) |
| `BATCH_02_POLICY_CLEARANCE.json` | Conditional prep only; auth flags **false** |
| `BATCH_02_MANIFEST.json` | Single slug `mormugao-port-goa-india` |

**Canonical:** `mormugao-port-goa-india` · `app_port_id=mormugao`  
**Alias:** `goa-india` → redirect only (unchanged on disk)

---

## Mormugao candidate reconciliation

| Field | Value |
|-------|--------|
| `proposed_content_hash` | `8caad9f29e041c5f1c4f6b85c3e9699db0e8ab9536ecbd093ff050f7b92420e4` (Batch 01 correction) |
| `research_sha256` | `2f823be6c62f9da5d7eab23f896e2066cb7c122770e3d9801c190231200b18da` |
| `field_exclusions` | `thingsToDo.topThings[2]` |
| `research_main_pin` | `e5680f19d3ea86ce2261c3027894f2a45124e36b` |
| Prep bundle hash | `e4c713910d639ff2e27fc9c24988019a1e938b868259bc5ade64281bb1d96c08` |

Lead copy uses **MPA / Break Water Berth** facts (corrected proposed guide); excludes prior mining-forward stub description on production HTML.

**Candidate tree:** `qa-evidence/publication-batch-02/candidates/mormugao-port-goa-india/`  
**Rollback:** `qa-evidence/publication-batch-02/rollback-pre-apply/mormugao-port-goa-india/`

---

## Goa alias verification (unchanged)

- `buildPortAliasRedirectMap()`: `goa-india` → `mormugao-port-goa-india`
- Production `ports/goa-india/index.html`: noindex, canonical + redirect to Mormugao
- Production `ports/mormugao-port-goa-india/index.html`: **stub** (&lt;3 call plans), noindex
- `test-port-seo-redirects.js`: **PASS**
- `test-port-guide-human-approved-hero.js`: **PASS** (goa-india excluded from hero regen set)

---

## Excluded (per policy)

- `goa-india` — not a PE candidate
- `eilat-israel` — not in Batch 02 manifest
- All other Stage 43 / research-blocked ports — unchanged

---

## Tests run (targeted)

| Test | Result |
|------|--------|
| `publication-batch-02-workflow.js` matrix / prepare / apply | **PASS** |
| `test-publication-batch-02-mormugao.js` | **PASS** |
| `assert-pages-deploy-publication-gate.js` (with batch-01 candidate env) | **PASS** |
| `test-wave01-publication-release.js` | **PASS** |
| `test-publication-batch-apply-safety.js` | **PASS** |
| `test-historical-policy-pages-deploy-gate.js` | **Not run** — Bodø/Mumbai/Ravenna are live PE on this baseline; gate assumes pre–Wave 1 stubs |

---

## QA files touched (local worktree only)

**New**

- `qa-evidence/publication-batch-02/GOA_CANONICAL_OWNER_DECISION.json`
- `qa-evidence/publication-batch-02/BATCH_02_POLICY_CLEARANCE.json`
- `qa-evidence/publication-batch-02/BATCH_02_MANIFEST.json`
- `qa-evidence/publication-batch-02/PREP_MANIFEST.json`
- `qa-evidence/publication-batch-02/APPLY_REPORT.json`
- `qa-evidence/publication-batch-02/REMAINING_PORT_STATUS_MATRIX.json`
- `qa-evidence/publication-batch-02/FUTURE_RELEASE_CODE_CHANGES.md`
- `qa-evidence/publication-batch-02/candidates/mormugao-port-goa-india/**`
- `qa-evidence/publication-batch-02/rollback-pre-apply/mormugao-port-goa-india/**`
- `scripts/publication-batch-02-workflow.js`
- `scripts/test-publication-batch-02-mormugao.js`

**Reconciled (local)**

- `qa-evidence/stage53-11-port-release/proposed-guides/mormugao-port-goa-india.json` — Batch 01 corrected body (hash `8caad9f29…`)

**Production `data/` + `ports/` (main tree):** **byte-unchanged** after apply restore

---

## Remaining authorization (before 359→360)

1. **`owner_publication_authorized: true`** on policy clearance + guide JSON (separate from identity approval)
2. **Stage 43 exception** for `mormugao-port-goa-india` only — see `FUTURE_RELEASE_CODE_CHANGES.md`
3. **PE validators** 359 → 360 (`validate-pages-jekyll-output.js`, etc.)
4. **`owner_indexing_authorized`** — still **false**; sitemap unchanged
5. PR, merge, deploy, Supabase — **not authorized**

**Smallest safe next step when publication is approved:** merge evidence + code patch from this worktree; apply candidate from `candidates/mormugao-port-goa-india/` under historical gate with Wave-02 policy exception; do not touch `goa-india` redirect.

# Mormugao Batch 02 — release readiness (local verification)

**Verdict:** **PASS**  
**Worktree:** `.worktrees/publication-batch-02-mormugao`  
**HEAD:** `bdd1802dd639a388268dcba5d154c5c12fd93e79` (= `origin/main`, no drift)  
**Production PE:** **359 / 406** (unchanged)  
**Not authorized:** Stage 43 exception, publication/indexing, merge, deploy

---

## Why the historical gate test was skipped (root cause)

`test-historical-policy-pages-deploy-gate.js` assumed **all** Wave 1 slugs (`bod-norway` especially) remain **stubs** (&lt;3 `pg-call-plan-card` articles). After PR #123, **Mumbai, Ravenna, Bodø** are authorized passenger-editorial HTML with **3 call plans** and `owner_publication_authorized: true`. The gate implementation already exempts them via `WAVE01_OWNER_POLICY_EXCEPTION_SLUGS`; only the **test fixture** was stale.

---

## Test change (minimal, local worktree)

**File:** `scripts/test-historical-policy-pages-deploy-gate.js`

| Change | Purpose |
|--------|---------|
| `assertWave01AuthorizedEditorialHtmlOk()` | Asserts Wave 1 slugs have auth flag + ≥3 call plans and no html violations |
| `assertUnauthorizedEditorialHtmlFails()` | Negative HTML case moved to **`mormugao-port-goa-india`** (still held stub) |
| `assertMormugaoUnauthorizedGuidePromotionFails()` | Synthetic unauthorized PE on Mormugao in `public-port-guides.json` must trip gate |

**Unchanged negative coverage**

- Bodø guide leak with `owner_publication_authorized: false` still fails (`assertUnauthorizedGuidesPromotionFails`)
- Mormugao synthetic 3-call-plan HTML in temp dir fails gate
- Mormugao unauthorized `passenger_editorial` in guides fails gate
- Candidate env vars do not bypass `assert-pages-deploy-publication-gate.js`
- Trieste Stage 60 exception
- Jekyll `qa-evidence` exclude test
- Barcelona known failure test still **EXPECTED_FAIL** (not suppressed)

---

## Targeted test results

| Test | Result |
|------|--------|
| `test-historical-policy-pages-deploy-gate.js` | **PASS** |
| `test-publication-batch-02-mormugao.js` | **PASS** |
| `test-wave01-publication-release.js` | **PASS** (in batch-02 suite) |
| `test-publication-batch-apply-safety.js` | **PASS** |
| `test-port-seo-redirects.js` | **PASS** (in batch-02 suite) |
| `test-port-guide-human-approved-hero.js` | **PASS** |
| `assert-pages-deploy-publication-gate.js` | **PASS** |
| `test-barcelona-publish-gate-known-failure.js` | **PASS** (documented fail) |

---

## Production unchanged

`git diff` on `data/`, `ports/goa-india`, `ports/mormugao-port-goa-india`, `sitemap.xml`, `robots.txt`: **empty**

- **`goa-india`:** redirect-only → Mormugao  
- **`mormugao-port-goa-india`:** noindex; **0** passenger call-plan cards in production HTML; guide slot **not** passenger-editorial authorized

---

## Candidate hashes (isolated prep)

| Field | Value |
|-------|--------|
| `proposed_content_hash` | `8caad9f29e041c5f1c4f6b85c3e9699db0e8ab9536ecbd093ff050f7b92420e4` |
| `research_sha256` | `2f823be6c62f9da5d7eab23f896e2066cb7c122770e3d9801c190231200b18da` |
| Prep bundle | `e4c713910d639ff2e27fc9c24988019a1e938b868259bc5ade64281bb1d96c08` |
| Goa identity | `GOA_CANONICAL_OWNER_DECISION.json` |

**Candidate path:** `qa-evidence/publication-batch-02/candidates/mormugao-port-goa-india/`

---

## Remaining approvals (359 → 360 PR)

1. `owner_publication_authorized: true` (separate from identity approval)  
2. Stage 43 runtime exception for **Mormugao only** — see `FUTURE_RELEASE_CODE_CHANGES.md`  
3. PE validators **359 → 360**  
4. `owner_indexing_authorized` still **false** until explicit sign-off  
5. Commit test fix + batch-02 evidence in **seadays-landing** PR (this worktree is not on main)

---

## Smallest safe next release step

1. Open PR from worktree branch with: historical gate test fix, `publication-batch-02` evidence, Goa decision JSON, Mormugao candidate artifacts (no production apply in same PR unless owner signs publication).  
2. After publication authorization: add `BATCH02_OWNER_POLICY_EXCEPTION_SLUGS` + bump validators; apply candidate under historical gate; deploy.  
3. Do **not** alter `goa-india` redirect or promote duplicate Goa PE.

**Stop:** local verification complete; no publish.

# Publication Batch 01 — Owner Review Report

**Verdict: PASS (local prep only — no merge, deploy, or publication authorized)**

| Field | Value |
| --- | --- |
| Baseline `main` | `4a6bd259707a8933658547e26a9d0657c8758b74` |
| Branch / worktree | `feat/publication-batch-01` @ `/Users/sharanestone/Semprog/seadays-landing/.worktrees/publication-batch-01` |
| Production PE | **356 / 406** (unchanged after apply + restore) |
| Remaining matrix | **50** (14 historical policy-held, 36 otherwise blocked) — reconciles with 356+50=406 |
| Owner publication auth | **false** (all four candidates) |

## Candidates (policy-held — not authorized for live publication)

| Slug | Source | QA / research SHA | Missing facts / limitations | Prep |
| --- | --- | --- | --- | --- |
| `bod-norway` | Reuse Stage 89 `candidate-applied/` | PASS · `937ad03d…` | None beyond historical Stage 43 hold | **PASS** (reused) |
| `mumbai-india` | Stage 53 proposed | PASS · `9f2197b3…` | `field_exclusions`: `thingsToDo.topThings[2]`; door GPS null per research | **PASS** |
| `ravenna-italy` | Stage 53 proposed | PASS · `aef11192…` | Historical policy hold only | **PASS** |
| `mormugao-port-goa-india` | Stage 53 proposed | PASS · `2f823be6…` | `field_exclusions`: `thingsToDo.topThings[2]` | **PASS** |

**Deferred:** `eilat-israel` (and all other ports) — not in Batch 01 scope.

## Policy

- Stage 43 historical ledger **unchanged**; no per-port exception without explicit owner authorization.
- `BATCH_01_POLICY_CLEARANCE.json`: conditional prep only; `SEADAYS_PUBLICATION_BATCH_01_CANDIDATE=1` is local regen tooling, **not** publication authorization.
- Bodø remains integrated with Stage 89 evidence; production stub stays `noindex` with ≤2 call-plan cards.

## Release diff (would ship if owner authorizes later — **not applied to production**)

| Area | Production `main` | Batch 01 branch |
| --- | --- | --- |
| `data/public-port-guides.json` | unchanged | unchanged (SHA matches HEAD) |
| `ports/**` (four slugs) | unchanged stubs | unchanged after restore |
| New tooling | — | manifest workflow + deploy gate step |
| QA evidence | Stage 89 Bodø only | `qa-evidence/publication-batch-01/` candidates + matrix |

Candidate HTML + guide JSON live under `qa-evidence/publication-batch-01/candidates/<slug>/` (Jekyll-excluded).

## Targeted tests (local)

```bash
npm run publication-batch:matrix
npm run publication-batch:prepare
npm run publication-batch:apply
npm run test:publication-batch-01          # PASS
npm run test:stage92-bodo-publication-safety  # PASS (via batch test)
npm run test:barcelona-publish-gate-known-failure  # PASS (documents EXPECTED_FAIL)
node scripts/assert-pages-deploy-publication-gate.js  # PASS (clears candidate env)
```

**Not claimed green:** full `test:publish-gate` — Barcelona regression tracked separately in `BARCELONA_PUBLISH_GATE_KNOWN_FAILURE.json`. Barcelona production HTML **not modified**.

## Rollback

- Production: already at baseline; no rollback required.
- Evidence: delete `qa-evidence/publication-batch-01/candidates/` and re-run `publication-batch:apply` from `PREP_MANIFEST.json` if regenerating.
- Per-slug rollback snapshots: `qa-evidence/publication-batch-01/rollback-pre-apply/<slug>/` (from transient apply).

## Changed files (this worktree only)

- `.github/workflows/deploy.yml` — `assert-pages-deploy-publication-gate.js` before Pages publish
- `package.json` — `publication-batch:*` and `test:publication-batch-01` scripts
- `scripts/lib/bulkPortPublication/stage43PublishedBaseline.js` — Batch 01 conditional candidate slugs (env-gated)
- `scripts/lib/bulkPortPublication/{buildRemainingPortStatusMatrix,preparePublicationBatchCandidate,applyPublicationBatchCandidate}.js`
- `scripts/publication-batch-workflow.js`, `scripts/assert-pages-deploy-publication-gate.js`
- `scripts/test-publication-batch-01.js`, `scripts/test-barcelona-publish-gate-known-failure.js`
- `qa-evidence/publication-batch-01/**` (manifest, matrix, policy, prep/apply reports, four candidate trees)

**No commit / PR / push / deploy** per owner scope.

# Stage 89 — Bodø conditional policy exception & editorial candidate (owner review)

## Recommendation

**READY_FOR_OWNER_REVIEW** (local candidate only — **not** authorized for merge, deploy, indexing, or publication)

## Policy-exception boundaries

| Gate | Status |
|------|--------|
| Owner conditional prep (Bodø only) | **Authorized** (`STAGE89_POLICY_CLEARANCE.json`) |
| `owner_publication_authorized` | **false** |
| `owner_indexing_authorized` | **false** |
| Merge / deploy / PR | **Not authorized** |
| Sitemap / indexing on `seadays.app` | **Unchanged** (production remains **356/406** PE) |
| `STAGE43_HARD_EXCLUDE_HISTORICAL` ledger | **Unchanged** — `bod-norway` still listed |
| Stage 29 slug-specific HTML failure artifact | **None** on record |
| Stage 28 / Stage 53 technical validation | **PASS** (reused evidence) |
| Stage 33/43 historical exclusion | **Retained** in audit history |

Runtime tooling only: set `SEADAYS_STAGE89_BODO_CANDIDATE=1` to lift **active** hard-exclude for local apply/tests. Without that env var (and without this branch merged), production policy behavior is unchanged.

## Baselines

| Item | Value |
|------|--------|
| Base `main` (verified) | `d9f3a8e7eaeb51c80a3b54813d1f815064974758` |
| Candidate worktree branch | `stage89/bodo-candidate-local` (uncommitted local changes on base above) |
| Production live PE | **356** / 406 |
| Candidate local PE | **357** / 406 (+1 `bod-norway`) |
| Slug | `bod-norway` |
| App port ID | `bodo` |

## Research verification

| Field | Value |
|-------|--------|
| `qa_verdict` | **PASS** |
| `research_sha256` | `937ad03d7b3d328d8f147f3824f9d6dce461c9349b5b06aecdb33e2b11a434a5` |
| Research pin | `e5680f19d3ea86ce2261c3027894f2a45124e36b` |
| Proposed guide | `qa-evidence/stage53-11-port-release/proposed-guides/bod-norway.json` |
| Proposed content hash | `0882826222fe39fcb697de28ae021dfac5e3e025bb225e844ba7ce505a6790be` |

## Changed files (candidate diff)

| File | Summary |
|------|---------|
| `data/public-port-guides.json` | `byAppPortId.bodo` upgraded to passenger editorial from Stage 53 proposed guide + traveler Q&A from research |
| `ports/bod-norway/index.html` | Regenerated editorial page only for this slug; `noindex, follow`; canonical preserved |
| `scripts/lib/bulkPortPublication/stage43PublishedBaseline.js` | Env-gated `SEADAYS_STAGE89_BODO_CANDIDATE=1` exception (historical ledger intact) |
| `scripts/stage89-*.js`, `scripts/test-stage89-*.js` | Prepare / apply / validate / test harness |
| `qa-evidence/stage89-bodo-candidate/*` | Policy clearance, manifests, rollback, validation |
| `package.json` | `test:stage89-bodo-candidate` |

**Not changed:** Hamburg (`hamburg-germany`), other port guides, sitemap, Supabase, global catalogue regen.

## Targeted test results

```bash
export SEADAYS_STAGE89_BODO_CANDIDATE=1
node scripts/stage89-prepare-bodo-candidate.js          # PASS
node scripts/stage89-apply-bodo-candidate.js            # PASS → PE 357
node scripts/stage89-validate-bodo-candidate.js         # PASS
npm run test:stage89-bodo-candidate                    # PASS (3 call plans, JSON-LD 1×3, double regen stable)
node scripts/test-stage89-candidate-leak-guard.js       # PASS
```

`RELEASE_VALIDATION.json` records JSON-LD counts, call-plan cards (3), robots `noindex, follow`.

## Editorial / factual scope delivered

- Three call plans (short / standard / longer) from verified copy in proposed guide
- Conservative terminal / transport wording (no invented berth dimensions or walking times)
- Port of Bodø / Bodø Havn contact and terminal-address facts from research (no invented GPS)
- Saltstraumen references include tidal-timing / safety framing in call plans and copy
- Traveler Q&A merged from research markdown into `researchImport.travelerQuestions` → FAQ JSON-LD
- Existing Viator campaign preserved as `campaign=seadays-web-sbod-norway` (post-regen patch; generator default is `pbodo`)

## Unresolved factual limitations (owner awareness)

- No published berth length/depth table on captured Port of Bodø cruise page — quay-level precision not asserted
- City-centre vs terminal distance **not verified** — copy defers to ship briefing
- Saltstraumen excursion timing **not** specified as tide windows — only “tidal timing critical” / safety framing
- Shuttle schedules, museum opening hours, and precise coach durations **not** invented
- `~90 min` centre walk is editorial time estimate where walkability from berth is conditional, not verified transport data

## Rollback

```bash
cd /Users/sharanestone/Semprog/seadays-landing/.worktrees/stage89-bodo-candidate
cp qa-evidence/stage89-bodo-candidate/rollback-pre-apply/public-port-guides.json data/public-port-guides.json
cp qa-evidence/stage89-bodo-candidate/rollback-pre-apply/ports/bod-norway/index.html ports/bod-norway/index.html
unset SEADAYS_STAGE89_BODO_CANDIDATE
```

Restore produces **356/406** PE and pre-candidate HTML snapshot.

## Next steps (require separate owner authorization)

1. Review candidate HTML locally (`ports/bod-norway/index.html`)
2. If approved for integration: authorize PR creation, merge, publication flags, and (separately) indexing
3. Do **not** merge this worktree state without explicit publication + policy decision on Stage 43 historical hold

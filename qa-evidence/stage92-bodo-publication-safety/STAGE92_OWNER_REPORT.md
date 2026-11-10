# Stage 92 — Bodø publication gate hardening (local, no merge)

## Root cause (Stage 91)

`owner_publication_authorized` was **metadata only**. `usesPassengerEditorialLead` / `countPassengerEditorialGuides` key off `publication_tier === passenger_editorial` with no auth check. Merging PR #115 would deploy committed `ports/bod-norway/index.html` and raise PE to **357** despite flags `false`.

## Safety mechanism

1. **Artifact separation** — Editorial Bodø lives only under `qa-evidence/stage89-bodo-candidate/candidate-applied/` (`byAppPortId.bodo.json` + `ports/bod-norway/index.html`). Merge tree restores `data/public-port-guides.json` and `ports/bod-norway/index.html` from `rollback-pre-apply` (**356/406**, stub HTML).
2. **Fail-closed gate** — `scripts/lib/bulkPortPublication/historicalPolicyPublicationGate.js`:
   - For slugs in `STAGE43_HARD_EXCLUDE_HISTORICAL` (except Stage 60 trieste exception), **block** `passenger_editorial` in guides JSON unless `owner_publication_authorized === true`.
   - **Block** port HTML with ≥3 passenger call-plan cards for those slugs without the same authorization (catches HTML-only leaks).
3. **CI hook** — `scripts/test-publish-gate.js` calls `assertHistoricalPolicyPublicationGate` before pass (generation channel already runs apply-publish-gate after generate).
4. **Idempotent script** — `scripts/stage92-separate-bodo-production-from-candidate.js` snapshots candidate (if needed), restores rollback, runs stage92 test.

No new `publication_tier` value on `main`. Stage 89 env `SEADAYS_STAGE89_BODO_CANDIDATE` unchanged (tooling only; not used in production gate).

## Counts

| Tree | PE | Bodø HTML |
|------|-----|-----------|
| Production / merge-ready (this branch after Stage 92) | **356/406** | Stub (`rollback-pre-apply`) |
| Owner review candidate | **357/406** equivalent | `candidate-applied/` (3+ call plans, `noindex`) |

## Changed files (local, not pushed)

- `data/public-port-guides.json` — reverted to pre-candidate
- `ports/bod-norway/index.html` — reverted to stub
- `qa-evidence/stage89-bodo-candidate/candidate-applied/*` — preserved editorial
- `scripts/lib/bulkPortPublication/historicalPolicyPublicationGate.js` — new gate
- `scripts/test-stage92-bodo-publication-safety.js` — targeted regression
- `scripts/stage92-separate-bodo-production-from-candidate.js` — separate helper
- `scripts/test-publish-gate.js` — asserts gate
- `scripts/stage89-apply-bodo-candidate.js` — writes `candidate-applied` on local apply
- `package.json` — `test:stage92-bodo-publication-safety`

## Targeted tests (PASS locally)

```bash
npm run test:stage92-bodo-publication-safety
node scripts/test-publish-gate.js
```

`test:stage89-bodo-candidate` remains for **local apply workspace** (`SEADAYS_STAGE89_BODO_CANDIDATE=1` + stage89-apply); not for merge-ready tree.

## PR #115 update

**Can be safely updated** (with owner authorization to push): drop committed production mutation; add Stage 92 gate + `candidate-applied` + reverted `data/` and `ports/bod-norway`. Remote PR still at `bfce91d7` (unsafe merge state) until that update is pushed.

## Remaining owner approvals

1. `owner_publication_authorized` before promoting JSON/HTML from `candidate-applied` to production paths
2. `owner_indexing_authorized` before robots/sitemap promotion
3. Explicit Stage 43 publication decision for Bodø

No merge, deploy, or PR push performed in Stage 92.

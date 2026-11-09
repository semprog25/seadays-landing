# Stage 50 — Bundle identity reconciliation

## Question

Reconcile owner prompt reference **`01fde17fccfd4708abd77664807d53773b2c7f5731c01e1f8efea113f53a34aa`** with on-disk Stage 45 rescore **`f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214`**.

## Method

1. Byte-compare `STAGE45_50_PORT_RESCORE.json` on PR #78 vs `stage43-port-planning` worktree (**identical**).
2. Recompute bundle hash using **`stage43-prepare-next-cohort.js`** algorithm:

```text
sha256(stableStringify(
  ports.filter(has candidate_content_hash)
    .map({ landing_slug, candidate_content_hash, draft_file_sha256 })
    .sort(by landing_slug)
))
```

3. Trial alternate definitions for `01fde17f` (40-ready subset, 33-release subset, JSON file SHA, concatenated draft SHAs) — **no match**.

4. Repository + transcript search — **`01fde17f` never written by any landing script or artifact** (first appearance: Stage 49 user prompt).

## Findings

| Artifact | Hash | Notes |
|----------|------|--------|
| Stage 45 rescore (50 cohort rows) | `f13e73e56c6a099c…` | **Recalculated MATCH** |
| Stage 45 ready-only (40 rows) | `c36474f570f8f862…` | Different definition |
| Stage 49 release manifest (33) | `74305cf8a7298f1ec…` | **Recalculated MATCH** on PR #78 |
| STAGE45 JSON file SHA-256 | `234047aef6f1e7ad…` | Not a bundle id |
| Owner ref `01fde17f…` | — | **Orphan / unverified** |

## Cohort identity (unchanged)

- **50** pilot drafted in Stage 45 rescore file (`ports[]` with `candidate_content_hash`).
- **40** `READY_FOR_OWNER_APPROVAL` (all `stage22-deterministic-v2.5-marker-strip`).
- **33** release = 40 minus PR #76 seven (`kagoshima-japan` … `shanghai-china`).
- Per-port **research_sha256** and **draft_file_sha256** on PR manifest match Stage 45 rescore rows and on-disk `qa-evidence/stage45-rescore/drafts` (verified at Stage 49 prepare).

## Conclusion

- **`01fde17f` is not the Stage 45 rescore bundle** under any implemented landing hash function.
- **Content identity is proven** via `f13e73e56c…` and stable 33-port membership.
- **Action:** Treat **`f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214`** as the authoritative Stage 45 rescore bundle; **retire `01fde17f` from runbooks** unless owner supplies a matching artifact.

**Publication blocked on content drift?** **No** — mismatch is a **label error**, not proven cohort or draft drift.

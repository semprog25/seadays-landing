# Port images Batch 05 — release readiness (local only)

**Signal:** `PORT_IMAGES_BATCH05_RELEASE_READY`  
**Worktree:** `seadays-landing/.worktrees/port-images-batch05-20261113`  
**Branch:** `chore/port-images-batch05-publication-prep`  
**Base:** `origin/main` @ `00706a8f` (includes confirmed baseline `418dd0df` via ancestry)

## 1. Fifteen-port decision reconciliation

| Port | Owner decision | Selected ID | Geo | Licence | Publication |
|------|----------------|-------------|-----|---------|-------------|
| abu-dhabi-united-arab-emirates | APPROVE_A | pexels:28448972 | OK | Pexels | **IN RELEASE** |
| akureyri-iceland | APPROVE_A | pexels:39722916 | OK | Pexels | **IN RELEASE** |
| alesund-norway | APPROVE_B | pexels:16049184 | OK | Pexels | **SKIP** — already `humanApproved` (owner-downloads-53) on main |
| alexandria-egypt | APPROVE_A | pexels:15238719 | OK | Pexels | **IN RELEASE** |
| anchorage-ak-united-states | APPROVE_B | unsplash:8UCTwY4mrVA | OK | Unsplash | **IN RELEASE** |
| antalya-turkey | APPROVE_A | pexels:31566939 | OK | Pexels | **IN RELEASE** |
| antwerp-belgium | APPROVE_A | pexels:14529110 | OK | Pexels | **IN RELEASE** |
| boston-ma-united-states | APPROVE_A | pexels:12754933 | OK | Pexels | **IN RELEASE** |
| brisbane-australia | APPROVE_A | pexels:37183850 | OK | Pexels | **IN RELEASE** |
| dubai-united-arab-emirates | APPROVE_B | pexels:7168553 | NEEDS_GEO_REVIEW | Pexels | **EXCLUDED** |
| galveston-tx-united-states | APPROVE_A | pexels:2386404 | OK | Pexels | **IN RELEASE** |
| new-orleans-la-united-states | APPROVE_B | pexels:22430898 | OK | Pexels | **IN RELEASE** |
| port-canaveral-fl-united-states | APPROVE_A | wikimedia:Exploration_Tower…2024.jpg | OK | CC BY 4.0 | **IN RELEASE** (attribution in hero figcaption) |
| vancouver-bc-canada | APPROVE_A | pexels:30452908 | OK | Pexels | **IN RELEASE** |
| aberdeen-united-kingdom | APPROVE_B | pexels:5684661 | NEEDS_GEO_REVIEW | Pexels | **EXCLUDED** |

Ledger: `data/destination-photo-batch-05-owner-review-v1-decisions.json` (`DECISIONS_FROZEN`, 2026-11-06).  
Evidence: `qa-evidence/destination-batch-05-20261106/BATCH05_DECISIONS_RECONCILIATION_REPORT.md`, `batch05-contact-sheet-verification.json` (when present).

## 2–4. Counts

- **Owner-frozen approvals:** 15/15  
- **Safe publication (this release):** 12  
- **Already live / skip replace:** 1 (Ålesund)  
- **Excluded (geo):** 2 (Dubai, Aberdeen)  
- **Already live from this batch on production:** 0/12 (none of the 12 were `humanApproved` on `origin/main`)

## 5. Changed files

**42 paths** vs `origin/main` (16 modified tracked + 26 new/untracked), including 12 WebP assets, 12 port guides, `ports/index.html`, 5 batch-05 data JSONs, review-state, owner-candidates, catalog, scripts, QA.

## 6. humanApproved

- **Production (`origin/main`):** 96  
- **Local worktree after apply:** 108 (+12 new; Ålesund unchanged at 96 baseline entry)

## 7. Targeted tests (all PASS)

- `test-destination-photo-batch-05-owner-decisions.js`  
- `test-port-images-batch05-publication.js` (12 slugs)  
- `test-destination-image-catalog.js`  
- `test-destination-image-source-policy.js`  
- Apply report: `qa-evidence/port-images-batch05-20261113/BATCH05_APPLY_REPORT.json`

## 8. Workflow classification

`channel=skip` — see `DRAFT_PR_CLASSIFICATION.json` (no broad bot regeneration on merge).

## 9. Single release approval request

**Approve one scoped PR** from `chore/port-images-batch05-publication-prep` → `main` in `semprog25/seadays-landing`:

1. Commit all 42 paths in the worktree (batch 05 ledgers, 12 WebPs, 12 port HTML + directory index, review-state, owner-candidates, catalog, apply/test scripts, QA).  
2. Open PR; title suggestion: `feat(ports): Batch 05 destination photography (12 ports, geo holds deferred)`.  
3. Merge when `ports-directory-photography` + Pages deploy succeed.  
4. **Do not** merge Dubai/Aberdeen until geo review closes.  
5. No Tokyo/Slovenia/Batch 03–04 rework in this PR.

No separate approval needed per git step if the above scope is accepted.

---

**Tracker (SD-UX-02):** Batch 05 local publication prep complete — 12/15 ports release-ready; Dubai/Aberdeen remain blocked; Ålesund preserved. SD-UX-02 stays **IN_PROGRESS** until PR merged + live verify. SD-UX-01 **IN_PROGRESS**.

# Stage 71 publication-safety review

**Verdict:** **PREP_READY** (owner review of prep bundle — not authorized for apply)

## 1. Exclusion classification

| Bucket | Count | Notes |
|--------|------:|-------|
| Locked cohort | **25** | Unchanged slug list |
| Category A deferred preparation | **6** | NEEDS_REVIEW Category A, not net-new cohort |
| Pilot held | **1** | `hamburg-germany` (PASS bucket) |
| Historical owner/policy | **6** | `STAGE69_OWNER_HOLD` + Falmouth homonym |

Removed ambiguous `category_a_deferred_excluded` mixed list.

## 2. Publication authorization boundary

- `technical_apply_eligible` = preparation gates passed (does **not** authorize production).
- `production_apply_allowed` = **false** on all ports in this prep PR.
- `owner_publication_authorized` / `production_apply_permitted` = **false** on manifest.
- `stage71-apply-bootstrap-25.js` exits **42** without owner auth (proven in `test-stage71-publication-safety.js`).
- `stage68-apply-publication-41.js` cannot consume Stage 71 artifacts (hard-coded Stage 68 bundle).

## 3. Verification

| Check | Result |
|-------|--------|
| Selected slugs | **25** |
| Research SHA validation | **25/25** |
| Editorial owner approval | **PENDING** |
| Live baseline | **319/406** (prod JSON unchanged on branch) |
| `git diff origin/main -- data/ ports/` | empty |
| Leak regression | PASS |

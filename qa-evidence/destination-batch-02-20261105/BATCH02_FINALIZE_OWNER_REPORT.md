# Batch 02 — Final owner approvals (local reconciliation)

**Worktree:** `pilot/ports-directory-thumbnails-20261104`  
**Finalized:** 2026-11-05 (local only — no commit/deploy/KV)

## Owner decisions applied

| Round | Count | Source |
|-------|------:|--------|
| V1 original | 12 | `data/destination-photo-batch-02-owner-review-v1-resolved-decisions.json` |
| Reject13 | 10 | `data/destination-photo-batch-02-owner-review-reject13-decisions.json` |
| Reject3 | 3 | `data/destination-photo-batch-02-owner-review-reject3-decisions.json` |
| **Total** | **25** | `data/destination-photo-batch-02-final-approvals.json` |

### Round 3 (frozen)

- `sicily-palermo-italy` — APPROVE_A — `pexels:36835853`
- `amber-cove-puerto-plata-dominican-republic` — APPROVE_B — `pexels:38810525`
- `ajaccio-corsica-france` — APPROVE_A — `pexels:19466911`

Provider URLs, photographer, and licence fields preserved on each `humanApproved` entry via pair manifests.

## Report answers (A–H)

### A. Approval records reconciled

**15** `humanApproved` rows written or updated on first finalize run (`reconciled=15`). **10** reject13 ports already matched and were left intact. All **25** slugs now present in `humanApproved` and owner candidates.

### B. Exact selected image count

**25** (manifest `total: 25`, test asserts 25 webps + index paths).

### C. Geo / licence verified vs blocked

| Flag | Count | Notes |
|------|------:|-------|
| `productionLicenseVerified: true` | 25 | Owner-approved stock licences from pair metadata |
| `productionGeoVerified: true` | **15** | Stronger or unflagged slugs |
| `productionGeoVerified: false` | **10** | `scripts/lib/destinationPhotoBatch02GeoPolicy.js` |

**Geo-blocked slugs:** George Town, Curaçao, Antigua, Bonaire, Costa Maya, Aruba, Barbados, Belize City, Colón, Ajaccio.

### D. Remaining missing source records

**None** for the 25 selections: each `providerImageId` resolves in v1 / reject13 / reject3 pair JSON; on-disk webp exists; `destination-photo-batch-02-final-approvals.js` index inclusion passes.

### E. Directory image consistency

- `node scripts/build-destination-image-catalog.js` + `node scripts/regenerate-ports-index.js` (scoped index only).
- All 25 approved `localAssetPath` values appear in `ports/index.html` tiles.
- Rejected alternates tracked in `rejectedUrlSubstrings` / `rejectedOwnerReplacementPhotos`.
- Country JSON (`portsDirectoryCountryImages`) uses reject3 France / DR images where applicable.
- Playwright: `/ports/` at **390×844** and **1280×800** — screenshots in this folder (`batch02-final-ports-directory-*.png`).
- DOM check: Bari tile `batch02-r2-pexels-35178862.webp` matches final manifest.
- No owner-review / debug labels on public `ports/index.html`.
- Individual port guide heroes may still use legacy blog materialized images (out of scope — no full port-guide regen).

### F. Targeted test results

| Test | Result |
|------|--------|
| `test-destination-photo-batch-02-final-approvals.js` | OK (25, landscape webps, index) |
| `test-destination-photo-batch-02-apply-reject13-decisions.js` | OK (after reject3-aware REJECT_BOTH exception) |
| `test-destination-image-source-policy.js` | OK |
| `test-ports-directory.js` | OK |
| `test-ports-region-country-navigation.js` | OK |
| `test-destination-image-catalog.js` | OK |
| Browser QA `run-batch02-finalize-browser-qa.cjs` | OK |

### G. Files changed (this finalize step)

**Data / state**

- `data/destination-photo-batch-02-owner-review-reject3-decisions.json` (+ `appliedAt`)
- `data/destination-photo-batch-02-owner-review-v1-resolved-decisions.json` (+ `appliedAt`)
- `data/destination-photo-batch-02-final-approvals.json` (new)
- `data/ports-directory-image-review-state.json` (`humanApproved`, reject history)
- `data/ports-directory-destination-owner-candidates.json`
- `data/destination-image-catalog.json` (regenerated)

**Generated**

- `ports/index.html` (regenerated)

**Scripts / tests (this session)**

- `scripts/finalize-destination-photo-batch-02-owner-reviews.js`
- `scripts/lib/destinationPhotoBatch02GeoPolicy.js`
- `scripts/test-destination-photo-batch-02-final-approvals.js`
- `scripts/test-destination-photo-batch-02-apply-reject13-decisions.js` (reject3 exception)
- `qa-evidence/destination-batch-02-20261105/run-batch02-finalize-browser-qa.cjs`

### H. READY FOR OWNER RELEASE REVIEW

**YES** — for **Ports directory** presentation of all 25 owner-selected tiles, with these **release gates**:

1. **V1 A/B resolution:** Original owner paste did not list per-slug A vs B. Resolved file documents inferred B for St Thomas, Kotor, San Juan, Chania; confirm or correct before treating v1 as legally frozen.
2. **Geo:** Ten ports remain `productionGeoVerified: false` — do not promote to “geo-verified production” until landmark/provider evidence is documented.
3. **Port guides:** Directory thumbnails are aligned; per-port guide heroes were not bulk-regenerated.

## Commands to re-verify

```bash
cd .worktrees/ports-directory-thumbnails-20261104
node scripts/finalize-destination-photo-batch-02-owner-reviews.js
node qa-evidence/destination-batch-02-20261105/run-batch02-finalize-browser-qa.cjs
```

Preview: http://127.0.0.1:8788/ports/

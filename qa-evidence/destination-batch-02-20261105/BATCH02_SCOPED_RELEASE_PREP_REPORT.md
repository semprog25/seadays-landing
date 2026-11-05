# Batch 02 — Scoped Ports directory release prep

**Worktree:** `pilot/ports-directory-thumbnails-20261104`  
**Prepared:** 2026-11-05 (no commit/PR/deploy)

## Policy change (simplified)

Approval records now separate:

| Field | Meaning |
|--------|---------|
| `ownerVisuallyApproved` | Owner selected this ID — sufficient for directory use when no contradiction |
| `productionLicenseVerified` | Pexels/Unsplash licence metadata preserved on record |
| `productionGeoVerified` | **Not** auto-set to `true` (no manufactured geo proof) |
| `providerGeoContradiction` | Only when provider location **conflicts** with assigned port |
| `excludedFromPublicDirectoryRender` | Public directory tile withheld (2 ports only) |

Missing GPS / absent Pexels location fields **do not** block owner-approved tiles.

Implementation: `scripts/lib/destinationPhotoBatch02GeoPolicy.js`, `finalize-destination-photo-batch-02-owner-reviews.js`, `portsDirectoryImageResolve.js`.

## Owner ID reconciliation

Explicit manifest: `data/destination-photo-batch-02-owner-explicit-selections.json`

**V1 corrections applied (were wrong slot):**

- St Thomas → pexels:**34650321** (was 34650323)
- San Juan → pexels:**15306227** (was 15305906)
- Chania → pexels:**38313115** (was 13900806)

Four B IDs and other eight A IDs match owner supply. Round 2 (10) + Round 3 (3) unchanged.

## Contradictions (public exclusion only)

| Port | Owner ID kept | Public directory tile |
|------|---------------|------------------------|
| Curaçao | pexels:1450360 | **Excluded** — Pexels location Maldives |
| Costa Maya | pexels:1450352 | **Excluded** — Pexels location Maldives |

Records retain full metadata + `providerGeoContradiction` object. Other **23** destinations render normally.

## Release manifest

`data/destination-photo-batch-02-scoped-release-manifest.json` — minimal PR path list and exclusions.

Port guides **not** in scope (heroes unchanged).

---

## Report A–H

### A. Exact owner ID matching: **PASS**

`test-destination-photo-batch-02-scoped-release.js` + explicit selections manifest.

### B. Owner-approved photo count: **25**

### C. Eligible public photo count: **23**

(`verifiedPortPhotos=49` on full index includes non–Batch 02 ports.)

### D. Explicit contradictions remaining: **2**

Curaçao, Costa Maya — documented, excluded from index tiles.

### E. Minimal release file list

See `data/destination-photo-batch-02-scoped-release-manifest.json` and prior `BATCH02_RELEASE_READINESS_REPORT.md` §Phase 4.

Core: Batch 02 data JSON, review state, catalog, batch02 webp assets, `ports/index.html`, directory resolve/index/catalog scripts, targeted tests.

### F. Targeted tests

| Test | Result |
|------|--------|
| `test-destination-photo-batch-02-final-approvals.js` | OK |
| `test-destination-photo-batch-02-scoped-release.js` | OK |
| `test-destination-photo-batch-02-apply-reject13-decisions.js` | OK |
| `test-destination-image-source-policy.js` | OK |
| `test-destination-image-catalog.js` | OK |
| `test-ports-directory.js` | OK |
| `test-ports-region-country-navigation.js` | OK |
| Browser 390 / 1280 `/ports/` | OK |

### G. Diff / release isolation

Worktree still contains **unrelated WIP** (ships, site shell, owner import, wikimedia QA, pilot port guides). Use manifest `includeGlobs` / `excludeFromPr` when opening PR — **do not** ship whole worktree diff.

Batch-only reconcile this pass: **6** approval rows updated + index regen (Curaçao/Costa tiles removed).

### H. READY FOR OWNER PR APPROVAL: **YES**

For a **scoped Ports directory Batch 02 photography PR**, after owner confirms:

1. PR file list matches scoped manifest (not entire worktree).
2. Disclosure of **2 withheld** tiles (Maldives provider location vs assigned ports).
3. Port-guide alignment remains a **follow-up**, not this PR.

---

## Commands

```bash
cd .worktrees/ports-directory-thumbnails-20261104
node scripts/finalize-destination-photo-batch-02-owner-reviews.js
node scripts/test-destination-photo-batch-02-scoped-release.js
```

Preview: http://127.0.0.1:8788/ports/

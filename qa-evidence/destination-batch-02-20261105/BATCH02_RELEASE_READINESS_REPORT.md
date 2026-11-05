# Batch 02 — Release-readiness verification

**Repo:** seadays-landing  
**Worktree:** `pilot/ports-directory-thumbnails-20261104`  
**Date:** 2026-11-05 (local verification only — no commit/deploy)

---

## Phase 1 — Four owner APPROVE_B IDs

Authoritative counts: `data/destination-photo-batch-02-owner-review-v1-decisions.json` (`ownerReportedCounts.APPROVE_B: 4`).  
Explicit owner B IDs (this task):

| Port | Expected ID | Initial manifest | After correction |
|------|-------------|------------------|------------------|
| kotor-montenegro | pexels:33498731 | PASS | PASS |
| rhodes-greece | pexels:10929911 | **FAIL** (was 13149284 A) | **PASS** |
| bonaire-bonaire | pexels:1134178 | **FAIL** (was 3601429 A) | **PASS** |
| costa-maya-mexico | pexels:1450352 | **FAIL** (was 457881 A) | **PASS** |

**Correction:** `data/destination-photo-batch-02-owner-review-v1-resolved-decisions.json` updated to owner B IDs; `node scripts/finalize-destination-photo-batch-02-owner-reviews.js` reconciled **3** rows (+ **2** geo flag updates on re-run).  
**Automated gate:** `test-destination-photo-batch-02-final-approvals.js` now asserts all four B IDs.

### A. Four owner B-selection IDs: **PASS** (after correction)

---

## Phase 2 — Geographic verification (original ten)

Evidence log: `data/destination-photo-batch-02-geo-verification-evidence.json`  
Policy: `scripts/lib/destinationPhotoBatch02GeoPolicy.js`

| Destination | Selected ID | Verdict | Evidence (provider page) |
|-------------|-------------|---------|---------------------------|
| Ajaccio | pexels:19466911 | **Verified** | [Pexels](https://www.pexels.com/photo/boats-in-harbor-buildings-in-background-19466911/) — structured location **Ajaccio, France** |
| Colón | pexels:11678092 | **Verified** | [Pexels](https://www.pexels.com/photo/a-view-of-a-beautiful-paradise-11678092/) — structured location **Colón, Colón Province, Panama** |
| Aruba | unsplash:rU0tiN5JMhA | **Blocked** | Unsplash page not confirmed this pass; no verified map/location on provider record |
| Barbados | pexels:5287934 | **Blocked** | Generic tropical aerial; no structured location / no Bridgetown landmark |
| Belize City | pexels:4716934 | **Blocked** | “Belize” only in description prose; generic boats-on-water |
| George Town | unsplash:k-9GLWbZ2Xw | **Blocked** | Unsplash not confirmed; generic harbor water |
| Curaçao | pexels:1450360 | **Blocked** | [Pexels](https://www.pexels.com/photo/photo-of-beach-during-golden-hour-1450360/) — structured location **Maldives** (conflicts with port) |
| Antigua | pexels:1450350 | **Blocked** | Generic Maldives-associated stock; no Antigua location |
| Bonaire | pexels:1134178 | **Blocked** | [Pexels](https://www.pexels.com/photo/photo-of-seashore-1134178/) — resort pool/villas, not identifiable Bonaire |
| Costa Maya | pexels:1450352 | **Blocked** | [Pexels](https://www.pexels.com/photo/photo-of-ocean-1450352/) — structured location **Maldives** (conflicts with port) |

### B. Geographic verification for all ten: see table above

### C. Newly verified: **2** (Ajaccio, Colón)

### D. Still blocked: **8**

Current totals across all **25** selections: **17** `productionGeoVerified: true`, **8** false (tests confirm).

---

## Phase 3 — Port-guide hero consistency (25 Batch 02 ports)

**Method:** Compare `destination-photo-batch-02-final-approvals.json` + `ports-directory-destination-owner-candidates.json` to each `ports/<slug>/index.html` for an in-page destination hero (`.seo-hero-img` / cinematic hero).

| Finding | Count |
|---------|------:|
| Owner candidate `heroImageUrl` matches directory approval | **25 / 25** |
| Port guide HTML contains in-page destination hero image | **0 / 25** |
| In-page hero aligned with Batch 02 directory ID | **0** |

**Interpretation:** Batch 02 work targets **Ports directory tiles** and owner candidate records. Static port guides are predominantly **text-first** (no destination hero figure); unrelated blog/Portside thumbnails appear only under “More reading” cards — not Batch 02 directory assignments.

Detail: `qa-evidence/destination-batch-02-20261105/batch02-port-guide-hero-mismatch.json`

### E. Port-guide hero mismatch findings

- **No bulk hero drift:** owner JSON matches all 25 directory IDs.
- **Guide gap:** all 25 guides lack an embedded destination hero tied to Batch 02; aligning guides would be a **separate, scoped** port-guide pass (out of scope for this release boundary).

---

## Phase 4 — Release boundary (git)

Worktree is **ahead 1** on `pilot/ports-directory-thumbnails-20261104` with **broad WIP** (ships index, site shell, owner image import, wikimedia QA, pilot port guides, etc.).

### Smallest reviewable **Batch 02 directory photography** scope

**Data & policy**

- `data/destination-photo-batch-02-*.json` (pairs, decisions, final approvals, geo evidence)
- `data/ports-directory-image-review-state.json` (humanApproved + reject history)
- `data/ports-directory-destination-owner-candidates.json` (**Batch 02 port entries only** if splitting)
- `data/destination-image-catalog.json`
- `data/ports-directory-country-images.json` (if country tiles reference Batch 02 ports)

**Assets**

- `assets/img/ports-directory/ports/<25-batch02-slugs>/` (batch02 / batch02-r2 / batch02-r3 / batch02-alt webps)
- Related `assets/img/ports-directory/countries/` rows sourced from Batch 02 ports only

**Scripts & tests**

- `scripts/finalize-destination-photo-batch-02-owner-reviews.js`
- `scripts/build-destination-image-catalog.js`
- `scripts/regenerate-ports-index.js` (scoped index regen — not all port guides)
- `scripts/lib/destinationPhotoBatch02GeoPolicy.js`
- `scripts/lib/destinationDirectoryCard.js`, `destinationImageCatalog.js`, `destinationImageSourcePolicy.js`, `portsDirectoryImageResolve.js`, `portsDirectoryIndex*.js` (**only if required for tile rendering** — review diff)
- `scripts/test-destination-photo-batch-02-*.js`, `test-destination-image-catalog.js`, `test-destination-image-source-policy.js`, `test-ports-directory.js`, `test-ports-region-country-navigation.js`

**Generated public surface**

- `ports/index.html`

**Exclude from Batch 02 photography PR**

- Unrelated port guide HTML (`ports/barcelona-spain`, `hamburg`, `miami`, `kristiansund`, …)
- `ships/index.html`, `assets/css/site-shell.css`, owner-image import pipelines
- `qa-evidence/*` except optional reviewer reports
- Wikimedia harvest / overnight coverage WIP

### F. Smallest safe release file scope: see lists above

---

## Phase 5 — Targeted QA

| Check | Result |
|-------|--------|
| `test-destination-photo-batch-02-final-approvals.js` | OK (25, 4×B IDs, geo 17/8) |
| `test-destination-photo-batch-02-apply-reject13-decisions.js` | OK |
| `test-destination-image-source-policy.js` | OK |
| `test-destination-image-catalog.js` | OK |
| `test-ports-directory.js` | OK |
| `test-ports-region-country-navigation.js` | OK |
| Browser `/ports/` 390px + 1280px | OK (`batch02-final-ports-directory-*.png`) |

### G. Tests and browser results: all targeted checks **OK**

---

## Phase 6 — Summary

### H. Remaining blockers

1. **Eight geo-blocked** directory tiles (see Phase 2) — owner-visual OK, production geo not proven (two IDs tagged **Maldives** on Pexels).
2. **Port guides** — no in-page heroes for Batch 02; not a directory regression but blocks “directory + guide” unified release.
3. **Worktree hygiene** — must split Batch 02 directory scope from unrelated WIP before PR.
4. **V1 eight APPROVE_A slugs** — still resolved to candidate A where export lacked per-slug lines (only the four B IDs were explicitly confirmed this task).

### I. READY FOR SCOPED RELEASE REVIEW

**YES** — for a **Ports directory–only** release (25 owner-selected tiles + catalog/index + policy/tests), provided:

- Release notes call out **8 geo-pending** ports and Maldives-tagged stock on Curaçao/Costa Maya.
- PR is **split** from unrelated worktree changes.
- Port-guide hero alignment is **explicitly out of scope** for this slice.

**NO** — for a combined “full ports experience” release until geo-blocked ports are accepted or replaced (future owner pass) and/or port guides are updated deliberately.

---

## Files touched in this verification pass

- `data/destination-photo-batch-02-owner-review-v1-resolved-decisions.json`
- `data/destination-photo-batch-02-geo-verification-evidence.json` (new)
- `scripts/lib/destinationPhotoBatch02GeoPolicy.js`
- `scripts/test-destination-photo-batch-02-final-approvals.js`
- `scripts/report-batch02-port-guide-hero-mismatch.js` (new)
- Regenerated: `data/destination-photo-batch-02-final-approvals.json`, review state, catalog, `ports/index.html`

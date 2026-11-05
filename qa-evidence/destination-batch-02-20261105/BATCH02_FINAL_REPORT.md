# Batch 02 + Round 2 finalize — local report (2026-11-05)

**Worktree:** `ports-directory-thumbnails-20261104` · **Preview:** http://127.0.0.1:8788/  
**No merge · no deploy · no Supabase/Edge/KV**

---

## A. Round 2 owner approvals (persisted)

| Target | Provider | ID | `humanApproved` / country browse |
|--------|----------|-----|----------------------------------|
| Istanbul | Pexels | **38131419** | `humanApproved.istanbul-turkey` → `batch01r2` WebP |
| Southampton | Unsplash | **da2971caee3b** | `humanApproved.southampton-united-kingdom` |
| Mykonos | Pexels | **6143740** | `humanApproved.mykonos-greece` (re-bound after revoke) |
| Greece browse | Pexels | **13900563** | `humanApprovedCountryBrowse.greece` + `ports-directory-country-images.json` |

Script: `scripts/finalize-destination-photo-batch-01-round2-owner-approval.js`  
All four: `productionLicenseVerified: true`, Pexels/Unsplash licence URLs on record, prior rejects remain in `rejectedUrlSubstrings`.

---

## B. Approved coverage (local)

| Layer | Count | Notes |
|-------|------:|-------|
| **Owner-approved port tiles** | **22** | `humanApproved` in `ports-directory-image-review-state.json` (incl. Hamburg + batch01 + round2) |
| **Owner-approved country browse** | **1** | Greece (`humanApprovedCountryBrowse.greece`) |
| **Region browse images** | unchanged | Owner/Pexels region assets separate; not part of batch02 |
| **Catalog `port-destination` VERIFIED** | 44 | Includes owner-approved + quality-pass paths |
| **Catalog `port-destination` NEEDS_REVIEW** | 51 | Includes all **25** batch02 candidates |
| **Directory photo tiles on `/ports/`** | 51 | Regenerated index (was 26 pre-batch02) |

---

## C. Batch 02 — 25 slugs

1. `george-town-cayman-islands`  
2. `st-thomas-charlotte-amalie-us-virgin-islands`  
3. `florence-pisa-livorno-italy`  
4. `kotor-montenegro`  
5. `corfu-greece`  
6. `rhodes-greece`  
7. `split-croatia`  
8. `heraklion-crete-greece`  
9. `sicily-palermo-italy`  
10. `cartagena-colombia`  
11. `san-juan-puerto-rico`  
12. `aruba-oranjestad-aruba`  
13. `curacao-willemstad-curacao`  
14. `barbados-bridgetown-barbados`  
15. `antigua-st-john-s-antigua`  
16. `amber-cove-puerto-plata-dominican-republic`  
17. `bonaire-bonaire`  
18. `bodrum-turkey`  
19. `bari-italy`  
20. `ajaccio-corsica-france`  
21. `chania-crete-greece`  
22. `bar-montenegro`  
23. `belize-city-belize`  
24. `colon-panama`  
25. `costa-maya-mexico`  

*(Valletta and other batch01 approvals excluded.)*

---

## D–F. Sources, landscape validation, geo notes

Full per-row metadata: `data/destination-photo-batch-02-candidates.json`.

- **Landscape:** enforced at download via `sips` (width > height); batch test re-checks all 25 WebPs.
- **Geo verification:** Pexels/Unsplash location tags cited in `geographicEvidence`; **owner must confirm** weak/generic Caribbean beach picks (Aruba, Curaçao, Antigua, Barbados, Amber Cove) where listing is region-style not landmark-specific.
- **Florence/Livorno:** seed uses Florence skyline (`2693318`) as Livorno gateway representative — verify on contact sheet.
- **Sicily/Palermo:** seed `462077` is broader Sicilian landscape — verify landmark fit.

---

## G. Contact sheets

| Gallery | Path |
|---------|------|
| Batch 02 | http://127.0.0.1:8788/qa-evidence/destination-batch-02-20261105/index.html |
| Round 2 (historical) | http://127.0.0.1:8788/qa-evidence/destination-batch-01-20261105/round2-four.html |

---

## H. QA screenshots

Under `qa-evidence/destination-batch-02-20261105/`:

- `batch02-preview-kotor-1280.png`
- `batch02-preview-san-juan-1280.png`
- `batch02-preview-george-town-1280.png`
- `batch02-directory-1280.png` / `batch02-directory-390.png`
- `round2-approved-istanbul-1280.png`

---

## I. Tests run (pass)

- `test-destination-photo-batch-01-round2-four.js`
- `test-destination-photo-batch-01-round2-owner-approved.js`
- `test-destination-photo-batch-01-owner-review.js`
- `test-destination-photo-batch-02.js`
- `test-destination-image-source-policy.js`
- `test-ports-directory.js`

---

## J. Key files changed/added

**Round 2 finalize:**  
`scripts/finalize-destination-photo-batch-01-round2-owner-approval.js`,  
`scripts/test-destination-photo-batch-01-round2-owner-approved.js`,  
`data/ports-directory-image-review-state.json`,  
`data/ports-directory-country-images.json`,  
`data/destination-photo-batch-01-round2-four.json`, owner/batch/replacements JSON, `ports/index.html`, catalog.

**Batch 02:**  
`scripts/lib/destinationPhotoBatch02.js`,  
`scripts/collect|download|run|test-destination-photo-batch-02.js`,  
`scripts/generate-destination-batch-02-contact-sheet.js`,  
`data/destination-photo-batch-02-candidates.json`,  
25× WebP under `assets/img/ports-directory/ports/*/destination-exterior-batch02-*`,  
`qa-evidence/destination-batch-02-20261105/*`.

---

## K. Remaining blockers

1. **Batch 02:** all 25 remain **NEEDS_REVIEW** — no production licence verification until owner sign-off per slug.  
2. **Geo weak candidates:** several Caribbean seeds are scenic/coastal but not landmark-specific (see §D–F).  
3. **Batch 01 replacements still pending:** Stockholm, Copenhagen, Oslo, Seattle — unchanged.  
4. **Region/country browse:** most countries still inherit first passing port or overrides; only **Greece** has owner-approved dedicated browse image.  
5. **No port-guide bulk regen** — heroes on unopened guides may still differ from directory tiles.

---

## L. READY FOR OWNER REVIEW

**YES** — Round 2 approvals are recorded and stable after regen; Batch 02 contact sheet + preview 8788 are ready for visual pass on all 25 new tiles.

**Re-run locally:**

```bash
node scripts/finalize-destination-photo-batch-01-round2-owner-approval.js   # if needed
node scripts/run-destination-photo-batch-02.js
node qa-evidence/destination-batch-02-20261105/run-batch02-preview-screenshots.cjs
```

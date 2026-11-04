# Ports Directory v2 — visual previews

Captured from local `python3 -m http.server` against branch `feat/ports-directory-ux-v2` (not deployed).

| File | Viewport |
|------|----------|
| `desktop-1280-v2.png` | Desktop (~1280×800), post QA pass |
| `mobile-390-v2.png` | Mobile 390×844, post QA pass |
| `desktop-1280.png` / `mobile-390.png` | Initial PR56 capture (pre region-fallback images) |

**Image coverage (regenerated index):** 337 `<img class="directory-card-image">`, 70 gradient placeholders, all 12 featured ports use real blog/region assets.

**Before (v1 on `origin/main`):** large two-column hero with side artwork, all port cards visible in DOM on load, cyan focus on region filters, “Sort: Popular” option.

**After (this branch):** compact hero, search-first, 12 featured ports + Browse all, region image cards, red focus accents, turquoise bookable pill only, `<noscript>` full port link list.

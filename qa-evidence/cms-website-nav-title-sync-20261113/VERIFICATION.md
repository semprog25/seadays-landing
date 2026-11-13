# CMS website nav / related-card title sync — 2026-11-13

**Repo:** `seadays-landing` @ branch `fix/cms-website-content-discrepancies-20261113`  
**Baseline:** `origin/main` @ `62f25701b4e0504b634b86edf2e63a1bda0e57db` (PE 363/406)

## Reproduced issue

Committed blog article pages used approved display titles in `<h1>`, `<title>`, and more-card `<h3>` (via `data/blog-article-corrections.json` / `meta.json`), but **prev/next `article-nav`** and some **more-card `img alt`** still showed raw CMS titles (e.g. `cvs Celebrity Edge…`, legacy “12 Cruise Ship Secrets…”, pre-correction family/adults-only headlines).

**Scan before fix:** 17 `article-nav` label mismatches vs corrections map; 4 pages with `cvs Celebrity` alt/nav leak.

## Fix (no CMS / Supabase write)

1. `scripts/generateBlogs.js` — nav labels and more-card image alt use `resolveRelatedReadingCardTitle`.
2. `scripts/repair-blog-article-nav-cms-titles.js` — one-time patch of **59** committed `blog/**/index.html` files.
3. `scripts/test-blog-article-nav-cms-titles.js` — regression guard.

## Targeted verification

| Check | Result |
|-------|--------|
| `node scripts/test-blog-article-nav-cms-titles.js` | PASS |
| `node scripts/test-blog-production-hygiene.js` | PASS |
| `node scripts/test-related-reading-excerpts.js` | PASS |
| Post-repair nav scan vs `titleBySourceSlug` | **0** mismatches |
| `cvs Celebrity` on blog HTML | **0** matches |

### Sample pages (canonical / robots preserved)

- `/blog/rome-civitavecchia-cruise-port-how-to-explore-the-eternal-city/` — next nav: **Norwegian Prima vs Celebrity Edge…**
- `/blog/disney-cruise-line-vs-royal-caribbean-best-for-families/` — more-card alt/title aligned
- `/blog/the-real-cost-of-cruise-drink-packages-is-it-worth-it/` — prev nav: **Passenger tips that show up every cruise week**

## Not in scope / blocked

- Bulk CMS POST sync of 61–67 override bodies (manifest drift; separate ops).
- Slug/canonical changes (trip-cost `$300–800`, 30-day “I tried…”) — owner decisions per `docs/adsense-content-recovery-progress.md`.
- Batch05 ports (PR #138 draft) — research-blocked per baseline.
- Port/ship catalogue regen.

## Release recommendation

**Draft-merge OK** after CI — low-risk display copy on blog chrome only; no indexing/sitemap/ads/Viator changes. Deploy with normal Pages pipeline; **no** edge function or CMS writes.

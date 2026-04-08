# Static Blog Generation for SEO

This document describes the static blog generation system that pre-renders blog articles from Supabase into HTML files for SEO-friendly indexing on GitHub Pages.

## Overview

- **Source**: Supabase Edge Function (`portside-articles`)
- **Output**: Static HTML in `/blog/{slug}/index.html` (canonical URL `https://seadays.app/blog/{slug}/` with trailing slash). Redirect pages at `/blog/{slug}.html` for backward compatibility.
- **Sitemap**: Auto-updated `sitemap.xml` with the same article URLs (trailing slash). Home is only `https://seadays.app/` (not a separate `landing-page.html` entry).
- **Legacy**: `scripts/generate-blog-pages.js` is not the production pipeline; use `npm run generate-blogs` so canonicals stay aligned.

## Prerequisites

- Node.js 18+
- `SUPABASE_ANON_KEY` in `.env` or environment (required for fetching articles)
- `SUPABASE_SERVICE_ROLE_KEY` in `.env` or environment (optional; required to upload base64 images to Supabase Storage; without it, base64 images are removed to reduce page size)

## Running Locally

```bash
# From seadays-landing-repo root
npm run generate-blogs
```

If you use the **SeaDays app monorepo** (app + `seadays-landing/` subfolder), you can run from the **app repo root**:

```bash
npm run generate-blogs
```

Or directly:

```bash
node scripts/generateBlogs.js
```

## What It Does

1. **Fetches** all published articles from Supabase (`forWebsite=1`, excludes drafts)
2. **Fetches full content** for each article (including `structuredContent` / `content`)
3. **Generates slug** from title if missing (e.g. "10 Cruise Packing Mistakes" → `10-cruise-packing-mistakes`)
4. **Converts** `structuredContent` (contentVersion 2) to HTML (headings, paragraphs, images, tables, tips, etc.)
5. **Writes** one folder per article: `blog/{slug}/index.html` (full content). Also writes `blog/{slug}.html` as a redirect to `/blog/{slug}/` for old URLs.
6. **Writes** `blog/index.html` with article cards and links
7. **Updates** `sitemap.xml` with homepage, blog index, ships/ports hubs, and all article URLs (canonical trailing-slash URLs only)

## Output Structure

```
/blog/
  index.html                    # Blog index with all articles
  cruise-packing-mistakes/
    index.html                  # Full article (canonical: /blog/cruise-packing-mistakes/)
  cruise-packing-mistakes.html  # Redirect stub (old URL → /blog/cruise-packing-mistakes/)
  cruise-wifi-guide/
    index.html
  cruise-wifi-guide.html       # Redirect
  ...
sitemap.xml                     # Updated with clean URLs (/blog/{slug})
```

## SEO Features

Each generated article page includes:

- `<title>` from `seoTitle` or `title`
- `<meta name="description">` from `seoDescription` or `excerpt`
- `<meta name="robots" content="index, follow">`
- `<link rel="canonical">` with full article URL
- Open Graph tags (`og:title`, `og:description`, `og:image`, `og:url`)
- Twitter card meta tags
- JSON-LD Article structured data (Schema.org)
- Full article content in HTML (no JavaScript required)
- `loading="lazy"` on all images

## Base64 Image Handling

Article images may be stored as base64 in Supabase. The generator:

- **Deduplication**: Identical base64 images (by hash) upload once per run
- **Skip re-upload**: Checks if file exists in storage before uploading
- **With `SUPABASE_SERVICE_ROLE_KEY`**: Uploads to `SeadaysPublic/blog-images/{articleId}/{hash}.{ext}`
- **Without service key**: Removes base64 images to keep page size small (~16–23 KB vs 4–7 MB per page)
- **Fallback**: Upload failure → remove image (never breaks build)

All images get `loading="lazy"` and `decoding="async"`. No base64 remains in final HTML.

## Image pipeline and fixes (March 2026)

This section records how **broken or wrong blog card / hero images** on `seadays.app` were fixed and how to avoid regressions. There is no separate database table for this — behavior lives in **`scripts/generateBlogs.js`** and the Portside edge function.

### Symptoms

- Thumbnails on `/blog/` or the home page showed the **wrong** image, a **generic** image, or **inconsistent** images vs the app.
- **GitHub Actions** failed at **post-build validation** with `HTTP 400` when checking image URLs.

### Root causes

1. **CDN → Storage path without bucket segment**  
   The API sometimes returns `https://cdn.seadays.app/portside/{file}.jpg` (folder `portside` under the CDN host) instead of `cdn.seadays.app/SeadaysPublic/portside/...`.  
   Naïvely mapping to `https://auth.seadays.app/storage/v1/object/public/portside/...` makes **`portside` the Supabase bucket name**, which is invalid. Objects live under bucket **`SeadaysPublic`**, path `portside/...`.

2. **Gradient SVG “placeholder” thumbnails**  
   When an article had no real `thumbnailUrl` / `heroImageUrl`, the edge resolver could expose a **small SVG gradient** data URL as the summary thumbnail. The generator treated it as a real image; after SVG validation it fell back to the **first body image**, which is not always the intended cover.

3. **POST `/portside-articles/thumbnails` not used for “SVG-only” summaries**  
   Articles whose only summary thumbnail was that SVG needed to be included in the thumbnail merge batch so the real raster URL from KV could be applied.

4. **CI HTTP checks**  
   **HEAD** (and some **ranged GET**) requests to `auth.seadays.app` returned **400** even for valid public objects; **plain GET** succeeds.

### Fixes implemented (in `generateBlogs.js`)

| Area | What we did |
|------|----------------|
| **CDN / Storage URLs** | `ensureSeadaysPublicBucketInObjectPath`: if the path starts with `portside/` or `blog-images/` and not already `SeadaysPublic/`, prepend **`SeadaysPublic/`**. Applied in `cdnToDirectStorageUrl` and `normalizeAuthStoragePublicUrl`. |
| **Resolution** | `resolveImageUrl` ends with `normalizeAuthStoragePublicUrl(cdnToDirectStorageUrl(...))` so emitted HTML uses correct public URLs. |
| **Gradient SVG** | `isGradientSvgDataUrl` + skip in `pickCardImage`; merge thumbnails for articles whose only “image” was a gradient SVG; optional backfill from full article fetch. |
| **Validation** | `httpCheck`: HEAD once, then **GET** (no `Range` by default). Normalize URLs before checking. |
| **App repo** | Root `package.json` script `generate-blogs` → `npm run generate-blogs --prefix seadays-landing` so you can run from the monorepo root. |

### Operational notes

- **Run**: `npm run generate-blogs` from the **app** repo root, or `cd seadays-landing && npm run generate-blogs`.
- **Secrets**: `SUPABASE_ANON_KEY` required; `SUPABASE_SERVICE_ROLE_KEY` optional (base64 → Storage upload).
- **Landing repo**: Deploy only from **`seadays-landing`** (separate GitHub); do not push app code to the landing remote (see `.cursorrules`).

## Contextual Internal Links

The generator injects 2–4 related-article links inside content (after the 2nd paragraph) based on keyword overlap (title, excerpt, tags). Uses clean URLs: `<a href="/blog/{slug}">`.

## Deployment

### Manual

1. Run `npm run generate-blogs`
2. Commit `blog/` and `sitemap.xml`
3. Push to trigger GitHub Pages deploy

### GitHub Action

A workflow (`.github/workflows/generate-blogs.yml`) runs:

- On push to `main` when script or workflow changes
- On manual trigger (`workflow_dispatch`)
- Daily at 06:00 UTC

**Required secret**: `SUPABASE_ANON_KEY` in the repo settings.

The workflow commits updated `blog/` and `sitemap.xml` and pushes back to `main`.

## URL Structure

- **Canonical / sitemap**: `/blog/{slug}` (e.g. `/blog/cruise-packing-mistakes`) — clean URLs for SEO.
- **Physical files**: `blog/{slug}/index.html` (full content). Browsers resolve `/blog/{slug}` to `blog/{slug}/index.html`.
- **Backward compatibility**: `blog/{slug}.html` is a small redirect page (meta refresh + JS) that sends visitors from the old URL to `/blog/{slug}`.

**Legacy**: `blog-article.html?id=123` remains for dynamic fallback. All new links and sitemap use clean static URLs.

## Slug Generation

If an article has no `slug`:

- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Example: `"10 Cruise Packing Mistakes"` → `10-cruise-packing-mistakes`

Duplicate slugs get a numeric suffix (e.g. `article-1`, `article-2`).

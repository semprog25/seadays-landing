# Static Blog Generation for SEO

This document describes the static blog generation system that pre-renders blog articles from Supabase into HTML files for SEO-friendly indexing on GitHub Pages.

## Overview

- **Source**: Supabase Edge Function (`portside-articles`)
- **Output**: Static HTML files in `/blog/` (e.g. `/blog/cruise-packing-mistakes.html`)
- **Sitemap**: Auto-updated `sitemap.xml` with all article URLs

## Prerequisites

- Node.js 18+
- `SUPABASE_ANON_KEY` in `.env` or environment (required for fetching articles)
- `SUPABASE_SERVICE_ROLE_KEY` in `.env` or environment (optional; required to upload base64 images to Supabase Storage; without it, base64 images are removed to reduce page size)

## Running Locally

```bash
# From seadays-landing-repo root
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
5. **Writes** one HTML file per article: `blog/{slug}.html`
6. **Writes** `blog/index.html` with article cards and links
7. **Updates** `sitemap.xml` with homepage, blog index, and all article URLs

## Output Structure

```
/blog/
  index.html           # Blog index with all articles
  cruise-packing-mistakes.html
  cruise-wifi-guide.html
  ...
sitemap.xml            # Updated with all URLs
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

## Contextual Internal Links

The generator injects 2–4 related-article links inside content (after the 2nd paragraph) based on keyword overlap (title, excerpt, tags). Uses real `<a href="/blog/{slug}.html">` anchors.

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

## URL Migration

- **Old**: `/blog-article.html?id=123`
- **New**: `/blog/{slug}.html` (e.g. `/blog/cruise-packing-mistakes.html`)

`blog-article.html` remains for backwards compatibility (dynamic fallback). All new links and sitemap use static URLs.

## Slug Generation

If an article has no `slug`:

- Lowercase
- Replace spaces with hyphens
- Remove special characters
- Example: `"10 Cruise Packing Mistakes"` → `10-cruise-packing-mistakes`

Duplicate slugs get a numeric suffix (e.g. `article-1`, `article-2`).

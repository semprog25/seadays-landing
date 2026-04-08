# Google Search Console Setup for seadays.app

This guide covers how to fill in the information Google Search Console asks for and maximize search reach for your blogs.

## What Was Added

1. **robots.txt** – At `https://seadays.app/robots.txt`
   - Allows all crawlers
   - Points to your sitemap

2. **sitemap.xml** – At `https://seadays.app/sitemap.xml`
   - Static sitemap from `npm run generate-blogs`: home, blog index, ships/ports hubs, every article (`/blog/<slug>/`), and all ship/port guides
   - When the landing **Node server** runs, `/sitemap.xml` is still dynamic (legacy `blog-article.html?id=` entries may appear there); GitHub Pages uses the committed static `sitemap.xml`

## How to Submit in Google Search Console

### 1. Submit Your Sitemap

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Select the **seadays.app** property (domain property)
3. In the left sidebar, open **Indexing** → **Sitemaps**
4. In **Add a new sitemap**, enter: `sitemap.xml`
5. Click **SUBMIT**

Google will fetch `https://seadays.app/sitemap.xml` and start discovering your pages.

### 2. robots.txt

- **robots.txt** is not submitted in Search Console; it lives on your site.
- After deploying `robots.txt` to the root of seadays.app, Google will find it automatically.
- In **Settings** → **Crawling** → **robots.txt**, click **OPEN REPORT** to see how Google reads it.

### 3. Deploy the New Files

Push the new files to your landing repo and deploy:

```bash
cd seadays-landing-repo
git add robots.txt sitemap.xml server.js
git commit -m "Add robots.txt and sitemap for Google Search Console"
git push
```

Ensure `robots.txt` and `sitemap.xml` are served at the root of seadays.app (e.g. `https://seadays.app/robots.txt` and `https://seadays.app/sitemap.xml`).

## Getting More Out of Search Console

### Performance

- **Performance** → See queries, clicks, impressions, and average position.
- Use this to refine titles, meta descriptions, and content for high-impression, low-click queries.

### URL Inspection

- **URL Inspection** → Enter any blog URL (e.g. `https://seadays.app/blog-article.html?id=xxx`).
- Check indexing status and request indexing after changes.

### Indexing → Pages

- **Pages** → See indexed vs. excluded pages.
- Fix “Discovered – currently not indexed” by improving internal links and sitemap coverage.

### “Duplicate, Google chose different canonical than user”

Use this when Search Console groups URLs under that reason (often a small count):

1. Open **Indexing** → **Pages** → click **Duplicate, Google chose different canonical than user**.
2. Open the **Examples** list and copy each affected URL (often 1–3).
3. For each URL, open **URL Inspection**, run **Test live URL** (or view last crawl), and note:
   - **User-declared canonical** (from your `link rel="canonical"` or HTTP header)
   - **Google-selected canonical**
4. Compare them: trailing slash vs none, `www` vs apex, `http` vs `https`, or a different path (e.g. `blog/slug.html` vs `blog/slug/`).
5. After you change HTML or redirects on the site, use **Request indexing** for the affected URLs and recheck the **Pages** report after one to two weeks.

Canonical policy for static pages is defined in `scripts/generateBlogs.js` (`blogCanonicalUrl`: always `https://seadays.app/blog/<slug>/` with a trailing slash).

### Host and duplicate URLs (www / http / GitHub Pages)

- Prefer a **single crawlable host**: `https://seadays.app` (no `www` unless you standardize on it everywhere).
- Ensure **HTTP → HTTPS** and **www ↔ apex** redirects at DNS or CDN so crawlers never see two 200-OK copies of the same HTML with different URLs.
- If an old **`*.github.io`** site still mirrors marketing content, **301 redirect** it to `https://seadays.app` or remove public duplicate content so Google does not pick a different canonical than your tags.

### Core Web Vitals

- **Experience** → **Core Web Vitals** → Monitor LCP, FID, CLS.
- Improve these for better rankings and user experience.

### Links

- **Links** → Internal and external links.
- Strengthen internal links from the homepage and blog listing to individual articles.

## Sitemap Coverage

- **Static deploy (e.g. GitHub Pages):** Run `npm run generate-blogs` in the landing repo before deploy. That is the **authoritative** generator: it writes `sitemap.xml` with the home page, `/blog/`, `/ships/`, `/ports/`, every published article, and every ship/port guide URL. The standalone `scripts/generate-sitemap.js` helper does **not** include ships/ports; use it only for quick blog-only experiments.
- **Server deploy:** If the landing server runs (e.g. Node host), `/sitemap.xml` may be dynamic; GitHub Pages should rely on the committed static `sitemap.xml`.

## After ships or ports dataset changes

When `scripts/lib/appCruiseDataset.js` is refreshed or `npm run generate-blogs` removes stale slugs, use **URL Inspection** in Search Console on a sample of `/ships/<slug>/` and `/ports/<slug>/` URLs after GitHub Pages finishes deploying. Request indexing only when you need faster discovery; otherwise Google will recrawl from the updated sitemap.

## Checklist

- [ ] Deploy `robots.txt` and `sitemap.xml` to seadays.app
- [ ] Submit `sitemap.xml` in Search Console → Sitemaps
- [ ] Verify `https://seadays.app/robots.txt` loads
- [ ] Verify `https://seadays.app/sitemap.xml` loads
- [ ] Use URL Inspection on a few blog URLs to confirm indexing
- [ ] Optionally inspect a few `/ships/<slug>/` and `/ports/<slug>/` URLs after regenerating programmatic pages
- [ ] If you see **Duplicate, Google chose different canonical than user**, follow the section above and capture example URLs + Google-selected canonical
- [ ] Confirm **one** preferred host (`https://seadays.app`) with redirects for `www` / `http` if applicable
- [ ] Monitor Performance and Pages reports over time

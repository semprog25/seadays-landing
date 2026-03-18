# Google Search Console Setup for seadays.app

This guide covers how to fill in the information Google Search Console asks for and maximize search reach for your blogs.

## What Was Added

1. **robots.txt** – At `https://seadays.app/robots.txt`
   - Allows all crawlers
   - Points to your sitemap

2. **sitemap.xml** – At `https://seadays.app/sitemap.xml`
   - Static sitemap with core pages (home, blog, landing)
   - When the landing server runs, `/sitemap.xml` is dynamic and includes all blog articles from Supabase

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

### Core Web Vitals

- **Experience** → **Core Web Vitals** → Monitor LCP, FID, CLS.
- Improve these for better rankings and user experience.

### Links

- **Links** → Internal and external links.
- Strengthen internal links from the homepage and blog listing to individual articles.

## Sitemap Coverage

- **Static deploy (e.g. GitHub Pages):** Run `node scripts/generate-sitemap.js` before deploy to regenerate `sitemap.xml` with all blog articles. Requires `SUPABASE_ANON_KEY` in `.env`.
- **Server deploy:** If the landing server runs (e.g. Node host), `/sitemap.xml` is dynamic and includes all blog articles from Supabase.

## Checklist

- [ ] Deploy `robots.txt` and `sitemap.xml` to seadays.app
- [ ] Submit `sitemap.xml` in Search Console → Sitemaps
- [ ] Verify `https://seadays.app/robots.txt` loads
- [ ] Verify `https://seadays.app/sitemap.xml` loads
- [ ] Use URL Inspection on a few blog URLs to confirm indexing
- [ ] Monitor Performance and Pages reports over time

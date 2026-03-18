#!/usr/bin/env node
/**
 * Generates sitemap.xml with static pages and blog article URLs.
 * Prefer scripts/generateBlogs.js for full static blog generation (creates HTML + sitemap).
 * Run: node scripts/generate-sitemap.js
 * Requires: SUPABASE_ANON_KEY in .env or environment
 */
'use strict';

require('dotenv').config();
const https = require('https');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = 'https://soqkgrfzluewpuiguypm.supabase.co/functions/v1/make-server-51d3ca8d';
const BLOG_PATH = '/portside-articles?limit=500&forWebsite=1';
const BASE = 'https://seadays.app';

const staticUrls = [
  { loc: BASE + '/', changefreq: 'weekly', priority: '1.0' },
  { loc: BASE + '/index.html', changefreq: 'weekly', priority: '1.0' },
  { loc: BASE + '/blog/', changefreq: 'daily', priority: '0.9' },
  { loc: BASE + '/landing-page.html', changefreq: 'weekly', priority: '0.8' },
];

function slugify(title) {
  if (!title || typeof title !== 'string') return 'article';
  return title.toLowerCase().trim().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'article';
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function fetchBlog() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.warn('SUPABASE_ANON_KEY not set. Generating sitemap with static pages only.');
    return Promise.resolve({ articles: [] });
  }
  const url = SUPABASE_URL + BLOG_PATH;
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: 'Bearer ' + key, apikey: key },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve({ articles: [] });
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ articles: [] });
        }
      });
    });
    req.on('error', () => resolve({ articles: [] }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ articles: [] }); });
  });
}

fetchBlog().then((data) => {
  const articles = (data && data.articles) ? data.articles : [];
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  staticUrls.forEach((u) => {
    xml += '  <url><loc>' + escapeXml(u.loc) + '</loc><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>\n';
  });
  const slugMap = new Map();
  articles.forEach((a) => {
    if (a && a.id && a.isDraft !== true && a.showOnWebsite !== false) {
      let slug = (a.slug || '').trim() || slugify(a.title || 'article');
      let base = slug;
      let n = 1;
      while (slugMap.has(slug)) { slug = base + '-' + n; n++; }
      slugMap.set(slug, true);
      const url = BASE + '/blog/' + slug + '.html';
      xml += '  <url><loc>' + escapeXml(url) + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n';
    }
  });
  xml += '</urlset>';

  const outPath = path.join(__dirname, '..', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log('Wrote sitemap.xml with', staticUrls.length, 'static +', articles.filter((a) => a && a.id && a.isDraft !== true && a.showOnWebsite !== false).length, 'articles');
});

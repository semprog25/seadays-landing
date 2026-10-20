#!/usr/bin/env node
'use strict';

/**
 * Read-only comparison of local blog overrides with the public Portside feed.
 * Never POSTs, never writes Supabase, never changes showOnWebsite or isDraft.
 *
 * Usage: node scripts/cms-reconciliation-dry-run.js
 * Writes docs/cms-reconciliation-dry-run.md
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'docs', 'cms-reconciliation-dry-run.md');
const EDGE = 'https://soqkgrfzluewpuiguypm.supabase.co/functions/v1/make-server-51d3ca8d/portside-articles';

function loadEnvKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const envPath = path.join(ROOT, '.env');
  if (!fs.existsSync(envPath)) return '';
  const line = fs.readFileSync(envPath, 'utf8').split('\n').find((row) => row.startsWith('SUPABASE_ANON_KEY='));
  if (!line) return '';
  return line.slice('SUPABASE_ANON_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
}

function getJson(url, key) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
      });
    });
    req.on('error', reject);
  });
}

function localRows() {
  const metaPath = path.join(ROOT, 'data', 'blog-body-overrides', 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const corrections = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'blog-article-corrections.json'), 'utf8'));
  const titles = corrections.titleBySourceSlug || {};
  return Object.keys(meta).sort().map((slug) => ({
    slug,
    localTitle: meta[slug].title || titles[slug] || '',
    localDescription: meta[slug].description || '',
    hasBodyOverride: fs.existsSync(path.join(ROOT, 'data', 'blog-body-overrides', `${slug}.html`)),
  }));
}

async function main() {
  const rows = localRows();
  const lines = [];
  lines.push('# CMS reconciliation dry run');
  lines.push('');
  lines.push('Read only. No Supabase write, no CMS approval, no publish.');
  lines.push('');
  lines.push('## Generator precedence');
  lines.push('');
  lines.push('1. `GET /portside-articles?forWebsite=1` returns summaries where `isDraft !== true` and `showOnWebsite !== false`.');
  lines.push('2. `GET /portside-articles/:id` loads the stored article. Saves go through `POST /portside-articles` as the article author (`requirePortsidePublisher`). Website visibility is `PUT /portside-articles/:id/visibility` and requires a CMS admin.');
  lines.push('3. `data/blog-body-overrides/<slug>.html` replaces the body at generation time.');
  lines.push('4. `data/blog-body-overrides/meta.json` `title` and `description`, and `data/blog-article-corrections.json` `titleBySourceSlug`, replace the visible title and excerpt. The folder slug and canonical stay.');
  lines.push('5. A later generator run without those files would put the CMS title, excerpt, and body back.');
  lines.push('');
  lines.push('App feed copies are the same Portside records (`portside:article:<id>` in `kv_store_51d3ca8d`). Changing a published article changes the app feed. Drafts (`isDraft: true`) stay off the website feed. Do not flip `isDraft` or `showOnWebsite` from this tool.');
  lines.push('');

  const key = loadEnvKey();
  if (!key) {
    lines.push('## Limitation');
    lines.push('');
    lines.push('`SUPABASE_ANON_KEY` was not available. Article IDs were not fetched. The table below is the local change list only.');
    lines.push('');
    lines.push('| Slug | Local title | Body override | CMS id |');
    lines.push('|---|---|---|---|');
    for (const row of rows) {
      lines.push(`| ${row.slug} | ${row.localTitle || '(unchanged)'} | ${row.hasBodyOverride ? 'yes' : 'no'} | unknown |`);
    }
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
    console.log('wrote dry run without CMS ids');
    return;
  }

  const articles = [];
  try {
    for (let offset = 0; offset < 500; offset += 100) {
      const page = await getJson(`${EDGE}?limit=100&offset=${offset}&forWebsite=1`, key);
      const batch = Array.isArray(page.articles) ? page.articles : [];
      articles.push(...batch);
      if (batch.length < 100) break;
    }
  } catch (err) {
    lines.push('## Limitation');
    lines.push('');
    lines.push(`Public feed fetch failed (${err.message}). No IDs were invented.`);
    lines.push('');
    fs.writeFileSync(OUT, lines.join('\n') + '\n');
    console.log('fetch failed', err.message);
    return;
  }
  const bySlug = new Map(articles.filter((article) => article && article.slug).map((article) => [article.slug, article]));
  lines.push(`Public feed rows: ${articles.length}.`);
  lines.push('');
  lines.push('| Slug | CMS id | CMS title differs | Excerpt differs | Body override | isDraft | showOnWebsite |');
  lines.push('|---|---|---|---|---|---|---|');
  let missing = 0;
  for (const row of rows) {
    const cms = bySlug.get(row.slug);
    if (!cms) {
      missing += 1;
      lines.push(`| ${row.slug} | NOT IN FEED | | | ${row.hasBodyOverride ? 'yes' : 'no'} | | |`);
      continue;
    }
    const titleDiffers = Boolean(row.localTitle) && row.localTitle !== cms.title;
    const excerptDiffers = Boolean(row.localDescription) && row.localDescription !== cms.excerpt;
    lines.push(`| ${row.slug} | ${cms.id || ''} | ${titleDiffers ? 'yes' : 'no'} | ${excerptDiffers ? 'yes' : 'no'} | ${row.hasBodyOverride ? 'yes' : 'no'} | ${cms.isDraft === true} | ${cms.showOnWebsite !== false} |`);
  }
  lines.push('');
  lines.push(`Override slugs missing from the public feed: ${missing}.`);
  lines.push('');
  lines.push('To update the CMS, an author session must `POST /make-server-51d3ca8d/portside-articles` with the existing `id`, the same `authorId`, `isDraft: false`, and `showOnWebsite` left as it is. Put the local title in `title`, the local description in `excerpt`, and the override HTML in `content`. Then run the website generator. This dry run does not do that.');
  fs.writeFileSync(OUT, lines.join('\n') + '\n');
  console.log(`wrote dry run, feed ${articles.length}, missing ${missing}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

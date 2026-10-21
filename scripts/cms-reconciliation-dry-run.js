#!/usr/bin/env node
'use strict';

/**
 * Read-only comparison of local blog overrides with Portside CMS records.
 * Never POSTs, never writes Supabase, never changes showOnWebsite or isDraft.
 *
 * Usage:
 *   SUPABASE_ANON_KEY=... node scripts/cms-reconciliation-dry-run.js
 *   SEADAYS_APP_ROOT=/path/to/app node scripts/cms-reconciliation-dry-run.js  # reads publishable anon key from info.tsx
 * Writes:
 *   docs/cms-reconciliation-dry-run.md
 *   data/cms-reconciliation-manifest.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const ROOT = process.env.SEADAYS_LANDING_ROOT
  ? path.resolve(process.env.SEADAYS_LANDING_ROOT)
  : path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'docs', 'cms-reconciliation-dry-run.md');
const OUT_JSON = path.join(ROOT, 'data', 'cms-reconciliation-manifest.json');
const EDGE_BASE =
  'https://soqkgrfzluewpuiguypm.supabase.co/functions/v1/make-server-51d3ca8d/portside-articles';

const EXPECTED_OVERRIDE_SLUGS = () => {
  const metaPath = path.join(ROOT, 'data', 'blog-body-overrides', 'meta.json');
  if (!fs.existsSync(metaPath)) return 0;
  return Object.keys(JSON.parse(fs.readFileSync(metaPath, 'utf8'))).length;
};

function readAnonKeyFromInfoTsx(filePath) {
  if (!fs.existsSync(filePath)) return '';
  const text = fs.readFileSync(filePath, 'utf8');
  const m = text.match(/publicAnonKey\s*=\s*"([^"]+)"/);
  return m ? m[1] : '';
}

function loadEnvKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY.trim();
  if (process.env.VITE_SUPABASE_ANON_KEY) return process.env.VITE_SUPABASE_ANON_KEY.trim();
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    for (const row of fs.readFileSync(envPath, 'utf8').split('\n')) {
      if (row.startsWith('SUPABASE_ANON_KEY=')) {
        return row.slice('SUPABASE_ANON_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
      }
      if (row.startsWith('VITE_SUPABASE_ANON_KEY=')) {
        return row.slice('VITE_SUPABASE_ANON_KEY='.length).trim().replace(/^['"]|['"]$/g, '');
      }
    }
  }
  if (process.env.SEADAYS_APP_ROOT) {
    const fromApp = readAnonKeyFromInfoTsx(
      path.join(path.resolve(process.env.SEADAYS_APP_ROOT), 'src', 'utils', 'supabase', 'info.tsx')
    );
    if (fromApp) return fromApp;
  }
  return '';
}

function getJson(url, key) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      { headers: { Authorization: `Bearer ${key}`, apikey: key } },
      (res) => {
        let body = '';
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`));
            return;
          }
          try {
            resolve(JSON.parse(body));
          } catch (err) {
            reject(err);
          }
        });
      }
    );
    req.on('error', reject);
  });
}

function normalizeComparableHtml(html) {
  return String(html || '')
    .replace(/\s+/g, ' ')
    .replace(/>\s+</g, '><')
    .trim()
    .toLowerCase();
}

function contentFingerprint(html) {
  return crypto.createHash('sha256').update(normalizeComparableHtml(html)).digest('hex').slice(0, 16);
}

function escapeMdCell(value) {
  return String(value || '')
    .replace(/\|/g, '\\|')
    .replace(/\r?\n/g, ' ')
    .slice(0, 200);
}

function localRows() {
  const metaPath = path.join(ROOT, 'data', 'blog-body-overrides', 'meta.json');
  const meta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const corrections = JSON.parse(
    fs.readFileSync(path.join(ROOT, 'data', 'blog-article-corrections.json'), 'utf8')
  );
  const titles = corrections.titleBySourceSlug || {};
  return Object.keys(meta)
    .sort()
    .map((slug) => {
      const overridePath = path.join(ROOT, 'data', 'blog-body-overrides', `${slug}.html`);
      const localBody = fs.existsSync(overridePath) ? fs.readFileSync(overridePath, 'utf8') : '';
      return {
        slug,
        localTitle: meta[slug].title || titles[slug] || '',
        localDescription: meta[slug].description || '',
        localBody,
        hasBodyOverride: Boolean(localBody),
      };
    });
}

function manifestOnDiskIsComplete(expectedCount) {
  if (!fs.existsSync(OUT_MD) || !fs.existsSync(OUT_JSON)) return false;
  try {
    const json = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
    if (json.complete !== true || json.overrideCount !== expectedCount) return false;
    if (!Array.isArray(json.articles) || json.articles.length !== expectedCount) return false;
    const md = fs.readFileSync(OUT_MD, 'utf8');
    if (md.includes('## Limitation') || !md.includes('## Full manifest')) return false;
    return true;
  } catch {
    return false;
  }
}

function refusePartialOverwrite(reason, expectedCount) {
  if (manifestOnDiskIsComplete(expectedCount)) {
    console.error(
      `Refusing to overwrite complete manifest (${expectedCount} overrides): ${reason}`
    );
    process.exit(2);
  }
}

function authorConflictNote(authorId) {
  const raw = String(authorId || '');
  if (!raw) return 'missing authorId';
  if (raw.startsWith('user_') && raw.length > 5) {
    const bare = raw.slice(5);
    return `prefixed; canonical publisher id is usually ${bare}`;
  }
  return '';
}

async function fetchPublicFeed(key) {
  const articles = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const page = await getJson(`${EDGE_BASE}?limit=100&offset=${offset}&forWebsite=1`, key);
    const batch = Array.isArray(page.articles) ? page.articles : [];
    articles.push(...batch);
    if (batch.length < 100) break;
  }
  return articles;
}

async function fetchArticleById(key, articleId) {
  const payload = await getJson(`${EDGE_BASE}/${encodeURIComponent(articleId)}`, key);
  return payload && payload.article ? payload.article : null;
}

function cmsBodyHtml(article) {
  if (!article) return '';
  if (typeof article.content === 'string' && article.content.trim()) return article.content;
  if (article.structuredContent) return JSON.stringify(article.structuredContent);
  return '';
}

function buildDiffFields(row) {
  const fields = [];
  if (row.titleDiffers) fields.push('title');
  if (row.excerptDiffers) fields.push('excerpt');
  if (row.contentDiffers) fields.push('content');
  return fields;
}

function safeReconcile(row) {
  if (row.feedStatus === 'NOT_IN_FEED') {
    return {
      safe: false,
      reason: 'Not in forWebsite feed; resolve visibility/draft before CMS sync',
    };
  }
  if (!row.cmsId) {
    return { safe: false, reason: 'Missing CMS id' };
  }
  if (!row.authorId) {
    return { safe: false, reason: 'Missing authorId on CMS record' };
  }
  if (row.isDraft === true) {
    return { safe: false, reason: 'CMS record is draft' };
  }
  if (row.showOnWebsite === false) {
    return { safe: false, reason: 'showOnWebsite is false' };
  }
  return {
    safe: true,
    reason: 'Author POST with existing id + authorId; preserve isDraft/showOnWebsite from fresh GET',
  };
}

async function main() {
  const expectedCount = EXPECTED_OVERRIDE_SLUGS();
  const rows = localRows();
  if (rows.length !== expectedCount) {
    console.error(`Expected ${expectedCount} local overrides, got ${rows.length}`);
    process.exit(1);
  }

  const key = loadEnvKey();
  if (!key) {
    refusePartialOverwrite('SUPABASE_ANON_KEY unavailable', expectedCount);
    console.error(
      'STOP: Set SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY in .env, or point SEADAYS_APP_ROOT at a checkout with src/utils/supabase/info.tsx'
    );
    process.exit(1);
  }

  let feed = [];
  try {
    feed = await fetchPublicFeed(key);
  } catch (err) {
    refusePartialOverwrite(`public feed fetch failed: ${err.message}`, expectedCount);
    console.error(`STOP: Public feed fetch failed (${err.message})`);
    process.exit(1);
  }

  const bySlug = new Map(feed.filter((a) => a && a.slug).map((a) => [a.slug, a]));
  const manifestRows = [];
  const idToSlugs = new Map();

  for (const local of rows) {
    const summary = bySlug.get(local.slug);
    if (!summary) {
      manifestRows.push({
        slug: local.slug,
        feedStatus: 'NOT_IN_FEED',
        cmsId: null,
        authorId: null,
        isDraft: null,
        showOnWebsite: null,
        cmsTitle: '',
        localTitle: local.localTitle,
        cmsExcerpt: '',
        localExcerpt: local.localDescription,
        titleDiffers: Boolean(local.localTitle),
        excerptDiffers: Boolean(local.localDescription),
        contentDiffers: local.hasBodyOverride,
        localBodyFingerprint: contentFingerprint(local.localBody),
        cmsBodyFingerprint: null,
        fieldsDiffer: buildDiffFields({
          titleDiffers: Boolean(local.localTitle),
          excerptDiffers: Boolean(local.localDescription),
          contentDiffers: local.hasBodyOverride,
        }),
        authorNote: '',
        reconcile: safeReconcile({ feedStatus: 'NOT_IN_FEED' }),
      });
      continue;
    }

    const cmsId = summary.id || '';
    if (cmsId) {
      const list = idToSlugs.get(cmsId) || [];
      list.push(local.slug);
      idToSlugs.set(cmsId, list);
    }

    let detail = null;
    try {
      detail = await fetchArticleById(key, cmsId);
    } catch (err) {
      refusePartialOverwrite(`detail fetch failed for ${cmsId}: ${err.message}`, expectedCount);
      console.error(`STOP: GET article failed for ${local.slug} (${cmsId}): ${err.message}`);
      process.exit(1);
    }

    const authorId = (detail && (detail.authorId || detail.userId)) || summary.authorId || summary.userId || '';
    const cmsTitle = (detail && detail.title) || summary.title || '';
    const cmsExcerpt = (detail && detail.excerpt) || summary.excerpt || '';
    const cmsHtml = cmsBodyHtml(detail || summary);
    const titleDiffers = Boolean(local.localTitle) && local.localTitle !== cmsTitle;
    const excerptDiffers = Boolean(local.localDescription) && local.localDescription !== cmsExcerpt;
    const contentDiffers =
      local.hasBodyOverride && contentFingerprint(local.localBody) !== contentFingerprint(cmsHtml);

    const row = {
      slug: local.slug,
      feedStatus: 'IN_FEED',
      cmsId,
      authorId: String(authorId),
      isDraft: detail ? detail.isDraft === true : summary.isDraft === true,
      showOnWebsite: detail ? detail.showOnWebsite !== false : summary.showOnWebsite !== false,
      cmsTitle,
      localTitle: local.localTitle || '(unchanged on website generator)',
      cmsExcerpt,
      localExcerpt: local.localDescription || '(unchanged on website generator)',
      titleDiffers,
      excerptDiffers,
      contentDiffers,
      localBodyFingerprint: contentFingerprint(local.localBody),
      cmsBodyFingerprint: contentFingerprint(cmsHtml),
      fieldsDiffer: buildDiffFields({ titleDiffers, excerptDiffers, contentDiffers }),
      authorNote: authorConflictNote(authorId),
      reconcile: safeReconcile({
        feedStatus: 'IN_FEED',
        cmsId,
        authorId,
        isDraft: detail ? detail.isDraft === true : summary.isDraft === true,
        showOnWebsite: detail ? detail.showOnWebsite !== false : summary.showOnWebsite !== false,
      }),
    };
    manifestRows.push(row);
  }

  const duplicateIds = [...idToSlugs.entries()].filter(([, slugs]) => slugs.length > 1);
  const generatedAt = new Date().toISOString();

  const jsonPayload = {
    complete: true,
    generatedAt,
    publicFeedCount: feed.length,
    overrideCount: manifestRows.length,
    duplicateCmsIds: duplicateIds.map(([id, slugs]) => ({ id, slugs })),
    summary: {
      notInFeed: manifestRows.filter((r) => r.feedStatus === 'NOT_IN_FEED').length,
      titleStale: manifestRows.filter((r) => r.titleDiffers).length,
      excerptStale: manifestRows.filter((r) => r.excerptDiffers).length,
      contentStale: manifestRows.filter((r) => r.contentDiffers).length,
      safeToReconcile: manifestRows.filter((r) => r.reconcile.safe).length,
      blocked: manifestRows.filter((r) => !r.reconcile.safe).length,
    },
    articles: manifestRows,
  };

  const lines = [];
  lines.push('# CMS reconciliation dry run');
  lines.push('');
  lines.push(`Generated: ${generatedAt}`);
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
  lines.push('## Summary');
  lines.push('');
  lines.push(`- Public feed rows: **${feed.length}**`);
  lines.push(`- Local override slugs: **${manifestRows.length}**`);
  lines.push(`- Not in public feed: **${jsonPayload.summary.notInFeed}**`);
  lines.push(`- Title stale vs CMS: **${jsonPayload.summary.titleStale}**`);
  lines.push(`- Excerpt stale vs CMS: **${jsonPayload.summary.excerptStale}**`);
  lines.push(`- Body stale vs CMS (fingerprint): **${jsonPayload.summary.contentStale}**`);
  lines.push(`- Safe to reconcile via author POST (in feed): **${jsonPayload.summary.safeToReconcile}**`);
  lines.push(`- Blocked / unresolved mapping: **${jsonPayload.summary.blocked}**`);
  if (duplicateIds.length) {
    lines.push(`- Duplicate CMS id mappings: **${duplicateIds.length}** (see JSON manifest)`);
  }
  lines.push('');
  lines.push('Machine-readable manifest: `data/cms-reconciliation-manifest.json`');
  lines.push('');
  lines.push('## Safe CMS update procedure (future, not executed here)');
  lines.push('');
  lines.push('See `docs/cms-sync-procedure.md`. Requires fresh `GET /portside-articles/:id` immediately before any `POST`, field-level diff, and author session matching stored `authorId`. The Portside POST handler merges `{ ...existingArticle, ...articleIncoming }` with **no version/ETag guard** — treat concurrent CMS edits as a blocker until manually reconciled.');
  lines.push('');
  lines.push('## Full manifest');
  lines.push('');
  lines.push(
    '| Slug | CMS id | authorId | isDraft | showOnWebsite | Fields differ | Safe reconcile | CMS title | Local title |'
  );
  lines.push('|---|---|---|---|---|---|---|---|---|');
  for (const row of manifestRows) {
    const id = row.cmsId || 'NOT IN FEED';
    const author = row.authorId || '—';
    const draft = row.isDraft === null ? '—' : String(row.isDraft);
    const vis = row.showOnWebsite === null ? '—' : String(row.showOnWebsite);
    const fields = row.fieldsDiffer.length ? row.fieldsDiffer.join(', ') : '—';
    const safe = row.reconcile.safe ? 'yes' : `no (${row.reconcile.reason})`;
    lines.push(
      `| ${row.slug} | ${escapeMdCell(id)} | ${escapeMdCell(author)} | ${draft} | ${vis} | ${fields} | ${escapeMdCell(safe)} | ${escapeMdCell(row.cmsTitle)} | ${escapeMdCell(row.localTitle)} |`
    );
  }
  lines.push('');
  lines.push('Excerpt and body fingerprints: `data/cms-reconciliation-manifest.json` per article (`cmsExcerpt`, `localExcerpt`, `*BodyFingerprint`).');
  lines.push('');
  lines.push(
    'To update the CMS later: author session `POST /make-server-51d3ca8d/portside-articles` with `userId` matching normalized publisher id, existing `article.id`, preserved `authorId`, and only intended fields changed after a fresh GET diff. Then run the website generator. This dry run does not do that.'
  );

  fs.writeFileSync(OUT_JSON, JSON.stringify(jsonPayload, null, 2) + '\n');
  fs.writeFileSync(OUT_MD, lines.join('\n') + '\n');
  console.log(
    `wrote manifest: ${manifestRows.length} overrides, feed ${feed.length}, content stale ${jsonPayload.summary.contentStale}`
  );
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});

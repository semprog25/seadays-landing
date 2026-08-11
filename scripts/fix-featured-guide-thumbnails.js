#!/usr/bin/env node
'use strict';

/**
 * Replace marketing/favicon placeholders on /ports/ and /ships/ featured guide
 * cards with stable public thumbnails materialized from each article's og:image.
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (local .env or Seadays-main/.env).
 *
 * Usage:
 *   node scripts/fix-featured-guide-thumbnails.js
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const {
  isSignedStorageUrl,
  materializeSignedImageToPublic,
  resolveImageUrl,
} = require('./generateBlogs');

const ROOT = path.join(__dirname, '..');
const TARGETS = [path.join(ROOT, 'ports', 'index.html'), path.join(ROOT, 'ships', 'index.html')];

const MARKETING_OR_FAV =
  /Websitehomebucket\/Cruise%20planner\.jpg|Websitehomebucket\/Discover%20Ships%20%20Ports\.jpg|SeadaysPublic\/seadaysfav\.png/i;

function headOk(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function extractSlug(href) {
  const m = String(href || '').match(/\/blog\/([^/]+)\/?/);
  return m ? m[1] : '';
}

function readArticleImage(slug) {
  const articlePath = path.join(ROOT, 'blog', slug, 'index.html');
  if (!fs.existsSync(articlePath)) return '';
  const html = fs.readFileSync(articlePath, 'utf8');
  const og = (html.match(/property="og:image"\s+content="([^"]+)"/i) || [])[1] || '';
  if (og) return og;
  const hero =
    (html.match(
      /<img\b[^>]*class="[^"]*article-hero[^"]*"[^>]*\bsrc="([^"]+)"/i
    ) || [])[1] ||
    (html.match(/<img\b[^>]*\bsrc="([^"]+)"[^>]*class="[^"]*article-hero[^"]*"/i) || [])[1] ||
    '';
  return hero;
}

/**
 * Resolve a stable public URL for a featured card (materialize signed when needed).
 */
async function resolveStablePublicThumb(slug, rawUrl) {
  if (!rawUrl) return null;
  if (MARKETING_OR_FAV.test(rawUrl)) return null;

  const resolved = await resolveImageUrl(rawUrl, slug, 0, { stablePublicOnly: true });
  if (resolved && !isSignedStorageUrl(resolved) && !MARKETING_OR_FAV.test(resolved)) {
    if (await headOk(resolved)) return { url: resolved, source: 'resolved', type: 'supabase' };
  }

  if (isSignedStorageUrl(rawUrl)) {
    const materialized = await materializeSignedImageToPublic(rawUrl, slug);
    if (materialized && (await headOk(materialized))) {
      return { url: materialized, source: 'materialized', type: 'supabase' };
    }
  }

  return null;
}

function patchGuideCardImg(tag, publicUrl, source, type) {
  let next = tag;
  next = next.replace(/\bsrc="[^"]*"/i, `src="${publicUrl}"`);
  if (/\bdata-img-source="/i.test(next)) {
    next = next.replace(/\bdata-img-source="[^"]*"/i, `data-img-source="${source}"`);
  } else {
    next = next.replace(/<img\b/i, `<img data-img-source="${source}"`);
  }
  if (/\bdata-img-type="/i.test(next)) {
    next = next.replace(/\bdata-img-type="[^"]*"/i, `data-img-type="${type}"`);
  } else {
    next = next.replace(/<img\b/i, `<img data-img-type="${type}"`);
  }
  return next;
}

async function fixFile(filePath) {
  let html = fs.readFileSync(filePath, 'utf8');
  const cardRe = /<a class="guide-card" href="(\/blog\/[^"]+)">([\s\S]*?)<\/a>/gi;
  const cards = [...html.matchAll(cardRe)];
  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const match of cards) {
    const full = match[0];
    const href = match[1];
    const slug = extractSlug(href);
    const imgTag = (full.match(/<img\b[^>]*>/i) || [])[0];
    if (!imgTag || !slug) {
      skipped++;
      continue;
    }
    const src = (imgTag.match(/\bsrc="([^"]+)"/i) || [])[1] || '';
    const isFallback =
      /data-img-type="fallback"/i.test(imgTag) || MARKETING_OR_FAV.test(src);
    if (!isFallback) {
      skipped++;
      continue;
    }

    const articleImg = readArticleImage(slug);
    const resolved = await resolveStablePublicThumb(slug, articleImg);
    if (!resolved) {
      console.warn(`  FAIL ${slug}: no stable public thumb (article img: ${articleImg ? 'yes' : 'no'})`);
      failed++;
      continue;
    }

    const newImg = patchGuideCardImg(imgTag, resolved.url, resolved.source, resolved.type);
    const newCard = full.replace(imgTag, newImg);
    html = html.replace(full, newCard);
    fixed++;
    console.log(`  OK   ${slug} → ${resolved.url.slice(0, 90)}…`);
  }

  fs.writeFileSync(filePath, html, 'utf8');
  return { fixed, skipped, failed };
}

async function main() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_SERVICE_ROLE_KEY — cannot materialize signed images.');
    process.exit(1);
  }

  let totalFixed = 0;
  let totalFailed = 0;
  for (const file of TARGETS) {
    console.log(`\n[fix] ${path.relative(ROOT, file)}`);
    const { fixed, skipped, failed } = await fixFile(file);
    totalFixed += fixed;
    totalFailed += failed;
    console.log(`  summary: fixed=${fixed} skipped=${skipped} failed=${failed}`);
  }

  // Verify no guide-card primary src is still a marketing/favicon placeholder
  for (const file of TARGETS) {
    const html = fs.readFileSync(file, 'utf8');
    const leftover = [...html.matchAll(/<a class="guide-card"[^>]*>[\s\S]*?<img\b([^>]*)>/gi)].filter((m) => {
      const attrs = m[1] || '';
      const src = (attrs.match(/\bsrc="([^"]+)"/i) || [])[1] || '';
      const type = (attrs.match(/data-img-type="([^"]+)"/i) || [])[1] || '';
      return type === 'fallback' || MARKETING_OR_FAV.test(src);
    });
    if (leftover.length) {
      console.error(
        `\nStill have ${leftover.length} fallback guide-card img(s) in ${path.relative(ROOT, file)}`
      );
      process.exitCode = 1;
    } else {
      console.log(`  verify OK: no fallback primary thumbs in ${path.relative(ROOT, file)}`);
    }
  }

  console.log(`\nDone. fixed=${totalFixed} failed=${totalFailed}`);
  if (totalFailed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

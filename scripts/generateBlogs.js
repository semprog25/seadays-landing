#!/usr/bin/env node
/**
 * Static Blog Generator for SeaDays
 *
 * Fetches published articles from Supabase, generates static HTML files for SEO,
 * and updates sitemap.xml. Run before deploy to GitHub Pages.
 *
 * - Replaces base64 images with Supabase Storage URLs (requires SUPABASE_SERVICE_ROLE_KEY)
 * - Adds JSON-LD Article structured data
 * - Ensures SEO meta tags, canonical, robots, loading="lazy" on images
 *
 * Usage: node scripts/generateBlogs.js
 * Requires: SUPABASE_ANON_KEY (fetch), SUPABASE_SERVICE_ROLE_KEY (upload base64 images)
 */
'use strict';

require('dotenv').config();
const { injectKeywordLinksIntoBodyHtml } = require('./lib/seoKeywordLinks');
const {
  buildSeoShipRecords,
  buildSeoPortRecords,
  buildShipDetailHtml,
  buildPortDetailHtml,
  pickRelatedShips,
  pickRelatedPorts,
  pickPortsForShipPage,
  pickShipsForPortPage,
  pickBlogArticlesForEntity,
} = require('./lib/seoShipPortPages');
const { allShips: APP_ALL_SHIPS, allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { FALLBACK_SHIP_GRID, FALLBACK_PORT_GRID } = require('./lib/seoShipPortFallbacks');
const https = require('https');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPABASE_URL = 'https://soqkgrfzluewpuiguypm.supabase.co';
const STORAGE_PUBLIC_URL = 'https://auth.seadays.app/storage/v1/object/public';
const BLOG_IMAGES_BUCKET = 'SeadaysPublic';
const BLOG_IMAGES_PREFIX = 'blog-images';
const EDGE_BASE = SUPABASE_URL + '/functions/v1/make-server-51d3ca8d';
const BASE_URL = 'https://seadays.app';

/** Canonical blog article URL — always trailing slash */
function blogCanonicalUrl(slug) {
  return `${BASE_URL}/blog/${slug}/`;
}

/** Root-relative article path for internal links */
function blogRelPath(slug) {
  return `/blog/${slug}/`;
}
const DEFAULT_FAVICON = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
/**
 * Ultimate fallback shown when every image resolution strategy fails.
 * Must be a guaranteed-valid auth.seadays.app/storage URL so it passes
 * validateImageUrl() itself and never causes an infinite onerror loop.
 */
const FALLBACK_IMAGE_URL = DEFAULT_FAVICON;
/**
 * Fallback image pool — picks by article position so cards with no thumbnail
 * don't all show the same icon. Add more Supabase storage URLs here when
 * additional placeholder images are uploaded.
 */
const FALLBACK_IMAGES = [
  DEFAULT_FAVICON,
  // Additional fallback images can be added here as auth.seadays.app/storage URLs
];
function getFallbackImage(indexKey) {
  const n = Math.abs(parseInt(String(indexKey).replace(/\D+/g, '') || '0', 10));
  return FALLBACK_IMAGES[n % FALLBACK_IMAGES.length];
}

const LOGO_URL = 'https://seadays.app/logo.png';
/** CDN origin used by the edge function in API responses; may have routing issues on static pages. */
const CDN_SITE_ORIGIN = 'https://cdn.seadays.app';
/** Supabase bucket for portside images served outside the SeadaysPublic/portside/ path. */
const PORTSIDE_IMAGES_BUCKET = 'make-51d3ca8d-portside-images';

// ---------------------------------------------------------------------------
// Base64 image upload (optional; requires SUPABASE_SERVICE_ROLE_KEY)
// Deduplicates by hash, skips re-upload if already in cache, production-safe fallback
// ---------------------------------------------------------------------------

const base64UrlCache = new Map();
const imageStats = { uploaded: 0, removed: 0 };
/** Counts per quality tier accumulated across all pickCardImage calls. */
const imageQualityStats = { supabase: 0, external: 0, fallback: 0 };
const SIZE_WARN_KB = 500;
const MIME_TO_EXT = { jpeg: 'jpg', jpg: 'jpg', png: 'png', gif: 'gif', webp: 'webp', 'svg+xml': 'svg', svg: 'svg' };

function getMimeAndExt(dataUrl) {
  const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
  if (!match) return null;
  const mime = (match[1] || '').toLowerCase();
  const ext = MIME_TO_EXT[mime] || (mime === 'jpeg' ? 'jpg' : mime || 'png');
  return { mime, ext, base64: match[2] };
}

async function uploadBase64ToStorage(dataUrl, articleId, index) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image')) return null;
  const parsed = getMimeAndExt(dataUrl);
  if (!parsed) return null;
  const { mime, ext, base64 } = parsed;
  const hash = crypto.createHash('md5').update(base64).digest('hex').slice(0, 16);
  const cacheKey = hash;
  if (base64UrlCache.has(cacheKey)) return base64UrlCache.get(cacheKey);
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const storagePath = `${BLOG_IMAGES_PREFIX}/${articleId}/${hash}.${ext}`;
  const publicUrl = `${STORAGE_PUBLIC_URL}/${BLOG_IMAGES_BUCKET}/${storagePath}`;
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, serviceKey);
    try {
      const { data: list } = await supabase.storage.from(BLOG_IMAGES_BUCKET).list(`${BLOG_IMAGES_PREFIX}/${articleId}`);
      if (list?.some((f) => f.name === `${hash}.${ext}`)) {
        base64UrlCache.set(cacheKey, publicUrl);
        return publicUrl;
      }
    } catch {
      /* folder may not exist, proceed to upload */
    }
    const buffer = Buffer.from(base64, 'base64');
    const contentType = mime === 'svg+xml' || mime === 'svg' ? 'image/svg+xml' : `image/${mime}`;
    const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).upload(storagePath, buffer, {
      contentType,
      upsert: true,
    });
    if (error) return null;
    base64UrlCache.set(cacheKey, publicUrl);
    return publicUrl;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Image validation and resolution pipeline
// ---------------------------------------------------------------------------

/**
 * Ensure storage object path includes the public bucket when the CDN/API
 * omits it (common bug: cdn.seadays.app/portside/... → wrong bucket "portside").
 */
function ensureSeadaysPublicBucketInObjectPath(objectPathNoQuery) {
  let p = objectPathNoQuery.replace(/^\/+/, '');
  if (!p) return p;
  if (p.startsWith(`${BLOG_IMAGES_BUCKET}/`)) return p;
  if (p.startsWith('portside/') || p.startsWith(`${BLOG_IMAGES_PREFIX}/`)) {
    return `${BLOG_IMAGES_BUCKET}/${p}`;
  }
  return p;
}

/**
 * Convert cdn.seadays.app URLs to direct Supabase Storage URLs.
 * The CDN has routing issues in static GitHub Pages context.
 *
 * The edge function usually emits:
 *   cdn.seadays.app/SeadaysPublic/portside/...
 * but some responses omit the bucket segment:
 *   cdn.seadays.app/portside/...
 * which would wrongly map to .../public/portside/... (invalid bucket "portside").
 */
/**
 * Normalize image URLs from CMS/edge (protocol-relative, bare host, http) before CDN→storage rewrite.
 */
function normalizeUrlForCdnRewrite(url) {
  if (!url || typeof url !== 'string') return url;
  let t = url.trim();
  if (t.startsWith('//')) return `https:${t}`;
  if (t.startsWith('http://')) return `https://${t.slice(7)}`;
  if (/^cdn\.seadays\.app\//i.test(t)) return `https://${t}`;
  return t;
}

function cdnToDirectStorageUrl(url) {
  const normalized = normalizeUrlForCdnRewrite(url);
  const u = typeof normalized === 'string' ? normalized : url;
  if (!u || !u.startsWith(`${CDN_SITE_ORIGIN}/`)) return u;
  const rest = u.slice(`${CDN_SITE_ORIGIN}/`.length);
  const qIdx = rest.indexOf('?');
  const pathPart = (qIdx === -1 ? rest : rest.slice(0, qIdx)).replace(/^\/+/, '');
  const query = qIdx === -1 ? '' : rest.slice(qIdx);
  if (!pathPart) return url;
  const fixed = ensureSeadaysPublicBucketInObjectPath(pathPart);
  return `${STORAGE_PUBLIC_URL}/${fixed}${query}`;
}

/**
 * Fix direct auth.seadays.app public URLs that are missing the SeadaysPublic bucket segment.
 */
function normalizeAuthStoragePublicUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const prefix = `${STORAGE_PUBLIC_URL}/`;
  if (!url.startsWith(prefix)) return url;
  const qIdx = url.indexOf('?', prefix.length);
  const pathPart = (qIdx === -1 ? url.slice(prefix.length) : url.slice(prefix.length, qIdx));
  const query = qIdx === -1 ? '' : url.slice(qIdx);
  const fixed = ensureSeadaysPublicBucketInObjectPath(pathPart);
  if (fixed === pathPart) return url;
  return `${prefix}${fixed}${query}`;
}

/** Returns true for gradient-SVG data URLs emitted by the edge function as a "no image" placeholder. */
function isGradientSvgDataUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const t = url.trim();
  return t.startsWith('data:image/svg');
}

/**
 * Resolve a raw image URL: upload base64 to storage, convert CDN to direct, or return as-is.
 * Never returns a base64 data URL. Returns null when base64 upload fails.
 */
async function resolveImageUrl(url, articleId, index = 0) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('data:image')) {
    const httpsUrl = normalizeUrlForCdnRewrite(trimmed);
    return normalizeAuthStoragePublicUrl(cdnToDirectStorageUrl(httpsUrl));
  }
  const uploaded = await uploadBase64ToStorage(trimmed, articleId, index);
  if (uploaded) imageStats.uploaded++;
  else imageStats.removed++;
  return uploaded || null;
}

/**
 * Classify a URL into one of three quality tiers used for priority sorting.
 *
 *   'supabase'  — auth.seadays.app/storage (preferred: same origin, CDN-edge cached)
 *   'external'  — any other valid https:// raster image (allowed, lower priority)
 *   null        — rejected: CDN proxy, SVG, http, data:, or non-string
 *
 * The CDN proxy (cdn.seadays.app) is always rejected because it has routing
 * issues when served from GitHub Pages static context.
 */
function classifyImageUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('https://')) return null;
  if (trimmed.includes('cdn.seadays.app')) return null;
  const lower = trimmed.toLowerCase().split('?')[0];
  if (lower.endsWith('.svg') || lower.includes('svg+xml')) return null;
  if (trimmed.includes('auth.seadays.app/storage')) return 'supabase';
  return 'external';
}

/**
 * Validate a URL for use as a card image.
 * Returns the URL string when valid (both supabase and external accepted), null otherwise.
 * Used as the final gate before writing any src attribute.
 */
function validateImageUrl(url) {
  return classifyImageUrl(url) !== null ? url.trim() : null;
}

/** Returns true for SVG URLs — used to skip them during content scanning. */
function isSvgUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const lower = url.toLowerCase().split('?')[0];
  return lower.endsWith('.svg') || lower.includes('svg+xml');
}

/**
 * Scan article content for the first raster image URL.
 * Resolution order: processed bodyHtml → structuredContent → raw content.
 * processedBodyHtml is preferred because base64 images have already been
 * uploaded to Supabase Storage and replaced with real https:// URLs.
 */
function extractFirstRasterImageFromContent(article) {
  const rasterPattern = /src="(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp|gif)(?:[^"]*)?)"/i;
  if (article._processedBodyHtml) {
    const m = article._processedBodyHtml.match(rasterPattern);
    if (m) return m[1];
  }
  if (article.structuredContent) {
    try {
      const parsed = typeof article.structuredContent === 'string'
        ? JSON.parse(article.structuredContent)
        : article.structuredContent;
      if (parsed?.sections) {
        for (const section of parsed.sections) {
          for (const block of (section.blocks || [])) {
            if (block.type === 'image' && block.images?.length) {
              for (const img of block.images) {
                if (img?.url && !isSvgUrl(img.url) && !img.url.startsWith('data:')) {
                  return img.url;
                }
              }
            }
          }
        }
      }
    } catch { /* ignore JSON parse errors */ }
  }
  const html = article.content || '';
  if (!html) return null;
  const m = html.match(rasterPattern);
  return m ? m[1] : null;
}

// ---------------------------------------------------------------------------
// External image reachability (build-time light validation)
// ---------------------------------------------------------------------------

/** Cache of already-checked external URLs to avoid duplicate HEAD requests. */
const externalCheckCache = new Map();
/** Number of external HEAD checks performed this run. */
let externalChecksCount = 0;
/** Maximum external images to HEAD-check per build (keeps CI fast). */
const MAX_EXTERNAL_CHECKS = 10;

/**
 * Lightweight HEAD check for external images.
 * Returns true when reachable (HTTP 200) or when the check budget is exhausted
 * (assume ok to avoid stalling the build). Returns false on non-200/error.
 * Cached so the same URL is never checked twice.
 */
async function checkExternalUrl(url) {
  if (externalCheckCache.has(url)) return externalCheckCache.get(url);
  if (externalChecksCount >= MAX_EXTERNAL_CHECKS) return true;
  externalChecksCount++;
  const ok = await new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD', timeout: 5000 }, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => { req.destroy(); resolve(false); });
      req.end();
    } catch { resolve(false); }
  });
  externalCheckCache.set(url, ok);
  if (!ok) console.warn(`  [external-check] Non-200 for ${url.slice(0, 100)} — will use fallback`);
  return ok;
}

/**
 * Unified card image picker with tiered priority.
 *
 * Candidates are collected first, then sorted by quality tier so a Supabase
 * storage URL is always preferred over an external URL at the same source level.
 *
 * Priority order:
 *   1. thumbnailUrl  (supabase tier)
 *   2. heroImageUrl  (supabase tier)
 *   3. thumbnailUrl  (external tier) — HEAD-checked; downgraded to fallback if non-200
 *   4. heroImageUrl  (external tier) — same check
 *   5. First raster from processed body HTML (either tier, same check for external)
 *   6. getFallbackImage(index) — varies by article position, never null
 *
 * Returns { url: string, source: string, type: 'supabase'|'external'|'fallback' }
 */
async function pickCardImage(article, index) {
  const id = article.id || 'unknown';

  // Collect all resolved candidates tagged with their source and quality tier
  const pool = [];
  for (const { raw, source } of [
    { raw: (article.thumbnailUrl || '').trim(), source: 'thumbnail' },
    { raw: (article.heroImageUrl  || '').trim(), source: 'hero'      },
  ]) {
    if (!raw) continue;
    // Gradient SVG placeholders from the edge function are not real cover images — skip immediately
    // rather than uploading them to storage only to have classifyImageUrl reject the .svg URL.
    if (isGradientSvgDataUrl(raw)) {
      console.log(`  [img-skip] gradient SVG placeholder ignored for "${(article.title || article.id || '').slice(0,40)}" source=${source}`);
      continue;
    }
    const resolved = await resolveImageUrl(raw, id, `${index}-${source}`);
    const type = classifyImageUrl(resolved);
    if (!type) continue;
    if (type === 'external') {
      // Validate external images at build time (first MAX_EXTERNAL_CHECKS only)
      const ok = await checkExternalUrl(resolved.trim());
      if (!ok) continue; // skip broken external, try next candidate
    }
    pool.push({ url: resolved.trim(), source, type });
  }

  // Body extraction as lower-priority fallback
  const bodyRaw = extractFirstRasterImageFromContent(article);
  if (bodyRaw) {
    const resolved = await resolveImageUrl(bodyRaw, id, `${index}-body`);
    const type = classifyImageUrl(resolved);
    if (type) {
      const ok = type === 'external' ? await checkExternalUrl(resolved.trim()) : true;
      if (ok) pool.push({ url: resolved.trim(), source: 'body', type });
    }
  }

  if (pool.length > 0) {
    // Prefer supabase over external; within each tier preserve insertion order
    const best = pool.find(p => p.type === 'supabase') || pool[0];
    return best;
  }

  // Nothing valid — use index-varied fallback to avoid visual repetition
  return { url: getFallbackImage(index), source: 'fallback', type: 'fallback' };
}

/**
 * Log per-article image resolution with quality tier, and accumulate
 * counts in imageQualityStats for the end-of-run summary.
 */
function logImageResolution(article, source, type, finalUrl) {
  const title  = (article.title || article.id || '?').slice(0, 50);
  const result = finalUrl ? finalUrl.split('/').pop().slice(0, 50) : 'NONE';
  console.log(`  [img] "${title}" → source=${source} type=${type} file=${result}`);
  if (source === 'fallback') {
    const thumb = (article.thumbnailUrl || '—').slice(0, 80);
    const hero  = (article.heroImageUrl  || '—').slice(0, 80);
    console.warn(`  [img-warn] No real image found for "${title}". thumb=${thumb} hero=${hero}`);
  }
  // Accumulate quality stats (only count once per article, not per more-card repeat)
  if (type === 'supabase')  imageQualityStats.supabase++;
  else if (type === 'external') imageQualityStats.external++;
  else                          imageQualityStats.fallback++;
}

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Final pass: rewrite cdn.seadays.app in <img src> to direct Supabase storage URLs.
 * Catches tags missed by replaceBase64ImagesInHtml (odd attribute spacing, protocol-relative src, etc.).
 */
function rewriteCdnImgSrcAttributes(html) {
  if (!html || typeof html !== 'string' || !html.includes('cdn.seadays.app')) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    if (!tag.includes('cdn.seadays.app')) return tag;
    return tag.replace(
      /\bsrc\s*=\s*(["'])((?:https?:)?\/\/cdn\.seadays\.app\/[^"']+)\1/gi,
      (_m, q, rawUrl) => {
        const direct = normalizeAuthStoragePublicUrl(cdnToDirectStorageUrl(normalizeUrlForCdnRewrite(rawUrl)));
        return `src=${q}${escapeHtml(direct)}${q}`;
      }
    );
  });
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function sitemapUrlLine(loc, changefreq, priority, lastmod) {
  let line = '  <url><loc>' + escapeXml(loc) + '</loc>';
  if (lastmod) line += '<lastmod>' + escapeXml(lastmod) + '</lastmod>';
  line += '<changefreq>' + changefreq + '</changefreq><priority>' + priority + '</priority></url>\n';
  return line;
}

function buildRedirectPage(slug) {
  const target = '/blog/' + encodeURI(slug) + '/';
  const canonical = blogCanonicalUrl(slug);
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="robots" content="noindex, nofollow, noarchive">' +
    '<link rel="canonical" href="' + escapeHtml(canonical) + '">' +
    '<meta http-equiv="refresh" content="0;url=' + escapeHtml(target) + '">' +
    '<title>Redirect</title></head><body>' +
    '<script>window.location.replace("' + target.replace(/"/g, '\\"') + '");</script>' +
    '<p>Redirecting to <a href="' + escapeHtml(target) + '">article</a>...</p></body></html>'
  );
}

/**
 * Generate URL-safe slug from title.
 * "10 Cruise Packing Mistakes" -> "10-cruise-packing-mistakes"
 */
function slugify(title) {
  if (!title || typeof title !== 'string') return 'article';
  return title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'article';
}

/**
 * Format paragraph content (markdown-style) to HTML. Node-compatible.
 */
function formatContentToHtml(content) {
  if (!content || !content.trim()) return '';
  const lines = content.split('\n');
  const processed = [];
  let inList = false;
  let textBlock = [];

  const flushText = () => {
    if (textBlock.length === 0) return;
    const text = textBlock.join(' ').trim();
    if (text) {
      let formatted = text
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<u>$1</u>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      processed.push('<p>' + formatted + '</p>');
    }
    textBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isListItem = trimmed.startsWith('- ');

    if (isListItem) {
      flushText();
      if (!inList) processed.push('<ul>');
      inList = true;
      const itemContent = trimmed.slice(2)
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/__([^_]+)__/g, '<u>$1</u>')
        .replace(/\*([^*]+)\*/g, '<em>$1</em>');
      processed.push('<li>' + itemContent + '</li>');
    } else {
      if (inList) {
        processed.push('</ul>');
        inList = false;
      }
      if (trimmed) textBlock.push(trimmed);
      else flushText();
    }
  }
  flushText();
  if (inList) processed.push('</ul>');
  return processed.join('');
}

/**
 * Convert structuredContent (contentVersion 2) to HTML.
 * Replaces base64 image URLs with Supabase Storage URLs when possible.
 */
async function structuredContentToHtml(article) {
  const raw = article.structuredContent;
  if (!raw) return null;

  let parsed;
  try {
    parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  if (parsed?.version !== 2 || !Array.isArray(parsed.sections)) return null;

  const articleId = article.id || 'unknown';
  const parts = [];
  let imgIndex = 0;
  for (const section of parsed.sections) {
    const heading = (section.heading || '').trim();
    const level = section.headingLevel === 'h3' ? 'h3' : 'h2';
    if (heading) parts.push(`<${level}>${escapeHtml(heading)}</${level}>`);

    const blocks = section.blocks || [];
    for (const block of blocks) {
      if (block.type === 'paragraph' && block.content) {
        parts.push(formatContentToHtml(block.content));
      } else if (block.type === 'heading' && block.content) {
        parts.push('<h2>' + escapeHtml(block.content) + '</h2>');
      } else if (block.type === 'image' && block.images?.length) {
        for (const img of block.images) {
          if (img?.url) {
            const src = await resolveImageUrl(img.url, articleId, imgIndex++);
            if (!src || isSvgUrl(src)) continue;
            const alt = escapeHtml(img.alt || img.caption || section.heading || 'Article image');
            const cap = img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : '';
            parts.push(`<figure><img src="${escapeHtml(src)}" alt="${alt}" loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:12px;">${cap}</figure>`);
          }
        }
      } else if (block.type === 'table' && block.headers?.length) {
        const headers = block.headers.map(h => '<th>' + escapeHtml(h) + '</th>').join('');
        const rows = (block.rows || []).map(row =>
          '<tr>' + row.map(cell => '<td>' + escapeHtml(cell) + '</td>').join('') + '</tr>'
        ).join('');
        parts.push('<table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table>');
      } else if (block.type === 'checklist' && block.items?.length) {
        const items = block.items.filter(Boolean).map(i => '<li>' + escapeHtml(i) + '</li>').join('');
        parts.push('<ul class="checklist">' + items + '</ul>');
      } else if (block.type === 'tip' && block.text) {
        parts.push('<aside class="tip"><p>' + escapeHtml(block.text) + '</p></aside>');
      } else if ((block.type === 'callout' || block.type === 'info') && block.text) {
        parts.push('<aside class="callout"><p>' + escapeHtml(block.text) + '</p></aside>');
      }
    }
  }
  return parts.length ? parts.join('') : null;
}

/**
 * Replace base64 img src in HTML with uploaded URLs. Removes images that fail to upload.
 * Ensures loading="lazy" on all img tags.
 */
async function replaceBase64ImagesInHtml(html, articleId) {
  const regex = /<img([^>]*)\ssrc\s*=\s*["']([^"']+)["']([^>]*)>/gi;
  let match;
  const replacements = [];
  while ((match = regex.exec(html)) !== null) {
    const [full, before, rawSrc, after] = match;
    const resolved = await resolveImageUrl(rawSrc, articleId, replacements.length);
    const hasLazy = /loading\s*=\s*["']lazy["']/i.test(before + after);
    const hasDecoding = /decoding\s*=\s*["']async["']/i.test(before + after);
    const lazyAttr = hasLazy ? '' : ' loading="lazy"';
    const decodingAttr = hasDecoding ? '' : ' decoding="async"';
    if (resolved && !isSvgUrl(resolved)) {
      replacements.push({ full, replacement: `<img${before} src="${escapeHtml(resolved)}"${lazyAttr}${decodingAttr}${after}>` });
    } else {
      replacements.push({ full, replacement: '' });
    }
  }
  let result = html;
  for (const { full, replacement } of replacements) {
    result = result.replace(full, replacement);
  }
  result = result.replace(/<img(?![^>]*\bloading\s*=)([^>]*)>/gi, '<img$1 loading="lazy">');
  result = result.replace(/<img(?![^>]*\bdecoding\s*=)([^>]*)>/gi, '<img$1 decoding="async">');
  result = stripBase64FromHtml(result);
  return rewriteCdnImgSrcAttributes(result);
}

function stripBase64FromHtml(html) {
  return html.replace(/<img([^>]*)\ssrc=["']data:image\/[^"']+["']([^>]*)>/gi, '');
}

/**
 * Get article body HTML from content or structuredContent.
 * Replaces base64 images with storage URLs.
 */
async function getArticleBodyHtml(article) {
  let html = await structuredContentToHtml(article);
  if (html) {
    html = await replaceBase64ImagesInHtml(html, article.id || 'unknown');
    return html;
  }

  const content = article.content;
  if (content && typeof content === 'string' && content.trim()) {
    if (content.trim().startsWith('<')) {
      return await replaceBase64ImagesInHtml(content, article.id || 'unknown');
    }
    return rewriteCdnImgSrcAttributes(formatContentToHtml(content));
  }
  return '<p>No content available.</p>';
}

function formatDate(ts) {
  if (ts == null) return '';
  let ms = typeof ts === 'number' ? ts : (typeof ts === 'string' ? parseInt(ts, 10) : Date.parse(ts));
  if (isNaN(ms) || !Number.isFinite(ms)) return '';
  if (ms < 10000000000) ms *= 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatIsoDate(ts) {
  if (ts == null) return '';
  let ms = typeof ts === 'number' ? ts : (typeof ts === 'string' ? parseInt(ts, 10) : Date.parse(ts));
  if (isNaN(ms) || !Number.isFinite(ms)) return '';
  if (ms < 10000000000) ms *= 1000;
  const d = new Date(ms);
  if (isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function stripHtmlToPlainText(html, maxLen = 5000) {
  if (!html || typeof html !== 'string') return '';
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}

function extractKeywords(article) {
  const words = new Set();
  const add = (s) => (String(s || '').toLowerCase().match(/\b[a-z0-9]{2,}\b/g) || []).forEach((w) => words.add(w));
  add(article.title);
  add(article.excerpt);
  (article.tags || []).forEach((t) => add(typeof t === 'string' ? t : t?.name));
  (article.keywords || []).forEach(add);
  return words;
}

function findRelatedArticles(article, allArticles, excludeIds, maxCount = 4) {
  const aWords = extractKeywords(article);
  const scored = allArticles
    .filter((a) => a.id !== article.id && !excludeIds.has(a.id))
    .map((a) => {
      const bWords = extractKeywords(a);
      let score = 0;
      aWords.forEach((w) => { if (bWords.has(w)) score++; });
      return { article: a, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxCount)
    .map((x) => x.article);
  return scored;
}

function findSameTagArticles(article, allArticles, maxCount = 5) {
  const tags = (article.tags || [])
    .map((t) => (typeof t === 'string' ? t.toLowerCase() : String(t?.name || '').toLowerCase()))
    .filter(Boolean);
  if (!tags.length) return [];
  return allArticles
    .filter((a) => {
      if (a.id === article.id) return false;
      const atags = (a.tags || []).map((t) => (typeof t === 'string' ? t.toLowerCase() : String(t?.name || '').toLowerCase()));
      return atags.some((t) => tags.includes(t));
    })
    .slice(0, maxCount);
}

function buildExploreSeaDaysSection() {
  return (
    '<section class="explore-seadays" aria-labelledby="explore-seadays-h">' +
    '<h2 id="explore-seadays-h">Explore more on SeaDays</h2>' +
    '<ul class="explore-seadays-list">' +
    '<li><a href="/blog/" class="explore-seadays-link">SeaDays blog — cruise tips &amp; guides</a></li>' +
    '<li><a href="/ships/" class="explore-seadays-link">Cruise ships — browse lines &amp; classes</a></li>' +
    '<li><a href="/ports/" class="explore-seadays-link">Ports &amp; destinations — plan your itinerary</a></li>' +
    '</ul></section>'
  );
}

function buildSameTopicSection(article, sameTagArticles) {
  if (!sameTagArticles.length) return '';
  const items = sameTagArticles
    .map(
      (a) =>
        `<li><a href="${blogRelPath(a.slug)}" class="contextual-link">${escapeHtml(a.title || 'Article')}</a></li>`
    )
    .join('');
  return (
    '<section class="same-topic-section" aria-labelledby="same-topic-h">' +
    '<h2 id="same-topic-h">More on this topic</h2>' +
    '<ul class="same-topic-list">' +
    items +
    '</ul></section>'
  );
}

function selectMoreToReadArticles(article, articles, maxCount = 12) {
  const exclude = new Set([article.id]);
  const scored = findRelatedArticles(article, articles, exclude, Math.max(8, maxCount));
  scored.forEach((a) => exclude.add(a.id));
  const merged = [...scored];
  for (const a of articles) {
    if (merged.length >= maxCount) break;
    if (exclude.has(a.id)) continue;
    merged.push(a);
    exclude.add(a.id);
  }
  return merged.slice(0, maxCount);
}

function injectContextualLinks(bodyHtml, relatedArticles, maxLinks = 4) {
  if (!relatedArticles.length || !bodyHtml) return bodyHtml;
  const links = relatedArticles.slice(0, maxLinks).map(
    (a) => `<a href="${blogRelPath(a.slug)}" class="contextual-link">${escapeHtml(a.title || 'Read more')}</a>`
  );
  const linkBlock = `<p class="related-inline">Related: ${links.join(' · ')}</p>`;
  const re = /(<\/p>\s*)/gi;
  let count = 0;
  const newBody = bodyHtml.replace(re, (match) => {
    count++;
    return count === 2 ? match + linkBlock : match;
  });
  return newBody !== bodyHtml ? newBody : bodyHtml + linkBlock;
}

// ---------------------------------------------------------------------------
// HTTP
// ---------------------------------------------------------------------------

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
  });
}

function httpsPostJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const u = new URL(url);
    const opts = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        ...headers,
      },
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(20000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(payload);
    req.end();
  });
}

/** Edge function accepts up to 50 ids per POST (see make-server-51d3ca8d portside-articles/thumbnails). */
const PORTSIDE_THUMBNAIL_POST_BATCH = 50;

/**
 * After GET forWebsite summaries, fill missing thumbnail/hero from POST /portside-articles/thumbnails
 * (same resolution path as the app). Non-fatal on failure.
 */
async function mergePortsideThumbnailsIntoArticles(articles) {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key || !articles.length) return articles;
  const hasRealImage = (url) => {
    const s = String(url || '').trim();
    return s.length > 0 && !isGradientSvgDataUrl(s);
  };
  const idsNeeding = articles
    .filter((a) => a && a.id && !hasRealImage(a.thumbnailUrl) && !hasRealImage(a.heroImageUrl))
    .map((a) => a.id);
  if (idsNeeding.length === 0) return articles;

  const byId = new Map(articles.map((a) => [a.id, a]));
  const thumbUrl = EDGE_BASE + '/portside-articles/thumbnails';
  for (let i = 0; i < idsNeeding.length; i += PORTSIDE_THUMBNAIL_POST_BATCH) {
    const batch = idsNeeding.slice(i, i + PORTSIDE_THUMBNAIL_POST_BATCH);
    try {
      const data = await httpsPostJson(thumbUrl, { ids: batch }, {
        Authorization: 'Bearer ' + key,
        apikey: key,
      });
      const thumbs = Array.isArray(data?.thumbnails) ? data.thumbnails : [];
      for (const row of thumbs) {
        if (!row || !row.id) continue;
        const art = byId.get(row.id);
        if (!art) continue;
        const thumb = typeof row.thumbnailUrl === 'string' && row.thumbnailUrl.trim() ? row.thumbnailUrl.trim() : '';
        const hero = typeof row.heroImageUrl === 'string' && row.heroImageUrl.trim() ? row.heroImageUrl.trim() : '';
        if (thumb) art.thumbnailUrl = thumb;
        if (hero) art.heroImageUrl = hero;
      }
    } catch (err) {
      console.warn('[generateBlogs] thumbnails POST batch failed:', err?.message || err);
    }
  }
  return articles;
}

async function fetchArticles() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.warn('SUPABASE_ANON_KEY not set. Cannot fetch articles.');
    return { articles: [] };
  }
  const url = EDGE_BASE + '/portside-articles?limit=500&forWebsite=1';
  const data = await httpsGet(url, {
    Authorization: 'Bearer ' + key,
    apikey: key,
  });
  return data;
}

async function fetchFullArticle(articleId) {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) return null;
  const url = EDGE_BASE + '/portside-articles/' + encodeURIComponent(articleId);
  try {
    const data = await httpsGet(url, {
      Authorization: 'Bearer ' + key,
      apikey: key,
    });
    return data?.article || null;
  } catch {
    return null;
  }
}

let reviewsShipsPortsCache = null;
async function fetchReviewsShipsPorts() {
  if (reviewsShipsPortsCache) return reviewsShipsPortsCache;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    reviewsShipsPortsCache = { ships: [], ports: [] };
    return reviewsShipsPortsCache;
  }
  try {
    const [shipsRes, portsRes] = await Promise.all([
      httpsGet(EDGE_BASE + '/reviews/ships', { Authorization: 'Bearer ' + key, apikey: key }),
      httpsGet(EDGE_BASE + '/reviews/ports', { Authorization: 'Bearer ' + key, apikey: key }),
    ]);
    reviewsShipsPortsCache = {
      ships: Array.isArray(shipsRes.ships) ? shipsRes.ships : [],
      ports: Array.isArray(portsRes.ports) ? portsRes.ports : [],
    };
    return reviewsShipsPortsCache;
  } catch (e) {
    console.warn('[generateBlogs] ships/ports API:', e?.message || e);
    reviewsShipsPortsCache = { ships: [], ports: [] };
    return reviewsShipsPortsCache;
  }
}

function buildDirectoryHeaderNav() {
  return `<nav class="header-nav">
        <a href="/index.html">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>`;
}

function buildShipsIndexHtml({ ships, articles, featuredGuideCardsHtml }) {
  const canonical = `${BASE_URL}/ships/`;
  const title = 'Cruise Ships Directory | SeaDays';
  const desc =
    'Browse major cruise ships and lines featured in SeaDays. Compare classes, plan sailings, and jump into the mobile app for live ship data, reviews, and itineraries.';

  const safeShips = Array.isArray(ships) ? ships : [];
  const safeArticles = Array.isArray(articles) ? articles : [];

  const formatRating = (rating) => {
    const n = typeof rating === 'number' ? rating : Number(String(rating || '').trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return (Math.round(n * 10) / 10).toFixed(1);
  };

  const normalizeKey = (value) => String(value || '').trim();

  const lineGroups = new Map();
  for (const ship of safeShips) {
    const line = normalizeKey(ship.cruise_line);
    if (!line) continue;
    if (!lineGroups.has(line)) lineGroups.set(line, []);
    lineGroups.get(line).push(ship);
  }

  const linePills = [...lineGroups.entries()]
    .map(([line, list]) => {
      const score = list.reduce((sum, s) => sum + (Number.isFinite(s.reviewCount) ? s.reviewCount : 0), 0);
      return { line, score, count: list.length };
    })
    .sort((a, b) => (b.score - a.score) || (b.count - a.count) || a.line.localeCompare(b.line));

  const safeFeaturedGuideCardsHtml = typeof featuredGuideCardsHtml === 'string' ? featuredGuideCardsHtml : '';

  const cards = safeShips
    .slice()
    .sort((a, b) => {
      const la = normalizeKey(a.cruise_line).toLowerCase();
      const lb = normalizeKey(b.cruise_line).toLowerCase();
      if (la !== lb) return la.localeCompare(lb);
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((ship) => {
      const line = normalizeKey(ship.cruise_line);
      const rating = formatRating(ship.rating);
      const ratingHtml = rating
        ? `<span class="rating-pill" aria-label="Rating ${rating} out of 5">${rating} <span aria-hidden="true">★</span></span>`
        : `<span class="rating-pill rating-pill-muted">In-app rating</span>`;
      return (
        `<a href="/ships/${escapeHtml(ship.slug)}/" class="seo-grid-card directory-card" ` +
        `data-group="${escapeHtml(line)}" data-item="${escapeHtml(ship.slug)}">` +
        `<span class="seo-grid-card-title">${escapeHtml(ship.name)}</span>` +
        `<span class="seo-grid-card-meta">${escapeHtml(line || 'Cruise line')}</span>` +
        `<span class="seo-grid-card-bottom">` +
        ratingHtml +
        `<span class="seo-grid-card-hint">Open guide</span>` +
        `</span>` +
        `</a>`
      );
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${escapeHtml(desc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${DEFAULT_FAVICON}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(desc)}">
  <meta property="twitter:image" content="${DEFAULT_FAVICON}">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cruise ships',
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: BASE_URL + '/' },
  })}</script>
  <style>${INDEX_STYLES}
.seo-prose { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.75; }
.seo-prose h2 { font-size: 26px; margin: 32px 0 16px; font-weight: 800; color: #fff; }
.seo-prose p { margin-bottom: 18px; }
.seo-prose a { color: var(--neon-red); text-decoration: none; font-weight: 600; }
.seo-prose a:hover { text-decoration: underline; }
.directory-hero { max-width: 1200px; margin: 0 auto; padding: 140px 20px 36px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center; }
.directory-hero h1 { font-size: 56px; font-weight: 900; letter-spacing: -1px; line-height: 1.06; margin-bottom: 14px; }
.directory-hero p { font-size: 18px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 16px; }
.directory-cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.directory-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; }
.directory-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); transform: translateY(-1px); }
.directory-btn-primary { background: rgba(255,0,51,0.18); border-color: rgba(255,0,51,0.4); }
.directory-hero-art { border-radius: 22px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,0.4); position: relative; }
.directory-hero-art::after { content: ''; position: absolute; inset: -80px -120px auto auto; width: 240px; height: 240px; background: radial-gradient(circle at center, rgba(255,0,51,0.35), rgba(255,0,51,0)); filter: blur(4px); pointer-events: none; }
.directory-hero-art img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; }
.directory-controls { max-width: 1200px; margin: 0 auto; padding: 0 20px 18px; }
.pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
.pill { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
.pill:hover { border-color: rgba(255,0,51,0.55); }
.pill[aria-pressed=\"true\"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.16); }
.subpill-wrap { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
.subpill-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); margin-bottom: 10px; }
.seo-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 0 20px 100px; max-width: 1200px; margin: 0 auto; }
.seo-grid-card { display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.seo-grid-card:hover { border-color: var(--neon-red); transform: translateY(-2px); }
.seo-grid-card-title { font-weight: 700; font-size: 16px; }
.seo-grid-card-hint { font-size: 12px; color: rgba(255,255,255,0.45); }
.seo-grid-card-meta { font-size: 13px; color: rgba(255,255,255,0.55); }
.seo-grid-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.rating-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); }
.rating-pill-muted { color: rgba(255,255,255,0.6); font-weight: 700; }
.directory-card.is-hidden { display: none; }
.featured-guides { max-width: 1200px; margin: 0 auto 20px; padding: 0 20px; }
.featured-guides h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 8px 0 12px; }
.featured-guides-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.guide-card { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.guide-card:hover { border-color: var(--neon-red); transform: translateY(-2px); }
.guide-card-image { width: 100%; height: 150px; object-fit: cover; object-position: center; background: rgba(255,255,255,0.05); display: block; }
.guide-card-body { padding: 12px 14px 14px; }
.guide-card-title { font-size: 14px; font-weight: 800; line-height: 1.25; letter-spacing: -0.2px; margin: 0; }
.guide-card-meta { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.55); }
.app-cta { max-width: 1200px; margin: 0 auto 26px; padding: 0 20px; }
.app-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,0,51,0.06); }
.app-cta strong { display: block; font-size: 15px; }
.app-cta span { display: block; font-size: 13px; color: rgba(255,255,255,0.68); margin-top: 2px; }
.app-cta a { flex: 0 0 auto; }
.header { position: sticky; top: 0; background: rgba(10,10,10,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); }
@media (max-width: 900px) {
  .directory-hero { grid-template-columns: 1fr; padding-top: 120px; }
  .directory-hero h1 { font-size: 38px; }
  .featured-guides-grid { grid-template-columns: 1fr; }
  .app-cta-inner { flex-direction: column; align-items: flex-start; }
}
</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">${buildDirectoryHeaderNav()}</header>
    <section class="directory-hero" aria-labelledby="ships-title">
      <div class="directory-hero-copy">
        <h1 id="ships-title">Cruise ships</h1>
        <p>Pick a cruise line, then narrow down to the ships cruisers care about. Ratings are visible here—full reviews live in the SeaDays app.</p>
        <div class="directory-cta-row">
          <a class="directory-btn directory-btn-primary" href="/index.html#download">Download SeaDays</a>
          <a class="directory-btn" href="/blog/">Read cruise guides</a>
        </div>
      </div>
      <div class="directory-hero-art" aria-hidden="true">
        <img src="https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Discover%20Ships%20%20Ports.jpg" alt="" loading="lazy" decoding="async">
      </div>
    </section>
    <section class="directory-controls" aria-label="Filters">
      <div class="pill-row" id="primaryPills" role="tablist" aria-label="Cruise lines">
        <button type="button" class="pill" data-primary="__all__" aria-pressed="true">All lines</button>
        ${linePills
          .map((x) => `<button type="button" class="pill" data-primary="${escapeHtml(x.line)}" aria-pressed="false">${escapeHtml(x.line)}</button>`)
          .join('')}
      </div>
      <div class="subpill-wrap" id="subpillWrap" style="display:none;">
        <div class="subpill-label" id="subpillLabel">Ships in this line</div>
        <div class="pill-row" id="secondaryPills" role="tablist" aria-label="Ships"></div>
      </div>
    </section>
    <div class="seo-directory-grid" id="directoryGrid">${cards}</div>
    <section class="app-cta" aria-label="App call to action">
      <div class="app-cta-inner">
        <div>
          <strong>Want the full reviews?</strong>
          <span>Download SeaDays to read and leave reviews for ships and ports.</span>
        </div>
        <a class="directory-btn directory-btn-primary" href="/index.html#download">Get the app</a>
      </div>
    </section>
    <section class="featured-guides" aria-label="Popular cruise guides">
      <h2>Popular comparisons &amp; guides</h2>
      <div class="featured-guides-grid">${safeFeaturedGuideCardsHtml || `<a class="guide-card" href="/blog/"><div class="guide-card-body"><p class="guide-card-title">SeaDays cruise blog</p><p class="guide-card-meta">Browse comparisons, tips, and planning guides</p></div></a>`}</div>
    </section>
    <article class="seo-prose">
      <h2>Why a ships hub matters for cruise planning</h2>
      <p>Choosing a cruise is rarely only about price. The ship shapes daily life at sea: dining venues, cabin categories, entertainment, kids clubs, and how crowded common spaces feel. SeaDays brings structured ship and line information together so you can compare options without losing the story of what makes each vessel different.</p>
      <p>Whether you are evaluating <a href="/blog/">Royal Caribbean versus MSC</a> for a family sailing, or researching <a href="/ports/">Mediterranean embarkation ports</a> before you lock flights, starting from the ship helps you align nights at sea with the regions you want to explore.</p>
      <h2>How to use this directory</h2>
      <p>Each card links to a static ship guide you can bookmark or share. For deck plans, live ship data, and community reviews, open the SeaDays app—download from the homepage and sign in to sync your preferences across devices.</p>
      <p>For itinerary inspiration, pair this list with our <a href="/blog/">cruise blog</a> and the <a href="/ports/">ports directory</a> to sketch sea days, port days, and pre- or post-cruise stays.</p>
    </article>
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section"><h4>Product</h4><ul><li><a href="/index.html#download">Download</a></li></ul></div>
          <div class="footer-section"><h4>Guides</h4><ul><li><a href="/blog/">Blog</a></li><li><a href="/ports/">Ports</a></li></ul></div>
          <div class="footer-section"><h4>Legal</h4><ul><li><a href="https://seadays.app/privacy.html">Privacy</a></li><li><a href="https://seadays.app/terms.html">Terms</a></li></ul></div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 SeaDays. All rights reserved.</p></div>
      </div>
    </footer>
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  <script>
  (function(){
    var primary = document.getElementById('primaryPills')
    var secondary = document.getElementById('secondaryPills')
    var subWrap = document.getElementById('subpillWrap')
    var grid = document.getElementById('directoryGrid')
    if(!primary || !secondary || !subWrap || !grid) return

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.directory-card'))
    function setPressed(container, activeValue){
      Array.prototype.slice.call(container.querySelectorAll('button.pill')).forEach(function(btn){
        var v = btn.getAttribute('data-primary') || btn.getAttribute('data-secondary')
        btn.setAttribute('aria-pressed', String(v === activeValue))
      })
    }
    function clearSecondary(){
      secondary.innerHTML = ''
      subWrap.style.display = 'none'
    }
    function applyFilter(primaryValue, secondaryValue){
      cards.forEach(function(card){
        var group = card.getAttribute('data-group') || ''
        var item = card.getAttribute('data-item') || ''
        var ok = true
        if(primaryValue && primaryValue !== '__all__') ok = ok && group === primaryValue
        if(secondaryValue && secondaryValue !== '__all__') ok = ok && item === secondaryValue
        if(ok) card.classList.remove('is-hidden')
        else card.classList.add('is-hidden')
      })
    }
    function buildSecondaryForGroup(group){
      clearSecondary()
      if(!group || group === '__all__') return
      var groupCards = cards.filter(function(c){ return (c.getAttribute('data-group')||'') === group })
      if(groupCards.length <= 1) return
      subWrap.style.display = 'block'
      var btnAll = document.createElement('button')
      btnAll.type = 'button'
      btnAll.className = 'pill'
      btnAll.setAttribute('data-secondary','__all__')
      btnAll.setAttribute('aria-pressed','true')
      btnAll.textContent = 'All ships'
      secondary.appendChild(btnAll)
      groupCards.forEach(function(c){
        var slug = c.getAttribute('data-item')
        var titleEl = c.querySelector('.seo-grid-card-title')
        var label = titleEl ? titleEl.textContent.trim() : slug
        var b = document.createElement('button')
        b.type = 'button'
        b.className = 'pill'
        b.setAttribute('data-secondary', slug)
        b.setAttribute('aria-pressed', 'false')
        b.textContent = label
        secondary.appendChild(b)
      })
    }

    primary.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-primary]')
      if(!btn) return
      var group = btn.getAttribute('data-primary')
      setPressed(primary, group)
      buildSecondaryForGroup(group)
      applyFilter(group, '__all__')
    })

    secondary.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-secondary]')
      if(!btn) return
      var groupBtn = primary.querySelector('button[aria-pressed=\"true\"]')
      var group = groupBtn ? groupBtn.getAttribute('data-primary') : '__all__'
      var item = btn.getAttribute('data-secondary')
      setPressed(secondary, item)
      applyFilter(group, item)
    })
  })();
  </script>
  ${RUNTIME_GUARD_SCRIPT}
</body>
</html>`;
}

function buildPortsIndexHtml({ ports, articles, featuredGuideCardsHtml }) {
  const canonical = `${BASE_URL}/ports/`;
  const title = 'Cruise Ports & Destinations | SeaDays';
  const desc =
    'Explore cruise ports and regions: embarkation cities, popular islands, and signature itineraries. Plan shore days and pair them with SeaDays ship tools in the app.';

  const safePorts = Array.isArray(ports) ? ports : [];
  const safeArticles = Array.isArray(articles) ? articles : [];

  const formatRating = (rating) => {
    const n = typeof rating === 'number' ? rating : Number(String(rating || '').trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return (Math.round(n * 10) / 10).toFixed(1);
  };

  const normalizeKey = (value) => String(value || '').trim();

  const regionGroups = new Map();
  for (const port of safePorts) {
    const region = normalizeKey(port.region) || 'Other';
    if (!regionGroups.has(region)) regionGroups.set(region, []);
    regionGroups.get(region).push(port);
  }

  const regionPills = [...regionGroups.entries()]
    .map(([region, list]) => ({ region, count: list.length }))
    .sort((a, b) => (b.count - a.count) || a.region.localeCompare(b.region));

  const safeFeaturedGuideCardsHtml = typeof featuredGuideCardsHtml === 'string' ? featuredGuideCardsHtml : '';

  const cards = safePorts
    .slice()
    .sort((a, b) => {
      const ra = normalizeKey(a.region).toLowerCase();
      const rb = normalizeKey(b.region).toLowerCase();
      if (ra !== rb) return ra.localeCompare(rb);
      const ca = normalizeKey(a.country).toLowerCase();
      const cb = normalizeKey(b.country).toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return String(a.name || '').localeCompare(String(b.name || ''));
    })
    .map((port) => {
      const region = normalizeKey(port.region) || 'Other';
      const label = port.country ? `${port.name}, ${port.country}` : port.name;
      const rating = formatRating(port.rating);
      const ratingHtml = rating
        ? `<span class="rating-pill" aria-label="Rating ${rating} out of 5">${rating} <span aria-hidden="true">★</span></span>`
        : `<span class="rating-pill rating-pill-muted">In-app rating</span>`;
      return (
        `<a href="/ports/${escapeHtml(port.slug)}/" class="seo-grid-card directory-card" ` +
        `data-group="${escapeHtml(region)}" data-item="${escapeHtml(port.slug)}">` +
        `<span class="seo-grid-card-title">${escapeHtml(label)}</span>` +
        `<span class="seo-grid-card-meta">${escapeHtml(region)}</span>` +
        `<span class="seo-grid-card-bottom">` +
        ratingHtml +
        `<span class="seo-grid-card-hint">Open guide</span>` +
        `</span>` +
        `</a>`
      );
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${escapeHtml(desc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${DEFAULT_FAVICON}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(desc)}">
  <meta property="twitter:image" content="${DEFAULT_FAVICON}">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cruise ports and destinations',
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: BASE_URL + '/' },
  })}</script>
  <style>${INDEX_STYLES}
.seo-prose { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.75; }
.seo-prose h2 { font-size: 26px; margin: 32px 0 16px; font-weight: 800; color: #fff; }
.seo-prose p { margin-bottom: 18px; }
.seo-prose a { color: var(--neon-red); text-decoration: none; font-weight: 600; }
.seo-prose a:hover { text-decoration: underline; }
.directory-hero { max-width: 1200px; margin: 0 auto; padding: 140px 20px 36px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center; }
.directory-hero h1 { font-size: 56px; font-weight: 900; letter-spacing: -1px; line-height: 1.06; margin-bottom: 14px; }
.directory-hero p { font-size: 18px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 16px; }
.directory-cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.directory-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; }
.directory-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); transform: translateY(-1px); }
.directory-btn-primary { background: rgba(255,0,51,0.18); border-color: rgba(255,0,51,0.4); }
.directory-hero-art { border-radius: 22px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,0.4); position: relative; }
.directory-hero-art::after { content: ''; position: absolute; inset: -80px -120px auto auto; width: 240px; height: 240px; background: radial-gradient(circle at center, rgba(6,182,212,0.32), rgba(6,182,212,0)); filter: blur(4px); pointer-events: none; }
.directory-hero-art img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; }
.directory-controls { max-width: 1200px; margin: 0 auto; padding: 0 20px 18px; }
.pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
.pill { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
.pill:hover { border-color: rgba(6,182,212,0.55); }
.pill[aria-pressed=\"true\"] { border-color: rgba(6,182,212,0.85); background: rgba(6,182,212,0.16); }
.subpill-wrap { margin-top: 14px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.07); }
.subpill-label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: rgba(255,255,255,0.5); margin-bottom: 10px; }
.seo-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 0 20px 100px; max-width: 1200px; margin: 0 auto; }
.seo-grid-card { display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.seo-grid-card:hover { border-color: var(--neon-red); transform: translateY(-2px); }
.seo-grid-card-title { font-weight: 700; font-size: 16px; }
.seo-grid-card-hint { font-size: 12px; color: rgba(255,255,255,0.45); }
.seo-grid-card-meta { font-size: 13px; color: rgba(255,255,255,0.55); }
.seo-grid-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.rating-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); }
.rating-pill-muted { color: rgba(255,255,255,0.6); font-weight: 700; }
.directory-card.is-hidden { display: none; }
.featured-guides { max-width: 1200px; margin: 0 auto 20px; padding: 0 20px; }
.featured-guides h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 8px 0 12px; }
.featured-guides-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.guide-card { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.guide-card:hover { border-color: rgba(6,182,212,0.85); transform: translateY(-2px); }
.guide-card-image { width: 100%; height: 150px; object-fit: cover; object-position: center; background: rgba(255,255,255,0.05); display: block; }
.guide-card-body { padding: 12px 14px 14px; }
.guide-card-title { font-size: 14px; font-weight: 800; line-height: 1.25; letter-spacing: -0.2px; margin: 0; }
.guide-card-meta { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.55); }
.app-cta { max-width: 1200px; margin: 0 auto 26px; padding: 0 20px; }
.app-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(6,182,212,0.06); }
.app-cta strong { display: block; font-size: 15px; }
.app-cta span { display: block; font-size: 13px; color: rgba(255,255,255,0.68); margin-top: 2px; }
.app-cta a { flex: 0 0 auto; }
.header { position: sticky; top: 0; background: rgba(10,10,10,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); }
@media (max-width: 900px) {
  .directory-hero { grid-template-columns: 1fr; padding-top: 120px; }
  .directory-hero h1 { font-size: 38px; }
  .featured-guides-grid { grid-template-columns: 1fr; }
  .app-cta-inner { flex-direction: column; align-items: flex-start; }
}
</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">${buildDirectoryHeaderNav()}</header>
    <section class="directory-hero" aria-labelledby="ports-title">
      <div class="directory-hero-copy">
        <h1 id="ports-title">Cruise ports &amp; destinations</h1>
        <p>Choose a region first, then jump into port guides you can bookmark. Ratings are visible here—full reviews live in the SeaDays app.</p>
        <div class="directory-cta-row">
          <a class="directory-btn directory-btn-primary" href="/index.html#download">Download SeaDays</a>
          <a class="directory-btn" href="/blog/">Read destination guides</a>
        </div>
      </div>
      <div class="directory-hero-art" aria-hidden="true">
        <img src="https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20planner.jpg" alt="" loading="lazy" decoding="async">
      </div>
    </section>
    <section class="directory-controls" aria-label="Filters">
      <div class="pill-row" id="primaryPills" role="tablist" aria-label="Regions">
        <button type="button" class="pill" data-primary="__all__" aria-pressed="true">All regions</button>
        ${regionPills
          .map((x) => `<button type="button" class="pill" data-primary="${escapeHtml(x.region)}" aria-pressed="false">${escapeHtml(x.region)}</button>`)
          .join('')}
      </div>
      <div class="subpill-wrap" id="subpillWrap" style="display:none;">
        <div class="subpill-label" id="subpillLabel">Ports in this region</div>
        <div class="pill-row" id="secondaryPills" role="tablist" aria-label="Ports"></div>
      </div>
    </section>
    <div class="seo-directory-grid" id="directoryGrid">${cards}</div>
    <section class="app-cta" aria-label="App call to action">
      <div class="app-cta-inner">
        <div>
          <strong>Want the full reviews?</strong>
          <span>Download SeaDays to read and leave reviews for ports and ships.</span>
        </div>
        <a class="directory-btn directory-btn-primary" href="/index.html#download">Get the app</a>
      </div>
    </section>
    <section class="featured-guides" aria-label="Popular destination guides">
      <h2>Popular destination guides</h2>
      <div class="featured-guides-grid">${safeFeaturedGuideCardsHtml || `<a class="guide-card" href="/blog/"><div class="guide-card-body"><p class="guide-card-title">SeaDays cruise blog</p><p class="guide-card-meta">Browse destination guides and shore-day tips</p></div></a>`}</div>
    </section>
    <article class="seo-prose">
      <h2>Plan smarter shore days</h2>
      <p>Ports are where itineraries become real: timing, walk-off convenience, excursion windows, and how far you can roam before all-aboard. A strong plan balances must-see sights with buffer for weather, traffic, and the simple joy of wandering.</p>
      <p>SeaDays connects <a href="/ships/">ship choice</a> with <a href="/blog/">destination guides from our blog</a> so you can line up sea days, overnight stays, and back-to-back sea-and-port rhythms that match your travel style.</p>
      <h2>Regions and gateway cities</h2>
      <p>Use the grid below as a lightweight map of places SeaDays users explore often. Each link opens a static port guide; terminals, safety notes, and fresher crowd patterns load in the SeaDays app.</p>
      <p>When you are ready to compare vessels for these regions, return to the <a href="/ships/">ships directory</a> and cross-check cabins, dining, and entertainment before you commit.</p>
    </article>
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section"><h4>Product</h4><ul><li><a href="/index.html#download">Download</a></li></ul></div>
          <div class="footer-section"><h4>Guides</h4><ul><li><a href="/blog/">Blog</a></li><li><a href="/ships/">Ships</a></li></ul></div>
          <div class="footer-section"><h4>Legal</h4><ul><li><a href="https://seadays.app/privacy.html">Privacy</a></li><li><a href="https://seadays.app/terms.html">Terms</a></li></ul></div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 SeaDays. All rights reserved.</p></div>
      </div>
    </footer>
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  <script>
  (function(){
    var primary = document.getElementById('primaryPills')
    var secondary = document.getElementById('secondaryPills')
    var subWrap = document.getElementById('subpillWrap')
    var grid = document.getElementById('directoryGrid')
    if(!primary || !secondary || !subWrap || !grid) return

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.directory-card'))
    function cssEscape(v){
      try { return (window.CSS && window.CSS.escape) ? window.CSS.escape(v) : v.replace(/[^a-zA-Z0-9_-]/g, '\\\\$&') } catch { return v }
    }
    function setPressed(container, activeValue){
      Array.prototype.slice.call(container.querySelectorAll('button.pill')).forEach(function(btn){
        var v = btn.getAttribute('data-primary') || btn.getAttribute('data-secondary')
        btn.setAttribute('aria-pressed', String(v === activeValue))
      })
    }
    function clearSecondary(){
      secondary.innerHTML = ''
      subWrap.style.display = 'none'
    }
    function applyFilter(primaryValue, secondaryValue){
      cards.forEach(function(card){
        var group = card.getAttribute('data-group') || ''
        var item = card.getAttribute('data-item') || ''
        var ok = true
        if(primaryValue && primaryValue !== '__all__') ok = ok && group === primaryValue
        if(secondaryValue && secondaryValue !== '__all__') ok = ok && item === secondaryValue
        if(ok) card.classList.remove('is-hidden')
        else card.classList.add('is-hidden')
      })
    }
    function buildSecondaryForGroup(group){
      clearSecondary()
      if(!group || group === '__all__') return
      var groupCards = cards.filter(function(c){ return (c.getAttribute('data-group')||'') === group })
      if(groupCards.length <= 1) return
      subWrap.style.display = 'block'
      var btnAll = document.createElement('button')
      btnAll.type = 'button'
      btnAll.className = 'pill'
      btnAll.setAttribute('data-secondary','__all__')
      btnAll.setAttribute('aria-pressed','true')
      btnAll.textContent = 'All ports'
      secondary.appendChild(btnAll)
      groupCards.forEach(function(c){
        var slug = c.getAttribute('data-item')
        var titleEl = c.querySelector('.seo-grid-card-title')
        var label = titleEl ? titleEl.textContent.trim() : slug
        var b = document.createElement('button')
        b.type = 'button'
        b.className = 'pill'
        b.setAttribute('data-secondary', slug)
        b.setAttribute('aria-pressed', 'false')
        b.textContent = label
        secondary.appendChild(b)
      })
    }

    primary.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-primary]')
      if(!btn) return
      var group = btn.getAttribute('data-primary')
      setPressed(primary, group)
      buildSecondaryForGroup(group)
      applyFilter(group, '__all__')
    })

    secondary.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-secondary]')
      if(!btn) return
      var groupBtn = primary.querySelector('button[aria-pressed=\"true\"]')
      var group = groupBtn ? groupBtn.getAttribute('data-primary') : '__all__'
      var item = btn.getAttribute('data-secondary')
      setPressed(secondary, item)
      applyFilter(group, item)
    })
  })();
  </script>
  ${RUNTIME_GUARD_SCRIPT}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Templates (inline to avoid extra files; matches blog-article.html design)
// ---------------------------------------------------------------------------

const ARTICLE_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --dark-bg: #0a0a0a; --neon-red: #FF0033; }
html { scroll-behavior: smooth; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--dark-bg); color: white; line-height: 1.6; overflow-x: hidden; }
.starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); overflow: hidden; }
.star { position: absolute; width: 2px; height: 2px; background: rgba(255,255,255,0.5); border-radius: 50%; animation: twinkle 3s infinite ease-in-out; }
@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
.grid-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background-image: linear-gradient(rgba(255, 0, 51, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 0, 51, 0.02) 1px, transparent 1px); background-size: 100px 100px; opacity: 0.4; pointer-events: none; }
.content-layer { position: relative; z-index: 10; }
.header { position: sticky; top: 0; padding: 20px 40px; display: flex; justify-content: flex-end; align-items: center; z-index: 100; background: rgba(10, 10, 10, 0.9); border-bottom: 1px solid rgba(255, 255, 255, 0.05); }
.header-nav { display: flex; gap: 30px; align-items: center; }
.header-nav a { color: rgba(255, 255, 255, 0.7); text-decoration: none; font-weight: 500; font-size: 15px; }
.header-nav a:hover { color: white; }
.container { max-width: 800px; margin: 0 auto; padding: 0 20px; }
.article-hero { padding: 60px 20px 40px; }
.article-hero h1 { font-size: 42px; font-weight: 900; margin-bottom: 20px; letter-spacing: -0.5px; line-height: 1.2; }
.article-meta { display: flex; align-items: center; gap: 16px; font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 32px; }
.article-meta .author { color: rgba(255, 255, 255, 0.8); }
.article-hero-image { width: 100%; max-height: 400px; object-fit: cover; object-position: top center; border-radius: 16px; margin-bottom: 40px; background: rgba(255, 255, 255, 0.05); }
.article-body { font-size: 18px; line-height: 1.75; color: rgba(255, 255, 255, 0.9); padding-bottom: 48px; }
.article-body h2 { font-size: 28px; margin: 40px 0 16px; font-weight: 700; }
.article-body h3 { font-size: 22px; margin: 32px 0 12px; font-weight: 600; }
.article-body p { margin-bottom: 20px; }
.article-body ul, .article-body ol { margin: 16px 0 20px 24px; }
.article-body li { margin-bottom: 8px; }
.article-body img { max-width: 100%; height: auto; border-radius: 12px; margin: 20px 0; }
.article-body figure { margin: 20px 0; }
.article-body figure img { margin: 0; }
.article-body table { width: 100%; border-collapse: collapse; margin: 20px 0; }
.article-body th, .article-body td { padding: 12px; text-align: left; border: 1px solid rgba(255,255,255,0.2); }
.article-body aside { margin: 24px 0; padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.1); }
.article-body .related-inline { font-size: 0.95em; color: rgba(255,255,255,0.7); margin: 24px 0; }
.article-body .contextual-link { color: var(--neon-red); text-decoration: none; }
.article-body .contextual-link:hover { text-decoration: underline; }
.explore-seadays { margin: 40px 0; padding: 28px 24px; border-radius: 16px; border: 1px solid rgba(255, 255, 255, 0.1); background: rgba(255, 0, 51, 0.06); }
.explore-seadays h2 { font-size: 22px; margin-bottom: 16px; font-weight: 800; }
.explore-seadays-list { list-style: none; margin: 0; padding: 0; }
.explore-seadays-list li { margin: 12px 0; }
.explore-seadays-link { color: var(--neon-red); text-decoration: none; font-weight: 600; font-size: 16px; }
.explore-seadays-link:hover { text-decoration: underline; }
.same-topic-section { margin: 36px 0; padding: 24px 0; border-top: 1px solid rgba(255, 255, 255, 0.08); }
.same-topic-section h2 { font-size: 20px; margin-bottom: 12px; font-weight: 700; }
.same-topic-list { margin: 0; padding-left: 20px; color: rgba(255, 255, 255, 0.85); }
.same-topic-list li { margin: 8px 0; }
.article-nav { display: flex; justify-content: space-between; align-items: center; gap: 20px; padding: 32px 0; border-top: 1px solid rgba(255, 255, 255, 0.08); border-bottom: 1px solid rgba(255, 255, 255, 0.08); margin-bottom: 48px; }
.article-nav a { display: inline-flex; align-items: center; gap: 8px; color: var(--neon-red); text-decoration: none; font-weight: 600; font-size: 15px; max-width: 45%; }
.article-nav a:hover { text-decoration: underline; }
.article-nav a.article-nav-next { margin-left: auto; text-align: right; flex-direction: row-reverse; }
.article-nav a.article-nav-prev { margin-right: auto; }
.article-nav-label { font-size: 12px; color: rgba(255, 255, 255, 0.5); font-weight: 500; display: block; margin-bottom: 4px; }
.more-to-read { padding: 48px 0 80px; }
.more-to-read h2 { font-size: 28px; font-weight: 800; margin-bottom: 24px; text-align: center; }
.more-to-read-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 24px; }
.more-card { background: rgba(255, 255, 255, 0.03); border: 2px solid rgba(255, 255, 255, 0.05); border-radius: 20px; overflow: hidden; transition: all 0.3s ease; text-decoration: none; color: inherit; display: block; }
.more-card:hover { border-color: var(--neon-red); transform: translateY(-4px); box-shadow: 0 8px 32px rgba(255, 0, 51, 0.15); }
.more-card-image { width: 100%; height: 160px; object-fit: cover; object-position: top center; background: rgba(255, 255, 255, 0.05); }
.more-card-body { padding: 20px; }
.more-card-title { font-size: 17px; font-weight: 700; margin-bottom: 8px; line-height: 1.3; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.more-card-excerpt { font-size: 13px; color: rgba(255, 255, 255, 0.6); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.back-to-blog { display: inline-flex; align-items: center; gap: 8px; color: rgba(255, 255, 255, 0.7); text-decoration: none; font-size: 15px; margin-bottom: 24px; }
.back-to-blog:hover { color: white; }
footer { padding: 60px 0 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; background: #050505; }
.footer-content { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; margin-bottom: 40px; text-align: left; }
.footer-section h4 { margin-bottom: 20px; font-size: 18px; }
.footer-section ul { list-style: none; }
.footer-section li { margin-bottom: 12px; }
.footer-section a { color: rgba(255, 255, 255, 0.5); text-decoration: none; }
.footer-section a:hover { color: var(--neon-red); }
.footer-bottom { padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); font-size: 14px; }
@media (max-width: 768px) { .article-hero h1 { font-size: 28px; } }
img { transition: filter 0.35s ease, transform 0.35s ease; }
img.img-loading { filter: blur(8px); transform: scale(1.03); }
`;

const INDEX_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --dark-bg: #0a0a0a; --neon-red: #FF0033; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--dark-bg); color: white; line-height: 1.6; overflow-x: hidden; }
.starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); overflow: hidden; }
.star { position: absolute; width: 2px; height: 2px; background: rgba(255,255,255,0.5); border-radius: 50%; animation: twinkle 3s infinite ease-in-out; }
@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
.grid-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background-image: linear-gradient(rgba(255, 0, 51, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 0, 51, 0.02) 1px, transparent 1px); background-size: 100px 100px; opacity: 0.4; pointer-events: none; }
.content-layer { position: relative; z-index: 10; }
.header { position: absolute; top: 0; left: 0; right: 0; padding: 20px 40px; display: flex; justify-content: flex-end; align-items: center; z-index: 100; }
.header-nav { display: flex; gap: 30px; align-items: center; }
.header-nav a { color: rgba(255, 255, 255, 0.7); text-decoration: none; font-weight: 500; font-size: 15px; }
.header-nav a:hover { color: white; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.blog-hero { padding: 140px 20px 80px; text-align: center; }
.blog-hero h1 { font-size: 56px; font-weight: 900; margin-bottom: 16px; letter-spacing: -1px; }
.blog-hero p { font-size: 20px; color: rgba(255, 255, 255, 0.6); }
.blog-hero .hero-actions { display: flex; justify-content: center; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.hero-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 999px; font-weight: 800; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; }
.hero-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); transform: translateY(-1px); }
.hero-btn-primary { background: rgba(255,0,51,0.18); border-color: rgba(255,0,51,0.4); }
.blog-toolbar { max-width: 1200px; margin: -34px auto 22px; padding: 0 20px; }
.blog-toolbar-inner { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 14px; padding: 14px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); backdrop-filter: blur(10px); }
.blog-search { display: flex; gap: 10px; align-items: center; }
.blog-search input { width: 100%; padding: 12px 14px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(0,0,0,0.25); color: rgba(255,255,255,0.92); font-weight: 700; outline: none; }
.blog-search input::placeholder { color: rgba(255,255,255,0.45); font-weight: 600; }
.blog-search .search-hint { font-size: 12px; color: rgba(255,255,255,0.55); }
.blog-filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; justify-content: flex-end; }
.topic-pill { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 12px; border-radius: 999px; font-weight: 800; font-size: 13px; cursor: pointer; }
.topic-pill:hover { border-color: rgba(255,0,51,0.55); }
.topic-pill[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.16); }
.featured-row { max-width: 1200px; margin: 0 auto 22px; padding: 0 20px; }
.featured-row h2 { font-size: 20px; font-weight: 900; letter-spacing: -0.3px; margin: 12px 0 14px; text-align: left; }
.featured-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 18px; }
.featured-grid .article-card { border-radius: 20px; }
.featured-grid .article-card-image { height: 180px; }
.featured-grid .article-card-title { font-size: 18px; }
.featured-grid .article-card-excerpt { -webkit-line-clamp: 2; }
.seo-details { max-width: 900px; margin: 0 auto 28px; padding: 0 24px; }
.seo-details details { border: 1px solid rgba(255,255,255,0.1); border-radius: 18px; background: rgba(255,255,255,0.03); overflow: hidden; }
.seo-details summary { cursor: pointer; padding: 16px 18px; font-weight: 900; font-size: 16px; list-style: none; }
.seo-details summary::-webkit-details-marker { display:none; }
.seo-details summary span { color: rgba(255,255,255,0.7); font-weight: 700; font-size: 13px; display: block; margin-top: 4px; }
.seo-details .seo-details-body { padding: 0 18px 18px; color: rgba(255,255,255,0.78); font-size: 16px; line-height: 1.75; }
.seo-details .seo-details-body h3 { font-size: 18px; font-weight: 900; margin: 18px 0 8px; color: #fff; }
.seo-details .seo-details-body p { margin-bottom: 14px; }
.seo-details .seo-details-body a { color: var(--neon-red); font-weight: 800; text-decoration: none; }
.seo-details .seo-details-body a:hover { text-decoration: underline; }
.blog-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 30px; padding: 0 20px 120px; }
.article-card { background: rgba(255, 255, 255, 0.03); border: 2px solid rgba(255, 255, 255, 0.05); border-radius: 24px; overflow: hidden; transition: all 0.3s ease; text-decoration: none; color: #fff; display: block; }
.article-card:hover { border-color: var(--neon-red); transform: translateY(-5px); box-shadow: 0 10px 40px rgba(255, 0, 51, 0.2); }
.article-card-image { width: 100%; height: 230px; object-fit: cover; object-position: top center; background: rgba(255, 255, 255, 0.05); }
.article-card-body { padding: 24px; }
.article-card-title { font-size: 20px; font-weight: 700; margin-bottom: 12px; line-height: 1.3; color: #fff; }
.article-card-excerpt { font-size: 14px; color: rgba(255, 255, 255, 0.6); margin-bottom: 16px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.article-card-meta { display: flex; align-items: center; gap: 12px; font-size: 13px; color: rgba(255, 255, 255, 0.5); }
.footer { padding: 60px 0 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; background: #050505; }
.footer-content { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; margin-bottom: 40px; text-align: left; }
.footer-section h4 { margin-bottom: 20px; font-size: 18px; }
.footer-section ul { list-style: none; }
.footer-section li { margin-bottom: 12px; }
.footer-section a { color: rgba(255, 255, 255, 0.5); text-decoration: none; }
.footer-section a:hover { color: var(--neon-red); }
.footer-bottom { padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); font-size: 14px; }
@media (max-width: 768px) { .blog-hero h1 { font-size: 32px; } .blog-grid { grid-template-columns: 1fr; } }
img { transition: filter 0.35s ease, transform 0.35s ease; }
img.img-loading { filter: blur(8px); transform: scale(1.03); }
@media (max-width: 900px) {
  .blog-toolbar-inner { grid-template-columns: 1fr; }
  .blog-filters { justify-content: flex-start; }
  .featured-grid { grid-template-columns: 1fr; }
}
`;

// ---------------------------------------------------------------------------
// Centralised <img> tag builder
// ---------------------------------------------------------------------------

/**
 * Build a fully-featured <img> tag for any card or hero image.
 *
 * Attributes emitted on every tag:
 *   data-img-source  — resolution source:  thumbnail | hero | body | fallback
 *   data-img-type    — quality tier:        supabase  | external | fallback
 *   img-loading      — CSS class removed by onload (blur-fade reveal)
 *   onerror          — auto-recovers to FALLBACK_IMAGE_URL
 *   loading          — eager for above-the-fold, lazy otherwise
 *
 * @param {string|null}  url        - Validated image URL (from pickCardImage)
 * @param {string}       source     - 'thumbnail'|'hero'|'body'|'fallback'
 * @param {string}       type       - 'supabase'|'external'|'fallback'
 * @param {string}       alt        - Alt text
 * @param {string}       className  - CSS class(es) for sizing/styling
 * @param {object}       opts
 * @param {boolean}      opts.eager  - True for above-the-fold cards (loading="eager")
 * @param {number}       opts.width  - Intrinsic width hint (prevents layout shift / CLS)
 * @param {number}       opts.height - Intrinsic height hint (prevents layout shift / CLS)
 * @returns {string} HTML img tag, or empty string when url is falsy
 */
function buildImgTag(url, source, type, alt, className, { eager = false, width = 400, height = 250 } = {}) {
  if (!url) return '';
  return (
    `<img` +
    ` src="${escapeHtml(url)}"` +
    ` alt="${escapeHtml(alt)}"` +
    ` width="${width}"` +
    ` height="${height}"` +
    ` class="${className} img-loading"` +
    ` data-img-source="${source}"` +
    ` data-img-type="${type}"` +
    ` loading="${eager ? 'eager' : 'lazy'}"` +
    ` decoding="async"` +
    ` onerror="this.onerror=null;this.src='${FALLBACK_IMAGE_URL}'"` +
    ` onload="this.classList.remove('img-loading')"` +
    `>`
  );
}

/**
 * Inline runtime validation guard script.
 * After DOMContentLoaded, scans every img[data-img-source] and redirects
 * any CDN, SVG, or non-storage src to FALLBACK_IMAGE_URL before the browser
 * even attempts to load the image. Last line of defence against bad data.
 */
const RUNTIME_GUARD_SCRIPT = `<script>
(function(){
  var FB='${FALLBACK_IMAGE_URL}';
  // Mirrors classifyImageUrl() in the generator: blocks CDN proxy and SVGs only.
  // External HTTPS images are allowed (same policy as server-side validation).
  function safeImage(src){
    if(!src||!src.startsWith('https://'))return FB;
    if(src.includes('cdn.seadays.app'))return FB;
    if(src.split('?')[0].toLowerCase().endsWith('.svg'))return FB;
    return src;
  }
  function applyGuard(){
    document.querySelectorAll('img[data-img-source]').forEach(function(el){
      var orig=el.getAttribute('src')||'';
      var safe=safeImage(orig);
      if(safe!==orig){el.dataset.originalSrc=orig;el.src=safe;}
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyGuard);}
  else{applyGuard();}
})();
</script>`;

async function buildArticleHtml(article, bodyHtml, prevArticle, nextArticle, moreArticles, sameTagArticles = []) {
  const title = escapeHtml(article.seoTitle || article.title || 'Article');
  const description = escapeHtml(
    (article.seoDescription || article.excerpt || article.metaDescription || '').trim() ||
    stripHtmlToPlainText(article.content || bodyHtml, 160)
  );
  const { url: pickedHeroUrl, source: heroSource, type: heroType } = await pickCardImage(article, 'article-hero');
  logImageResolution(article, heroSource, heroType, pickedHeroUrl);
  // og:image: prefer Supabase storage URL for og:image; external is also accepted
  const ogImage = validateImageUrl(pickedHeroUrl) || DEFAULT_FAVICON;
  const heroImg = pickedHeroUrl || null;
  const canonicalUrl = blogCanonicalUrl(article.slug);

  let navHtml = '';
  if (prevArticle) {
    navHtml += `<a href="${blogRelPath(prevArticle.slug)}" class="article-nav-prev"><span class="article-nav-label">Previous</span><span>${escapeHtml(prevArticle.title || 'Previous')}</span></a>`;
  }
  if (nextArticle) {
    navHtml += `<a href="${blogRelPath(nextArticle.slug)}" class="article-nav-next"><span class="article-nav-label">Next</span><span>${escapeHtml(nextArticle.title || 'Next')}</span></a>`;
  }

  let moreHtml = '';
  if (moreArticles.length > 0) {
    const moreCards = [];
    for (let i = 0; i < moreArticles.length; i++) {
      const a = moreArticles[i];
      const { url: moreImgUrl, source: moreSource, type: moreType } = await pickCardImage(a, 'more-' + i);
      const imgTag = buildImgTag(moreImgUrl, moreSource, moreType, '', 'more-card-image', { width: 400, height: 160 });
      moreCards.push(`<a href="${blogRelPath(a.slug)}" class="more-card">${imgTag}<div class="more-card-body"><h3 class="more-card-title">${escapeHtml(a.title || 'Untitled')}</h3><p class="more-card-excerpt">${escapeHtml(a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 120) : '') || '')}</p></div></a>`);
    }
    moreHtml = '<section class="more-to-read"><h2>More to Read</h2><div class="more-to-read-grid" data-shuffle-more>' + moreCards.join('') + '</div></section>';
  }

  const navSection = navHtml ? `<nav class="article-nav" aria-label="Article navigation">${navHtml}</nav>` : '';
  const sameTopicHtml = buildSameTopicSection(article, sameTagArticles);
  const exploreHtml = buildExploreSeaDaysSection();

  const publishedIso = formatIsoDate(article.publishedAt || article.timestamp || article.createdAt);
  const modifiedIso = formatIsoDate(article.updatedAt || article.publishedAt || article.timestamp);
  const authorNamePlain = article.author || 'Anonymous';
  const articleBodyText = stripHtmlToPlainText(bodyHtml, 5000);
  const keywords = Array.isArray(article.tags) && article.tags.length
    ? article.tags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : (article.keywords && Array.isArray(article.keywords) ? article.keywords : []);
  const rawMetaDescription = (
    (article.seoDescription || article.excerpt || article.metaDescription || '').trim() ||
    stripHtmlToPlainText(article.content || bodyHtml, 160)
  );
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title || 'Article',
    description: rawMetaDescription || articleBodyText.slice(0, 160) || undefined,
    image: [ogImage],
    author: { '@type': 'Person', name: authorNamePlain },
    publisher: {
      '@type': 'Organization',
      name: 'SeaDays',
      logo: { '@type': 'ImageObject', url: LOGO_URL },
    },
    datePublished: publishedIso || undefined,
    dateModified: modifiedIso || publishedIso || undefined,
    mainEntityOfPage: canonicalUrl,
    ...(articleBodyText ? { articleBody: articleBodyText } : {}),
    ...(keywords.length ? { keywords: keywords.slice(0, 10).join(', ') } : {}),
  };
  Object.keys(jsonLd).forEach((k) => { if (jsonLd[k] === undefined || jsonLd[k] === null) delete jsonLd[k]; });
  const jsonLdStr = JSON.stringify(jsonLd);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${description}">
  <title>${title} | SeaDays</title>
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
  <meta property="og:type" content="article">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${ogImage}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonicalUrl}">
  <meta property="twitter:title" content="${title}">
  <meta property="twitter:description" content="${description}">
  <meta property="twitter:image" content="${ogImage}">
  <script type="application/ld+json">${jsonLdStr}</script>
  <style>${ARTICLE_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">
      <nav class="header-nav">
        <a href="/index.html">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>
    </header>
    <main class="container">
      <article>
        <a href="/blog/" class="back-to-blog">← Back to Blog</a>
        <div class="article-hero">
          <h1>${escapeHtml(article.title || 'Untitled')}</h1>
          <div class="article-meta">
            <span class="author">${escapeHtml(authorNamePlain)}</span>
            <span>${formatDate(article.publishedAt || article.timestamp || article.updatedAt)}</span>
            ${article.readTime ? `<span>${escapeHtml(String(article.readTime))} min read</span>` : ''}
          </div>
          ${buildImgTag(heroImg, heroSource, heroType, article.title || 'Article', 'article-hero-image', { eager: true, width: 800, height: 400 })}
        </div>
        <div class="article-body">${bodyHtml}</div>
        ${sameTopicHtml}
        ${exploreHtml}
        ${navSection}
        ${moreHtml}
      </article>
    </main>
    <footer>
      <div class="container">
        <div class="footer-content">
          <div class="footer-section"><h4>Product</h4><ul><li><a href="/index.html#download">Download</a></li></ul></div>
          <div class="footer-section"><h4>Company</h4><ul><li><a href="https://seadays.app/about.html">About Us</a></li><li><a href="https://seadays.app/help.html">Help Center</a></li><li><a href="https://seadays.app/contact.html">Contact</a></li><li><a href="https://seadays.app/faq.html">FAQ</a></li></ul></div>
          <div class="footer-section"><h4>Legal</h4><ul><li><a href="https://seadays.app/privacy.html">Privacy Policy</a></li><li><a href="https://seadays.app/terms.html">Terms of Service</a></li><li><a href="https://seadays.app/cookies.html">Cookie Policy</a></li></ul></div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 SeaDays. All rights reserved.</p><p style="margin-top:12px;">made with love from the port city of Hamburg</p></div>
      </div>
    </footer>
  </div>
  <script>
    (function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<150;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();
    (function(){var g=document.querySelector('.more-to-read-grid[data-shuffle-more]');if(!g)return;var cards=[].slice.call(g.querySelectorAll('.more-card'));if(cards.length<=6)return;for(var i=cards.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=cards[i];cards[i]=cards[j];cards[j]=t;}g.innerHTML='';cards.forEach(function(c,i){g.appendChild(c);if(i>=6)c.style.display='none';});})();
  </script>
  ${RUNTIME_GUARD_SCRIPT}
</body>
</html>`;
}

async function buildHomePageBlogCards(articles) {
  if (articles.length === 0) return '<div id="blogGrid" class="blog-section-grid" style="display:none;"></div>\n                <div id="blogEmpty" class="blog-empty" style="display:block;">No posts yet. Check back soon for stories and tips.</div>';
  const cards = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const { url: imgUrl, source, type } = await pickCardImage(a, 'home-' + i);
    logImageResolution(a, source, type, imgUrl);
    const excerpt = (a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 140) : '') || '') + (a.excerpt || a.content ? '...' : '');
    // First 2 home-page cards are above the fold → eager-load for perceived performance
    const imgTag = buildImgTag(imgUrl, source, type, a.title || 'Article', 'blog-card-image', { eager: i < 2, width: 400, height: 230 });
    cards.push(`<a href="${BASE_URL}/blog/${a.slug}/" class="blog-card">
                    ${imgTag}
                    <div class="blog-card-body">
                        <h3 class="blog-card-title">${escapeHtml(a.title || 'Untitled')}</h3>
                        <p class="blog-card-excerpt">${escapeHtml(excerpt)}</p>
                    </div>
                </a>`);
  }
  return '<div id="blogGrid" class="blog-section-grid">' + cards.join('\n                ') + '</div>';
}

async function buildIndexHtml(articles) {
  // Phase 1: resolve images for ALL cards before touching the HTML template.
  // This lets us (a) compute <link rel="preload"> URLs for above-the-fold cards,
  // and (b) avoid calling pickCardImage a second time when building card HTML.
  const imageResults = [];
  for (let i = 0; i < articles.length; i++) {
    const result = await pickCardImage(articles[i], 'index-' + i);
    logImageResolution(articles[i], result.source, result.type, result.url);
    imageResults.push(result);
  }

  // First 3 non-null images get <link rel="preload"> — they appear above the fold
  // on most viewports and should start loading before the browser parses <body>.
  const preloadLinks = imageResults
    .slice(0, 3)
    .filter(r => r.url)
    .map(r => `  <link rel="preload" as="image" href="${escapeHtml(r.url)}">`)
    .join('\n');

  // Phase 2: build card HTML using cached image results
  const cards = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const { url: imgUrl, source, type } = imageResults[i];
    const excerpt = a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 150) : '') || '';
    // First 3 cards are above the fold → eager-load; rest lazy-load
    const imgTag = buildImgTag(imgUrl, source, type, '', 'article-card-image', { eager: i < 3, width: 400, height: 230 });
    cards.push(`<a href="${BASE_URL}/blog/${a.slug}/" class="article-card">
      ${imgTag}
      <div class="article-card-body">
        <h3 class="article-card-title">${escapeHtml(a.title || 'Untitled')}</h3>
        <p class="article-card-excerpt">${escapeHtml(excerpt)}</p>
        <div class="article-card-meta">
          <span class="author">${escapeHtml(a.author || 'Anonymous')}</span>
          <span>${formatDate(a.publishedAt || a.timestamp || a.updatedAt)}</span>
          ${a.readTime ? '<span>' + escapeHtml(String(a.readTime)) + ' min read</span>' : ''}
        </div>
      </div>
    </a>`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="SeaDays cruise blog: planning guides, ship and port explainers, packing tips, and sea-day ideas. Read free articles and explore ships and destinations before you book.">
  <title>SeaDays Blog | Cruise Tips, Guides &amp; Stories</title>
  <link rel="canonical" href="${BASE_URL}/blog/">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
${preloadLinks}
  <meta property="og:type" content="website">
  <meta property="og:url" content="${BASE_URL}/blog/">
  <meta property="og:title" content="SeaDays Blog | Cruise Tips, Guides &amp; Stories">
  <meta property="og:description" content="Cruise tips, guides &amp; stories from the SeaDays community. Plan smarter, pack lighter, and cruise better.">
  <meta property="og:image" content="${DEFAULT_FAVICON}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${BASE_URL}/blog/">
  <meta property="twitter:title" content="SeaDays Blog | Cruise Tips, Guides &amp; Stories">
  <meta property="twitter:description" content="Cruise tips, guides &amp; stories from the SeaDays community. Plan smarter, pack lighter, and cruise better.">
  <meta property="twitter:image" content="${DEFAULT_FAVICON}">
  <style>${INDEX_STYLES}</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">
      <nav class="header-nav">
        <a href="/index.html">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>
    </header>
    <section class="blog-hero">
      <div class="container">
        <h1>SeaDays cruise blog</h1>
        <p>Stories, tips, and experiences shared by the SeaDays community.</p>
        <div class="hero-actions">
          <a class="hero-btn hero-btn-primary" href="/index.html#download">Download SeaDays</a>
          <a class="hero-btn" href="/ships/">Explore ships</a>
          <a class="hero-btn" href="/ports/">Explore ports</a>
        </div>
      </div>
    </section>
    <section class="blog-toolbar" aria-label="Search and filters">
      <div class="blog-toolbar-inner">
        <div class="blog-search">
          <input id="blogSearch" type="search" placeholder="Search cruise tips, ports, ships, packing…" aria-label="Search blog posts">
          <div class="search-hint" id="resultsHint" aria-live="polite"></div>
        </div>
        <div class="blog-filters" id="topicFilters" aria-label="Topic filters">
          <button type="button" class="topic-pill" data-topic="__all__" aria-pressed="true">All</button>
          <button type="button" class="topic-pill" data-topic="firstTimers" aria-pressed="false">First-timers</button>
          <button type="button" class="topic-pill" data-topic="budget" aria-pressed="false">Budget</button>
          <button type="button" class="topic-pill" data-topic="luxury" aria-pressed="false">Luxury</button>
          <button type="button" class="topic-pill" data-topic="packing" aria-pressed="false">Packing</button>
          <button type="button" class="topic-pill" data-topic="cabins" aria-pressed="false">Cabins</button>
          <button type="button" class="topic-pill" data-topic="ports" aria-pressed="false">Ports</button>
          <button type="button" class="topic-pill" data-topic="seaDays" aria-pressed="false">Sea days</button>
          <button type="button" class="topic-pill" data-topic="wifi" aria-pressed="false">Internet</button>
          <button type="button" class="topic-pill" data-topic="families" aria-pressed="false">Families</button>
          <button type="button" class="topic-pill" data-topic="drinkPackages" aria-pressed="false">Drink packages</button>
        </div>
      </div>
    </section>
    <section class="featured-row" aria-label="Featured posts">
      <h2>Featured</h2>
      <div class="featured-grid" id="featuredGrid"></div>
    </section>
    <section class="seo-details" aria-label="About this blog">
      <details>
        <summary>
          Why SeaDays blog is different
          <span>Short, practical guidance—plus deeper guides when you want them.</span>
        </summary>
        <div class="seo-details-body">
          <h3>Plan smarter cruises with expert guides</h3>
          <p>This blog is written for people who want more than a brochure: honest trade-offs between cabin types, realistic sea-day routines, drink-package math, and what actually happens if you miss the ship in port. Every article is designed to be useful before you book, while you pack, and on embarkation day when small decisions compound.</p>
          <p>We connect ideas across topics. When you read about <a href="/ships/">cruise ships and major lines</a>, you can cross-check itineraries against our <a href="/ports/">ports and destinations hub</a> to see whether your sailing favors short port calls or overnight stays. That pairing—ship plus geography—is how experienced cruisers avoid feeling rushed on land or bored at sea.</p>
          <h3>SeaDays tools behind the articles</h3>
          <p>SeaDays is a cruise companion app with live-friendly features for tracking trips, exploring ships, and browsing ports. The blog highlights concepts you will also find inside the product, but nothing here sits behind a paywall: the goal is search-quality guidance that stands alone in your browser.</p>
          <p>If you are new to cruising, start with first-timer explainers and packing lists below. If you are comparing lines for a family, filter by cabins, dining, and kid-friendly tips—then validate against your target region on the <a href="/ports/">ports</a> page.</p>
        </div>
      </details>
    </section>
    <div class="container">
      <div class="blog-grid" id="blogGrid">${cards.join('\n')}</div>
    </div>
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section"><h4>Product</h4><ul><li><a href="/index.html#download">Download</a></li></ul></div>
          <div class="footer-section"><h4>Company</h4><ul><li><a href="https://seadays.app/about.html">About Us</a></li><li><a href="https://seadays.app/help.html">Help Center</a></li><li><a href="https://seadays.app/contact.html">Contact</a></li><li><a href="https://seadays.app/faq.html">FAQ</a></li></ul></div>
          <div class="footer-section"><h4>Legal</h4><ul><li><a href="https://seadays.app/privacy.html">Privacy Policy</a></li><li><a href="https://seadays.app/terms.html">Terms of Service</a></li><li><a href="https://seadays.app/cookies.html">Cookie Policy</a></li></ul></div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 SeaDays. All rights reserved.</p><p style="margin-top:12px;">made with love from the port city of Hamburg</p></div>
      </div>
    </footer>
  </div>
  <script>
    (function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<150;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();
  </script>
  <script>
  (function(){
    var grid = document.getElementById('blogGrid')
    var featured = document.getElementById('featuredGrid')
    var search = document.getElementById('blogSearch')
    var hint = document.getElementById('resultsHint')
    var filters = document.getElementById('topicFilters')
    if(!grid || !featured || !search || !filters) return

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.article-card'))
    var featuredCards = cards.slice(0, 3).map(function(c){ return c.cloneNode(true) })
    featuredCards.forEach(function(c){ featured.appendChild(c) })

    var activeTopic = '__all__'
    var topicRules = {
      __all__: [],
      firstTimers: ['first time', 'beginner', 'new cruise', 'first-timer'],
      budget: ['budget', 'cheap', 'save', 'money', 'worth it'],
      luxury: ['luxury', 'suite', '$', 'premium'],
      packing: ['pack', 'packing', 'luggage', 'checklist'],
      cabins: ['cabin', 'stateroom', 'balcony', 'inside', 'suite'],
      ports: ['port', 'shore', 'excursion', 'destination', 'embarkation'],
      seaDays: ['sea day', 'at sea'],
      wifi: ['wifi', 'internet', 'remote work', 'work remotely'],
      families: ['family', 'kids', 'teen', 'infant', 'multi-generational'],
      drinkPackages: ['drink package', 'beverage', 'cocktail', 'alcohol']
    }

    function setPressed(active){
      Array.prototype.slice.call(filters.querySelectorAll('button.topic-pill')).forEach(function(b){
        b.setAttribute('aria-pressed', String(b.getAttribute('data-topic') === active))
      })
    }

    function cardText(card){
      var t = ''
      var title = card.querySelector('.article-card-title')
      var ex = card.querySelector('.article-card-excerpt')
      if(title && title.textContent) t += title.textContent + ' '
      if(ex && ex.textContent) t += ex.textContent
      return t.toLowerCase()
    }

    function matchesTopic(text, topic){
      var rules = topicRules[topic] || []
      if(topic === '__all__' || rules.length === 0) return true
      return rules.some(function(k){ return text.includes(k) })
    }

    function apply(){
      var q = (search.value || '').trim().toLowerCase()
      var visible = 0
      cards.forEach(function(card){
        var text = cardText(card)
        var ok = true
        if(q) ok = ok && text.includes(q)
        ok = ok && matchesTopic(text, activeTopic)
        card.style.display = ok ? '' : 'none'
        if(ok) visible++
      })
      if(hint) hint.textContent = visible ? (visible + ' posts') : 'No matches'
    }

    filters.addEventListener('click', function(e){
      var btn = e.target && e.target.closest && e.target.closest('button[data-topic]')
      if(!btn) return
      activeTopic = btn.getAttribute('data-topic') || '__all__'
      setPressed(activeTopic)
      apply()
    })
    search.addEventListener('input', apply)
    apply()
  })();
  </script>
  ${RUNTIME_GUARD_SCRIPT}
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Post-build validation
// ---------------------------------------------------------------------------

/**
 * Single HTTP request, returns status code or 0 on error/timeout.
 * Used by httpCheck; not called directly.
 */
function httpRequest(url, method, { useRange = false } = {}) {
  return new Promise((resolve) => {
    try {
      const lib = require('https');
      const headers = {
        'User-Agent': 'SeadaysBlogValidator/1.0 (+https://seadays.app)',
        Accept: 'image/*,*/*;q=0.8',
      };
      if (method === 'GET' && useRange) headers.Range = 'bytes=0-0';
      const req = lib.request(url, { method, timeout: 12000, headers }, (res) => {
        resolve(res.statusCode || 0);
        res.resume();
      });
      req.on('error', () => resolve(0));
      req.on('timeout', () => { req.destroy(); resolve(0); });
      req.end();
    } catch {
      resolve(0);
    }
  });
}

function isHttpOkStatus(status) {
  return status === 200 || status === 206 || status === 304;
}

/**
 * Check URL reachability with HEAD→GET fallback (plain GET, no Range — some
 * gateways return 400 for ranged requests on public storage).
 */
async function httpCheck(url, maxRetries = 2) {
  let lastStatus = await httpRequest(url, 'HEAD');
  if (isHttpOkStatus(lastStatus)) return 200;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    lastStatus = await httpRequest(url, 'GET', { useRange: false });
    if (isHttpOkStatus(lastStatus)) return 200;
    if (attempt < maxRetries) await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
  }
  return lastStatus;
}

/**
 * Post-build validation: scans every generated HTML file.
 *
 * Hard violations (FAIL build):
 *   - CDN proxy URL (cdn.seadays.app) in any img src
 *   - SVG used as a card image src
 *   - Nested <a> tags (invalid HTML)
 *   - Supabase storage image URL that returns non-200 on GET (after HEAD may fail
 *     with 400/405 on custom domains — httpCheck falls back to ranged GET)
 *
 * Warnings only (NEVER fail build):
 *   - External image usage (data-img-type="external") — allowed, just noted
 *   - Fallback image usage (data-img-type="fallback") — article had no real image
 *   - Card count diverges from article count (dedup/slug reasons)
 *   - Cards with no thumbnail (article has truly no image at all)
 */
async function runPostBuildValidation(blogDir, repoRoot, articles, seoShips = [], seoPorts = []) {
  console.log('\n[validate] Running post-build validation...');

  const violations = [];
  const warnings   = [];

  const filesToScan = [
    path.join(blogDir, 'index.html'),
    path.join(repoRoot, 'index.html'),
    path.join(repoRoot, 'ships', 'index.html'),
    path.join(repoRoot, 'ports', 'index.html'),
  ];
  for (const a of articles) {
    filesToScan.push(path.join(blogDir, a.slug, 'index.html'));
  }
  if (seoShips.length) {
    filesToScan.push(path.join(repoRoot, 'ships', seoShips[0].slug, 'index.html'));
  }
  if (seoPorts.length) {
    filesToScan.push(path.join(repoRoot, 'ports', seoPorts[0].slug, 'index.html'));
  }

  const allStorageUrls = new Set();
  let totalCards    = 0;
  let cardsWithImg  = 0;
  let externalCount = 0;
  let fallbackCount = 0;

  for (const filePath of filesToScan) {
    if (!fs.existsSync(filePath)) continue;
    const html    = fs.readFileSync(filePath, 'utf8');
    const relPath = path.relative(repoRoot, filePath);

    // VIOLATION: CDN proxy URLs in <img src>
    for (const m of html.matchAll(/<img\b[^>]*src="([^"]*cdn\.seadays\.app[^"]*)"[^>]*>/gi)) {
      violations.push(`CDN in img [${relPath}]: ${m[1].slice(0, 100)}`);
    }

    // VIOLATION: SVG in <img src>
    for (const m of html.matchAll(/<img\b[^>]*src="([^"]*\.svg[^"]*)"[^>]*>/gi)) {
      violations.push(`SVG in img [${relPath}]: ${m[1].slice(0, 100)}`);
    }

    // VIOLATION: nested <a> tags
    if (/<a\b[^>]*>(?:[^<]|<(?!\/a\b))*<a\b/i.test(html)) {
      violations.push(`Nested <a> tags detected [${relPath}]`);
    }

    // Collect Supabase storage URLs for HTTP reachability check
    for (const m of html.matchAll(/<img\b[^>]*src="(https:\/\/auth\.seadays\.app\/storage\/[^"]+)"[^>]*>/gi)) {
      allStorageUrls.add(m[1]);
    }

    // WARNING: external images (allowed but logged)
    const extImgs = [...html.matchAll(/<img\b[^>]*data-img-type="external"[^>]*>/gi)];
    if (extImgs.length) externalCount += extImgs.length;

    // WARNING: fallback images (article had no real thumbnail)
    const fbImgs = [...html.matchAll(/<img\b[^>]*data-img-type="fallback"[^>]*>/gi)];
    if (fbImgs.length) fallbackCount += fbImgs.length;

    // INFO: card coverage stats on blog/index.html
    if (relPath.replace(/\\/g, '/').endsWith('blog/index.html')) {
      totalCards   = (html.match(/class="article-card"/g) || []).length;
      cardsWithImg = (html.match(/class="article-card-image\b/g) || []).length;
      if (cardsWithImg < totalCards) {
        warnings.push(`${totalCards - cardsWithImg}/${totalCards} cards missing thumbnails [${relPath}]`);
      }
      if (articles.length > 0 && totalCards !== articles.length) {
        warnings.push(`Card count: expected ${articles.length}, got ${totalCards} [${relPath}]`);
      }
    }
  }

  // HTTP 200 reachability for Supabase storage URLs (with retry + GET fallback)
  const uniqueStorageUrls = [...allStorageUrls];
  console.log(`[validate] HTTP-checking ${uniqueStorageUrls.length} Supabase storage URLs (with retry)...`);
  let httpOk = 0;
  for (const url of uniqueStorageUrls) {
    const checkUrl = normalizeAuthStoragePublicUrl(url);
    if (checkUrl !== url) {
      warnings.push(
        `Repaired missing bucket in img src for HTTP check (re-run generator to fix HTML): ${url.slice(0, 120)}…`
      );
    }
    const status = await httpCheck(checkUrl);
    if (status === 200) {
      httpOk++;
    } else {
      violations.push(`HTTP ${status} after retries [${checkUrl.slice(0, 220)}]`);
    }
  }

  // Emit non-fatal warnings
  if (externalCount)  console.warn(`  [warn] ${externalCount} external image(s) used — allowed, prefer Supabase storage`);
  if (fallbackCount)  console.warn(`  [warn] ${fallbackCount} fallback image(s) used — articles have no thumbnail in DB`);
  for (const w of warnings) console.warn(`  [warn] ${w}`);

  if (violations.length > 0) {
    console.error('\n[validate] ✗ BUILD VIOLATIONS:');
    for (const v of violations) console.error(`  ✗ ${v}`);
    throw new Error(
      `Post-build validation failed with ${violations.length} violation(s). See above.`
    );
  }

  console.log(
    `[validate] ✓ Passed. Cards: ${cardsWithImg}/${totalCards} with images. ` +
    `Storage URLs: ${httpOk}/${uniqueStorageUrls.length} OK. ` +
    `External: ${externalCount}. Fallback: ${fallbackCount}.`
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.SUPABASE_ANON_KEY) {
    console.warn('[generateBlogs] SUPABASE_ANON_KEY not set. Skipping blog fetch; ships/ports SEO will be generated from the local dataset only.');
  }

  const repoRoot = path.join(__dirname, '..');
  const blogDir = path.join(repoRoot, 'blog');

  imageStats.uploaded = 0;
  imageStats.removed = 0;
  imageQualityStats.supabase = 0;
  imageQualityStats.external = 0;
  imageQualityStats.fallback = 0;
  externalChecksCount = 0;
  externalCheckCache.clear();
  base64UrlCache.clear();
  console.log('Fetching articles from Supabase...');
  const data = await fetchArticles();
  const rawArticles = (data?.articles || []).filter(a => a && a.isDraft !== true && a.showOnWebsite !== false);
  if (rawArticles.length === 0) {
    console.log('No published articles found. Creating empty blog structure.');
  }

  const slugMap = new Map();
  const articles = [];
  for (const a of rawArticles) {
    let slug = (a.slug || '').trim();
    if (!slug) slug = slugify(a.title || 'article');
    let base = slug;
    let n = 1;
    while (slugMap.has(slug)) {
      slug = base + '-' + n;
      n++;
    }
    slugMap.set(slug, true);
    articles.push({ ...a, slug });
  }
  articles.sort((a, b) => {
    const ta = a.publishedAt || a.timestamp || a.updatedAt || 0;
    const tb = b.publishedAt || b.timestamp || b.updatedAt || 0;
    const ma = typeof ta === 'number' ? ta : (ta < 10000000000 ? ta * 1000 : Date.parse(ta) || 0);
    const mb = typeof tb === 'number' ? tb : (tb < 10000000000 ? tb * 1000 : Date.parse(tb) || 0);
    return mb - ma;
  });

  console.log('Merging thumbnail payloads for articles missing hero/thumbnail...');
  await mergePortsideThumbnailsIntoArticles(articles);

  console.log('Fetching ships & ports for programmatic SEO pages...');
  const { ships: rawShips, ports: rawPorts } = await fetchReviewsShipsPorts();
  const apiSeoShips = buildSeoShipRecords(Array.isArray(rawShips) ? rawShips : []);
  const apiSeoPorts = buildSeoPortRecords(Array.isArray(rawPorts) ? rawPorts : []);

  const apiShipBySlug = new Map(apiSeoShips.map((s) => [String(s.slug || '').trim(), s]).filter((x) => x[0]));
  const apiPortBySlug = new Map(apiSeoPorts.map((p) => [String(p.slug || '').trim(), p]).filter((x) => x[0]));

  const fullShipRawList = (Array.isArray(APP_ALL_SHIPS) && APP_ALL_SHIPS.length ? APP_ALL_SHIPS : FALLBACK_SHIP_GRID).map((s) => {
    const slug = String(s.slug || '').trim() || slugify(s.name || 'ship');
    const api = apiShipBySlug.get(slug);
    return {
      id: slug,
      slug,
      name: s.name || api?.name || slug,
      cruise_line: s.cruiseLine || api?.cruise_line || api?.cruiseLine || 'Major cruise line',
      description: api?.description || '',
      highlights: api?.highlights || [],
      rating: api?.rating ?? null,
      reviewCount: api?.reviewCount ?? null,
    };
  });

  const fullPortRawList = (Array.isArray(APP_ALL_PORTS) && APP_ALL_PORTS.length ? APP_ALL_PORTS : FALLBACK_PORT_GRID).map((p) => {
    const slug = String(p.slug || '').trim() || slugify(p.name || 'port');
    const api = apiPortBySlug.get(slug);
    const country = p.country || api?.country || api?.countryName || '';
    const label = String(p.name || api?.name || '').trim();
    const portName = country && label.toLowerCase().endsWith(`, ${String(country).toLowerCase()}`)
      ? label.slice(0, -2 - String(country).length).trim()
      : label || slug;
    return {
      id: slug,
      slug,
      portName,
      country,
      region: p.region || api?.region || '',
      description: api?.description || '',
      highlights: api?.highlights || [],
      rating: api?.rating ?? null,
      reviewCount: api?.reviewCount ?? null,
    };
  });

  const seoShips = buildSeoShipRecords(fullShipRawList);
  const seoPorts = buildSeoPortRecords(fullPortRawList);
  const spOpts = {
    baseUrl: BASE_URL,
    defaultImage: DEFAULT_FAVICON,
    indexStyles: INDEX_STYLES,
    runtimeGuardScript: RUNTIME_GUARD_SCRIPT,
  };

  fs.mkdirSync(blogDir, { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'ships'), { recursive: true });
  fs.mkdirSync(path.join(repoRoot, 'ports'), { recursive: true });

  for (const ship of seoShips) {
    const dir = path.join(repoRoot, 'ships', ship.slug);
    fs.mkdirSync(dir, { recursive: true });
    const relShips = pickRelatedShips(seoShips, ship, 5);
    const destPorts = pickPortsForShipPage(seoPorts, ship, 2);
    const tokens = [ship.name, ship.cruise_line, ...ship.name.split(/\s+/).filter((w) => w.length > 3)];
    const blogs = pickBlogArticlesForEntity(articles, tokens, 2);
    fs.writeFileSync(path.join(dir, 'index.html'), buildShipDetailHtml(ship, relShips, destPorts, blogs, spOpts), 'utf8');
  }
  for (const port of seoPorts) {
    const dir = path.join(repoRoot, 'ports', port.slug);
    fs.mkdirSync(dir, { recursive: true });
    const relPorts = pickRelatedPorts(seoPorts, port, 5);
    const destShips = pickShipsForPortPage(seoShips, port, 4);
    const tokens = [port.name, port.country, ...port.name.split(/\s+/).filter((w) => w.length > 2)];
    const blogs = pickBlogArticlesForEntity(articles, tokens, 2);
    fs.writeFileSync(path.join(dir, 'index.html'), buildPortDetailHtml(port, relPorts, destShips, blogs, spOpts), 'utf8');
  }

  async function buildFeaturedGuideCardsHtml(featuredArticles, keyPrefix) {
    const safe = Array.isArray(featuredArticles) ? featuredArticles : [];
    const out = [];
    for (let i = 0; i < safe.length; i++) {
      const a = safe[i];
      if (!a || !a.slug) continue;
      const { url: imgUrl, source, type } = await pickCardImage(a, `${keyPrefix}-${i}`);
      logImageResolution(a, source, type, imgUrl);
      const imgTag = buildImgTag(imgUrl, source, type, a.title || 'SeaDays guide', 'guide-card-image', { width: 420, height: 240 });
      out.push(
        `<a class="guide-card" href="${blogRelPath(escapeHtml(a.slug))}">` +
          `${imgTag}` +
          `<div class="guide-card-body">` +
            `<p class="guide-card-title">${escapeHtml(a.title || 'SeaDays guide')}</p>` +
            `<p class="guide-card-meta">Read in the SeaDays blog</p>` +
          `</div>` +
        `</a>`
      );
    }
    return out.join('\n');
  }

  function pickShipGuideArticles() {
    const lineGroups = new Map();
    for (const ship of seoShips) {
      const line = String(ship.cruise_line || '').trim();
      if (!line) continue;
      if (!lineGroups.has(line)) lineGroups.set(line, []);
      lineGroups.get(line).push(ship);
    }
    const linePills = [...lineGroups.entries()]
      .map(([line, list]) => {
        const score = list.reduce((sum, s) => sum + (Number.isFinite(s.reviewCount) ? s.reviewCount : 0), 0);
        return { line, score, count: list.length };
      })
      .sort((a, b) => (b.score - a.score) || (b.count - a.count) || a.line.localeCompare(b.line));
    const topLineTokens = linePills.slice(0, 6).map((x) => x.line);
    return pickBlogArticlesForEntity(articles, ['cruise ships', 'cruise lines', ...topLineTokens], 6).slice(0, 6);
  }

  function pickPortGuideArticles() {
    const regionGroups = new Map();
    for (const port of seoPorts) {
      const region = String(port.region || '').trim() || 'Other';
      if (!regionGroups.has(region)) regionGroups.set(region, []);
      regionGroups.get(region).push(port);
    }
    const regionPills = [...regionGroups.entries()]
      .map(([region, list]) => ({ region, count: list.length }))
      .sort((a, b) => (b.count - a.count) || a.region.localeCompare(b.region));
    const topRegionTokens = regionPills.slice(0, 8).map((x) => x.region);
    return pickBlogArticlesForEntity(articles, ['cruise ports', 'shore days', ...topRegionTokens], 6).slice(0, 6);
  }

  const shipGuideCardsHtml = await buildFeaturedGuideCardsHtml(pickShipGuideArticles(), 'ship-guide');
  const portGuideCardsHtml = await buildFeaturedGuideCardsHtml(pickPortGuideArticles(), 'port-guide');

  fs.writeFileSync(
    path.join(repoRoot, 'ships', 'index.html'),
    buildShipsIndexHtml({ ships: seoShips, articles, featuredGuideCardsHtml: shipGuideCardsHtml }),
    'utf8'
  );
  fs.writeFileSync(
    path.join(repoRoot, 'ports', 'index.html'),
    buildPortsIndexHtml({ ports: seoPorts, articles, featuredGuideCardsHtml: portGuideCardsHtml }),
    'utf8'
  );
  console.log(`  wrote ${seoShips.length} ship + ${seoPorts.length} port detail pages + indexes`);

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const full = await fetchFullArticle(article.id);
    if (full) {
      article.content = full.content;
      article.structuredContent = full.structuredContent;
      // Backfill thumbnail/hero from full article detail if the summary omitted them or
      // only returned a gradient SVG placeholder.
      if ((!article.thumbnailUrl || isGradientSvgDataUrl(article.thumbnailUrl)) && full.thumbnailUrl && !isGradientSvgDataUrl(full.thumbnailUrl))
        article.thumbnailUrl = full.thumbnailUrl;
      if ((!article.heroImageUrl || isGradientSvgDataUrl(article.heroImageUrl)) && full.heroImageUrl && !isGradientSvgDataUrl(full.heroImageUrl))
        article.heroImageUrl = full.heroImageUrl;
    }
    let bodyHtml = await getArticleBodyHtml(article);
    // Store processed bodyHtml so pickCardImage/extractFirstRasterImageFromContent
    // can scan it for raster images when heroImageUrl/thumbnailUrl is absent or SVG-only.
    article._processedBodyHtml = bodyHtml;
    const prev = i > 0 ? articles[i - 1] : null;
    const next = i < articles.length - 1 ? articles[i + 1] : null;
    const more = selectMoreToReadArticles(article, articles, 12);
    const excludeIds = new Set([article.id, ...more.map((a) => a.id)]);
    bodyHtml = injectKeywordLinksIntoBodyHtml(bodyHtml, { maxShipLinks: 2, maxPortLinks: 2 });
    const relatedForInjection = findRelatedArticles(article, articles, excludeIds, 4);
    bodyHtml = injectContextualLinks(bodyHtml, relatedForInjection, 4);
    bodyHtml = rewriteCdnImgSrcAttributes(bodyHtml);
    const sameTagArticles = findSameTagArticles(article, articles, 6);
    const html = await buildArticleHtml(article, bodyHtml, prev, next, more, sameTagArticles);
    const articleDir = path.join(blogDir, article.slug);
    const indexPath = path.join(articleDir, 'index.html');
    const redirectPath = path.join(blogDir, article.slug + '.html');
    fs.mkdirSync(articleDir, { recursive: true });
    fs.writeFileSync(indexPath, html, 'utf8');
    fs.writeFileSync(redirectPath, buildRedirectPage(article.slug), 'utf8');
    const sizeBytes = Buffer.byteLength(html, 'utf8');
    const sizeKb = Math.round(sizeBytes / 1024);
    if (sizeBytes > SIZE_WARN_KB * 1024) {
      console.warn(`  [warn] blog/${article.slug}/index.html is ${sizeKb}KB (over ${SIZE_WARN_KB}KB threshold)`);
    }
    console.log(`  wrote blog/${article.slug}/index.html (${sizeKb}KB)`);
    console.log(`  wrote blog/${article.slug}.html (redirect)`);
  }

  const indexHtml = await buildIndexHtml(articles);
  fs.writeFileSync(path.join(blogDir, 'index.html'), indexHtml, 'utf8');
  const indexSizeKb = Math.round(Buffer.byteLength(indexHtml, 'utf8') / 1024);
  console.log(`  wrote blog/index.html (${indexSizeKb}KB)`);

  const indexPath = path.join(repoRoot, 'index.html');
  if (fs.existsSync(indexPath)) {
    const homeCardsHtml = await buildHomePageBlogCards(articles.slice(0, 4));
    let homeHtml = fs.readFileSync(indexPath, 'utf8');
    const startMarker = '<!-- INJECT_BLOG_CARDS_START -->';
    const endMarker = '<!-- INJECT_BLOG_CARDS_END -->';
    const startIdx = homeHtml.indexOf(startMarker);
    const endIdx = homeHtml.indexOf(endMarker);
    if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
      const before = homeHtml.slice(0, startIdx + startMarker.length);
      const after = homeHtml.slice(endIdx + endMarker.length);
      homeHtml = before + '\n                ' + homeCardsHtml + '\n                ' + endMarker + after;
      fs.writeFileSync(indexPath, homeHtml, 'utf8');
      console.log('  updated index.html with static blog cards');
    } else {
      console.warn('  [warn] index.html markers not found, skipping home page injection');
    }
  }

  console.log(`\nImage stats: ${imageStats.uploaded} uploaded, ${imageStats.removed} removed (base64)`);
  const total = imageQualityStats.supabase + imageQualityStats.external + imageQualityStats.fallback;
  console.log(
    `\n[summary] Image quality across ${total} articles:\n` +
    `  supabase : ${imageQualityStats.supabase} (${total ? Math.round(imageQualityStats.supabase / total * 100) : 0}%)\n` +
    `  external : ${imageQualityStats.external} (${total ? Math.round(imageQualityStats.external / total * 100) : 0}%)\n` +
    `  fallback : ${imageQualityStats.fallback} (${total ? Math.round(imageQualityStats.fallback / total * 100) : 0}%)`
  );
  if (imageQualityStats.fallback > 0) {
    console.warn(`  [summary-warn] ${imageQualityStats.fallback} article(s) using fallback image — add thumbnails in CMS`);
  }

  const todayIso = new Date().toISOString().split('T')[0];
  const staticUrls = [
    { loc: BASE_URL + '/', changefreq: 'weekly', priority: '1.0', lastmod: todayIso },
    { loc: BASE_URL + '/blog/', changefreq: 'daily', priority: '0.9', lastmod: todayIso },
    { loc: BASE_URL + '/ships/', changefreq: 'weekly', priority: '0.85', lastmod: todayIso },
    { loc: BASE_URL + '/ports/', changefreq: 'weekly', priority: '0.85', lastmod: todayIso },
    { loc: BASE_URL + '/landing-page.html', changefreq: 'weekly', priority: '0.8', lastmod: todayIso },
  ];
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const seenUrls = new Set();
  for (const u of staticUrls) {
    if (seenUrls.has(u.loc)) continue;
    seenUrls.add(u.loc);
    sitemap += sitemapUrlLine(u.loc, u.changefreq, u.priority, u.lastmod);
  }
  for (const a of articles) {
    const url = blogCanonicalUrl(a.slug);
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    const lastmod =
      formatIsoDate(a.updatedAt || a.publishedAt || a.timestamp || a.createdAt) || todayIso;
    sitemap += sitemapUrlLine(url, 'monthly', '0.7', lastmod);
  }
  for (const s of seoShips) {
    const url = `${BASE_URL}/ships/${s.slug}/`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    sitemap += sitemapUrlLine(url, 'monthly', '0.65', todayIso);
  }
  for (const p of seoPorts) {
    const url = `${BASE_URL}/ports/${p.slug}/`;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    sitemap += sitemapUrlLine(url, 'monthly', '0.65', todayIso);
  }
  sitemap += '</urlset>';
  fs.writeFileSync(path.join(repoRoot, 'sitemap.xml'), sitemap, 'utf8');
  const sitemapValid = sitemap.includes('<?xml') && sitemap.includes('<urlset') && sitemap.includes('</urlset>');
  if (!sitemapValid) console.warn('[warn] sitemap.xml may be invalid');
  console.log('Wrote sitemap.xml with', seenUrls.size, 'URLs (no duplicates)');

  // Scan every generated file for CDN URLs, SVG thumbnails, nested anchors,
  // and HTTP reachability. Throws on any violation — build fails loudly.
  await runPostBuildValidation(blogDir, repoRoot, articles, seoShips, seoPorts);

  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

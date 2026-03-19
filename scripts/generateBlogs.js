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
const DEFAULT_FAVICON = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
const LOGO_URL = 'https://seadays.app/logo.png';
const HTTP_TIMEOUT_MS = Math.max(10000, Number(process.env.GENERATE_BLOGS_HTTP_TIMEOUT_MS || 60000));
const HTTP_MAX_RETRIES = Math.max(0, Number(process.env.GENERATE_BLOGS_HTTP_RETRIES || 3));
const HTTP_RETRY_BASE_DELAY_MS = Math.max(200, Number(process.env.GENERATE_BLOGS_HTTP_RETRY_BASE_DELAY_MS || 1200));

// ---------------------------------------------------------------------------
// Base64 image upload (optional; requires SUPABASE_SERVICE_ROLE_KEY)
// Deduplicates by hash, skips re-upload if already in cache, production-safe fallback
// ---------------------------------------------------------------------------

const base64UrlCache = new Map();
const imageStats = { uploaded: 0, removed: 0 };
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

/**
 * Resolve image URL: upload base64 to storage, or return null if upload fails.
 * For HTTP URLs: returns HTTPS version. Never returns base64.
 * When base64 upload fails (e.g. no SUPABASE_SERVICE_ROLE_KEY): returns null.
 * Callers must use DEFAULT_FAVICON for og:image/twitter:image when null.
 */
async function resolveImageUrl(url, articleId, index = 0) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.startsWith('data:image')) {
    if (trimmed.startsWith('http://')) return trimmed.replace(/^http:\/\//, 'https://');
    return trimmed;
  }
  const uploaded = await uploadBase64ToStorage(trimmed, articleId, index);
  if (uploaded) imageStats.uploaded++;
  else imageStats.removed++;
  return uploaded || null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeHtml(s) {
  if (s == null || s === '') return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildRedirectPage(slug) {
  const target = '/blog/' + encodeURI(slug) + '/';
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
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
            let src = img.url;
            if (src.startsWith('data:image')) {
              const uploaded = await uploadBase64ToStorage(src, articleId, imgIndex++);
              if (uploaded) src = uploaded;
              else continue;
            }
            const alt = escapeHtml(img.alt || img.caption || section.heading || 'Article image');
            const cap = img.caption ? `<figcaption>${escapeHtml(img.caption)}</figcaption>` : '';
            const safeSrc = src.startsWith('http://') ? src.replace(/^http:\/\//, 'https://') : src;
            parts.push(`<figure><img src="${escapeHtml(safeSrc)}" alt="${alt}" loading="lazy" decoding="async" style="max-width:100%;height:auto;border-radius:12px;">${cap}</figure>`);
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
  const regex = /<img([^>]*)\ssrc=["'](data:image\/[^"']+)["']([^>]*)>/gi;
  let match;
  const replacements = [];
  while ((match = regex.exec(html)) !== null) {
    const [full, before, dataUrl, after] = match;
    const uploaded = await uploadBase64ToStorage(dataUrl, articleId, replacements.length);
    if (uploaded) imageStats.uploaded++;
    else imageStats.removed++;
    const hasLazy = /loading\s*=\s*["']lazy["']/i.test(before + after);
    const hasDecoding = /decoding\s*=\s*["']async["']/i.test(before + after);
    const lazyAttr = hasLazy ? '' : ' loading="lazy"';
    const decodingAttr = hasDecoding ? '' : ' decoding="async"';
    if (uploaded) {
      const safeUrl = uploaded.startsWith('http://') ? uploaded.replace(/^http:\/\//, 'https://') : uploaded;
      replacements.push({ full, replacement: `<img${before} src="${escapeHtml(safeUrl)}"${lazyAttr}${decodingAttr}${after}>` });
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
  return result;
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
    return formatContentToHtml(content);
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

function injectContextualLinks(bodyHtml, relatedArticles, maxLinks = 4) {
  if (!relatedArticles.length || !bodyHtml) return bodyHtml;
  const links = relatedArticles.slice(0, maxLinks).map(
    (a) => `<a href="/blog/${a.slug}" class="contextual-link">${escapeHtml(a.title || 'Read more')}</a>`
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
    req.setTimeout(HTTP_TIMEOUT_MS, () => { req.destroy(); reject(new Error(`Timeout after ${HTTP_TIMEOUT_MS}ms`)); });
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(err) {
  if (!err || !err.message) return false;
  const msg = String(err.message);
  if (/Timeout after/i.test(msg)) return true;
  if (/ECONNRESET|ETIMEDOUT|EAI_AGAIN|ENOTFOUND|socket hang up/i.test(msg)) return true;
  if (/^HTTP (408|425|429|500|502|503|504)/i.test(msg)) return true;
  return false;
}

async function httpsGetWithRetry(url, headers = {}, opts = {}) {
  const maxRetries = typeof opts.maxRetries === 'number' ? opts.maxRetries : HTTP_MAX_RETRIES;
  const baseDelayMs = typeof opts.baseDelayMs === 'number' ? opts.baseDelayMs : HTTP_RETRY_BASE_DELAY_MS;
  let lastErr = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await httpsGet(url, headers);
    } catch (err) {
      lastErr = err;
      const canRetry = attempt < maxRetries && isRetryableError(err);
      if (!canRetry) throw err;
      const waitMs = baseDelayMs * Math.pow(2, attempt);
      console.warn(`[retry] ${url} failed (${err.message}); retrying in ${waitMs}ms (attempt ${attempt + 1}/${maxRetries})`);
      await sleep(waitMs);
    }
  }
  throw lastErr || new Error('Request failed');
}

async function fetchArticles() {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    console.warn('SUPABASE_ANON_KEY not set. Cannot fetch articles.');
    return { articles: [] };
  }
  const url = EDGE_BASE + '/portside-articles?limit=500&forWebsite=1';
  const data = await httpsGetWithRetry(url, {
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
    const data = await httpsGetWithRetry(url, {
      Authorization: 'Bearer ' + key,
      apikey: key,
    }, { maxRetries: 2 });
    return data?.article || null;
  } catch {
    return null;
  }
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
`;

async function buildArticleHtml(article, bodyHtml, prevArticle, nextArticle, moreArticles) {
  const title = escapeHtml(article.seoTitle || article.title || 'Article');
  const description = escapeHtml(
    (article.seoDescription || article.excerpt || article.metaDescription || '').trim() ||
    stripHtmlToPlainText(article.content || bodyHtml, 160)
  );
  const rawOgImage = (article.ogImage || article.heroImageUrl || article.thumbnailUrl || DEFAULT_FAVICON).trim();
  const ogImageResolved = await resolveImageUrl(rawOgImage, article.id, 'og');
  const ogImage = ogImageResolved || DEFAULT_FAVICON;
  const canonicalUrl = BASE_URL + '/blog/' + article.slug;
  const rawHeroImg = (article.heroImageUrl || article.thumbnailUrl || '').trim();
  const heroImg = rawHeroImg ? await resolveImageUrl(rawHeroImg, article.id, 'hero') : null;

  let navHtml = '';
  if (prevArticle) {
    navHtml += `<a href="/blog/${prevArticle.slug}" class="article-nav-prev"><span class="article-nav-label">Previous</span><span>${escapeHtml(prevArticle.title || 'Previous')}</span></a>`;
  }
  if (nextArticle) {
    navHtml += `<a href="/blog/${nextArticle.slug}" class="article-nav-next"><span class="article-nav-label">Next</span><span>${escapeHtml(nextArticle.title || 'Next')}</span></a>`;
  }

  let moreHtml = '';
  if (moreArticles.length > 0) {
    const moreCards = [];
    for (let i = 0; i < moreArticles.length; i++) {
      const a = moreArticles[i];
      const rawImg = (a.heroImageUrl || a.thumbnailUrl || '').trim();
      const img = rawImg ? await resolveImageUrl(rawImg, a.id, 'more-' + i) : null;
      const imgTag = img ? `<img src="${escapeHtml(img.startsWith('http://') ? img.replace(/^http:\/\//, 'https://') : img)}" alt="" class="more-card-image" loading="lazy" decoding="async">` : '';
      moreCards.push(`<a href="/blog/${a.slug}" class="more-card">${imgTag}<div class="more-card-body"><h3 class="more-card-title">${escapeHtml(a.title || 'Untitled')}</h3><p class="more-card-excerpt">${escapeHtml(a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 120) : '') || '')}</p></div></a>`);
    }
    moreHtml = '<section class="more-to-read"><h2>More to Read</h2><div class="more-to-read-grid" data-shuffle-more>' + moreCards.join('') + '</div></section>';
  }

  const navSection = navHtml ? `<nav class="article-nav" aria-label="Article navigation">${navHtml}</nav>` : '';

  const publishedIso = formatIsoDate(article.publishedAt || article.timestamp || article.createdAt);
  const modifiedIso = formatIsoDate(article.updatedAt || article.publishedAt || article.timestamp);
  const authorName = escapeHtml(article.author || 'Anonymous');
  const articleBodyText = stripHtmlToPlainText(bodyHtml, 5000);
  const keywords = Array.isArray(article.tags) && article.tags.length
    ? article.tags.map((t) => (typeof t === 'string' ? t : t?.name)).filter(Boolean)
    : (article.keywords && Array.isArray(article.keywords) ? article.keywords : []);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: escapeHtml(article.title || 'Article'),
    description: description || articleBodyText.slice(0, 160) || undefined,
    image: [ogImage],
    author: { '@type': 'Person', name: authorName },
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
            <span class="author">${escapeHtml(article.author || 'Anonymous')}</span>
            <span>${formatDate(article.publishedAt || article.timestamp || article.updatedAt)}</span>
            ${article.readTime ? `<span>${escapeHtml(String(article.readTime))} min read</span>` : ''}
          </div>
          ${heroImg ? `<img src="${escapeHtml(heroImg.startsWith('http://') ? heroImg.replace(/^http:\/\//, 'https://') : heroImg)}" alt="${escapeHtml(article.title || 'Article')}" class="article-hero-image" loading="lazy" decoding="async">` : ''}
        </div>
        <div class="article-body">${bodyHtml}</div>
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
    (function(){var g=document.querySelector('.more-to-read-grid[data-shuffle-more]');if(!g)return;var cards=[].slice.call(g.querySelectorAll('.more-card'));if(cards.length<=4)return;for(var i=cards.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=cards[i];cards[i]=cards[j];cards[j]=t;}g.innerHTML='';cards.forEach(function(c,i){g.appendChild(c);if(i>=4)c.style.display='none';});})();
  </script>
</body>
</html>`;
}

async function buildHomePageBlogCards(articles) {
  if (articles.length === 0) return '<div id="blogGrid" class="blog-section-grid" style="display:none;"></div>\n                <div id="blogEmpty" class="blog-empty" style="display:block;">No posts yet. Check back soon for stories and tips.</div>';
  const cards = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const rawImg = (a.heroImageUrl || a.thumbnailUrl || '').trim();
    const img = rawImg ? await resolveImageUrl(rawImg, a.id, 'home-' + i) : null;
    const excerpt = (a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 140) : '') || '') + (a.excerpt || a.content ? '...' : '');
    const imgTag = img ? `<img src="${escapeHtml(img.startsWith('http://') ? img.replace(/^http:\/\//, 'https://') : img)}" alt="${escapeHtml(a.title || 'Article')}" class="blog-card-image" loading="lazy" decoding="async">` : '';
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
  const cards = [];
  for (let i = 0; i < articles.length; i++) {
    const a = articles[i];
    const rawImg = (a.heroImageUrl || a.thumbnailUrl || '').trim();
    const img = rawImg ? await resolveImageUrl(rawImg, a.id, 'index-' + i) : null;
    const excerpt = a.excerpt || (a.content ? String(a.content).replace(/<[^>]+>/g, '').slice(0, 150) : '') || '';
    const imgTag = img ? `<img src="${escapeHtml(img.startsWith('http://') ? img.replace(/^http:\/\//, 'https://') : img)}" alt="" class="article-card-image" loading="lazy" decoding="async">` : '';
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
  <meta name="description" content="SeaDays Blog - Cruise tips, guides & stories from the community. Plan smarter, pack lighter, and cruise better with expert advice and real experiences.">
  <title>SeaDays Blog | Cruise Tips, Guides &amp; Stories</title>
  <link rel="canonical" href="${BASE_URL}/blog/">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
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
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>
    </header>
    <section class="blog-hero">
      <div class="container">
        <h1>Blog</h1>
        <p>Stories, tips, and experiences shared by the SeaDays community.</p>
      </div>
    </section>
    <div class="container">
      <div class="blog-grid">${cards.join('\n')}</div>
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
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.SUPABASE_ANON_KEY) {
    console.error('SUPABASE_ANON_KEY is required. Set it in environment or .env.');
    process.exit(1);
  }

  const repoRoot = path.join(__dirname, '..');
  const blogDir = path.join(repoRoot, 'blog');

  imageStats.uploaded = 0;
  imageStats.removed = 0;
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

  fs.mkdirSync(blogDir, { recursive: true });

  for (let i = 0; i < articles.length; i++) {
    const article = articles[i];
    const full = await fetchFullArticle(article.id);
    if (full) {
      article.content = full.content;
      article.structuredContent = full.structuredContent;
    }
    let bodyHtml = await getArticleBodyHtml(article);
    const prev = i > 0 ? articles[i - 1] : null;
    const next = i < articles.length - 1 ? articles[i + 1] : null;
    const morePool = articles.filter((x) => x.id !== article.id);
    const more = morePool.slice(0, 12);
    const excludeIds = new Set([article.id, ...more.map((a) => a.id)]);
    const relatedForInjection = findRelatedArticles(article, articles, excludeIds, 4);
    bodyHtml = injectContextualLinks(bodyHtml, relatedForInjection, 4);
    const html = await buildArticleHtml(article, bodyHtml, prev, next, more);
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

  const staticUrls = [
    { loc: BASE_URL + '/', changefreq: 'weekly', priority: '1.0' },
    { loc: BASE_URL + '/index.html', changefreq: 'weekly', priority: '1.0' },
    { loc: BASE_URL + '/blog/', changefreq: 'daily', priority: '0.9' },
    { loc: BASE_URL + '/landing-page.html', changefreq: 'weekly', priority: '0.8' },
  ];
  let sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
  const seenUrls = new Set();
  for (const u of staticUrls) {
    if (seenUrls.has(u.loc)) continue;
    seenUrls.add(u.loc);
    sitemap += '  <url><loc>' + escapeXml(u.loc) + '</loc><changefreq>' + u.changefreq + '</changefreq><priority>' + u.priority + '</priority></url>\n';
  }
  for (const a of articles) {
    const url = BASE_URL + '/blog/' + a.slug;
    if (seenUrls.has(url)) continue;
    seenUrls.add(url);
    sitemap += '  <url><loc>' + escapeXml(url) + '</loc><changefreq>monthly</changefreq><priority>0.7</priority></url>\n';
  }
  sitemap += '</urlset>';
  fs.writeFileSync(path.join(repoRoot, 'sitemap.xml'), sitemap, 'utf8');
  const sitemapValid = sitemap.includes('<?xml') && sitemap.includes('<urlset') && sitemap.includes('</urlset>');
  if (!sitemapValid) console.warn('[warn] sitemap.xml may be invalid');
  const base64Check = (html) => !html.includes('data:image');
  const sampleHtml = articles.length ? fs.readFileSync(path.join(blogDir, articles[0].slug, 'index.html'), 'utf8') : '';
  if (sampleHtml && !base64Check(sampleHtml)) console.warn('[warn] base64 images may remain in output');
  console.log('Wrote sitemap.xml with', seenUrls.size, 'URLs (no duplicates)');
  console.log('Done.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

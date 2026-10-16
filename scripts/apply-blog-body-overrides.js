#!/usr/bin/env node
'use strict';

/**
 * Apply data/blog-body-overrides/<slug>.html into existing blog/<slug>/index.html
 * without a full CMS regenerate.
 */

const fs = require('fs');
const path = require('path');
const { applyBlogStoreCtasToHtml } = require('./lib/blogStoreCta');

const ROOT = path.join(__dirname, '..');
const OVERRIDE_DIR = path.join(ROOT, 'data', 'blog-body-overrides');
const META_PATH = path.join(OVERRIDE_DIR, 'meta.json');

function stripHtmlToPlainText(html, max) {
  const text = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  if (!max || text.length <= max) return text;
  return text.slice(0, max).trim();
}

function escapeAttr(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

/**
 * Replace the article-body element, including nested divs such as store CTAs.
 * @param {string} html
 * @param {string} body
 * @returns {string}
 */
function replaceArticleBody(html, body) {
  const open = '<div class="article-body">';
  const start = html.indexOf(open);
  if (start < 0) return '';
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('<div', i)) {
      depth += 1;
      i += 4;
      continue;
    }
    if (html.startsWith('</div>', i)) {
      depth -= 1;
      i += 6;
      if (depth === 0) {
        return `${html.slice(0, start)}${open}${body}</div>${html.slice(i)}`;
      }
      continue;
    }
    i += 1;
  }
  return '';
}

function applyOverride(slug, meta) {
  const body = fs.readFileSync(path.join(OVERRIDE_DIR, `${slug}.html`), 'utf8').trim();
  const indexPath = path.join(ROOT, 'blog', slug, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing ${indexPath}`);
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  const next = replaceArticleBody(html, body);
  if (!next) {
    throw new Error(`Could not find article-body block in ${slug}`);
  }
  html = next;
  const plain = stripHtmlToPlainText(body, 5000);
  const desc = meta && meta.description ? String(meta.description) : '';
  if (desc) {
    const attr = escapeAttr(desc);
    html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${attr}">`);
    html = html.replace(
      /<meta property="og:description" content="[^"]*">/,
      `<meta property="og:description" content="${attr}">`
    );
    html = html.replace(
      /<meta property="twitter:description" content="[^"]*">/,
      `<meta property="twitter:description" content="${attr}">`
    );
    html = html.replace(
      /("headline":"[^"]+","description":")((?:\\.|[^"\\])*)(")/,
      `$1${JSON.stringify(desc).slice(1, -1)}$3`
    );
  }
  if (meta && meta.readMins) {
    html = html.replace(/<span>\d+ min read<\/span>/, `<span>${Number(meta.readMins)} min read</span>`);
  }
  if (meta && meta.dateModified) {
    const iso = String(meta.dateModified);
    html = html.replace(/"dateModified":"[^"]*"/, `"dateModified":"${iso}"`);
  }
  html = html.replace(
    /("articleBody":")((?:\\.|[^"\\])*)(")/,
    (_m, pre, _old, post) => pre + JSON.stringify(plain).slice(1, -1) + post
  );
  html = applyBlogStoreCtasToHtml(html, slug);
  fs.writeFileSync(indexPath, html, 'utf8');
  return { slug, words: plain.split(/\s+/).filter(Boolean).length };
}

function main() {
  if (!fs.existsSync(OVERRIDE_DIR)) {
    console.log('No blog-body-overrides directory');
    return;
  }
  let metaAll = {};
  if (fs.existsSync(META_PATH)) {
    metaAll = JSON.parse(fs.readFileSync(META_PATH, 'utf8'));
  }
  const files = fs.readdirSync(OVERRIDE_DIR).filter((f) => f.endsWith('.html'));
  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    const result = applyOverride(slug, metaAll[slug] || {});
    console.log(`applied override ${result.slug} (${result.words} words)`);
  }
}

main();

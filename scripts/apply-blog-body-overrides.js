#!/usr/bin/env node
'use strict';

/**
 * Apply data/blog-body-overrides/<slug>.html into existing blog/<slug>/index.html
 * without a full CMS regenerate.
 */

const fs = require('fs');
const path = require('path');

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

function applyOverride(slug, meta) {
  const body = fs.readFileSync(path.join(OVERRIDE_DIR, `${slug}.html`), 'utf8').trim();
  const indexPath = path.join(ROOT, 'blog', slug, 'index.html');
  if (!fs.existsSync(indexPath)) {
    throw new Error(`Missing ${indexPath}`);
  }
  let html = fs.readFileSync(indexPath, 'utf8');
  if (!/<div class="article-body">[\s\S]*?<\/div>\s*<section class="same-topic-section"/i.test(html)) {
    throw new Error(`Could not find article-body block in ${slug}`);
  }
  html = html.replace(
    /<div class="article-body">[\s\S]*?<\/div>\s*(<section class="same-topic-section")/i,
    `<div class="article-body">${body}</div>\n        $1`
  );
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
  }
  if (meta && meta.readMins) {
    html = html.replace(/<span>\d+ min read<\/span>/, `<span>${Number(meta.readMins)} min read</span>`);
  }
  html = html.replace(
    /("articleBody":")((?:\\.|[^"\\])*)(")/,
    (_m, pre, _old, post) => pre + JSON.stringify(plain).slice(1, -1) + post
  );
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

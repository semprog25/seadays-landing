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

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function applyVisibleTitle(html, title) {
  const attr = escapeAttr(title);
  const text = escapeHtml(title);
  let next = html.replace(/<title>[^<]*<\/title>/, `<title>${text} | SeaDays</title>`);
  next = next.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${attr}">`);
  next = next.replace(/<meta property="twitter:title" content="[^"]*">/, `<meta property="twitter:title" content="${attr}">`);
  next = next.replace(/<h1>[^<]*<\/h1>/, `<h1>${text}</h1>`);
  next = next.replace(/("headline":")((?:\\.|[^"\\])*)(")/, `$1${JSON.stringify(title).slice(1, -1)}$3`);
  next = next.replace(
    /(<nav class="article-breadcrumbs"[\s\S]*?<span>)[^<]*(<\/span><\/nav>)/,
    `$1${text}$2`
  );
  return next;
}

function cardSnippet(description) {
  const text = String(description || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 180) return text;
  return `${text.slice(0, 177).trim()}...`;
}

function refreshCardsForSlug(html, slug, title, description) {
  const href = `/blog/${slug}/`;
  if (!html.includes(href)) return html;
  return html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/g, (anchor) => {
    if (!anchor.includes(href)) return anchor;
    const hasTitle = anchor.includes('more-card-title') || anchor.includes('article-card-title');
    const hasExcerpt = anchor.includes('more-card-excerpt') || anchor.includes('article-card-excerpt');
    if (!hasTitle && !hasExcerpt) return anchor;
    let next = anchor;
    if (title && hasTitle) {
      next = next.replace(
        /(<h3 class="(?:more-card-title|article-card-title)">)[\s\S]*?(<\/h3>)/,
        `$1${escapeHtml(title)}$2`
      );
      next = next.replace(/(<img\b[^>]*\balt=")[^"]*(")/, `$1${escapeAttr(title)}$2`);
    }
    if (description && hasExcerpt) {
      next = next.replace(
        /(<p class="(?:more-card-excerpt|article-card-excerpt)">)[\s\S]*?(<\/p>)/,
        `$1${escapeHtml(cardSnippet(description))}$2`
      );
    }
    return next;
  });
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
  if (meta && meta.title) {
    html = applyVisibleTitle(html, String(meta.title));
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
  const args = process.argv.slice(2);
  const cardsOnly = args.includes('--cards-only');
  const only = args.filter((arg) => arg !== '--cards-only');
  const files = fs.readdirSync(OVERRIDE_DIR).filter((f) => f.endsWith('.html'));
  if (!cardsOnly) {
  for (const file of files) {
    const slug = file.replace(/\.html$/, '');
    if (only.length && !only.includes(slug)) continue;
    const result = applyOverride(slug, metaAll[slug] || {});
    console.log(`applied override ${result.slug} (${result.words} words)`);
  }
  }
  refreshRelatedCards(metaAll, only);
}

function refreshRelatedCards(metaAll, only) {
  const slugs = Object.keys(metaAll).filter((slug) => {
    if (only.length && !only.includes(slug)) return false;
    const meta = metaAll[slug] || {};
    return meta.title || meta.description;
  });
  if (!slugs.length) return;
  const files = [];
  const blogDir = path.join(ROOT, 'blog');
  for (const ent of fs.readdirSync(blogDir, { withFileTypes: true })) {
    const file = ent.isDirectory()
      ? path.join(blogDir, ent.name, 'index.html')
      : (ent.name.endsWith('.html') ? path.join(blogDir, ent.name) : '');
    if (file && fs.existsSync(file)) files.push(file);
  }
  const home = path.join(ROOT, 'index.html');
  if (fs.existsSync(home)) files.push(home);
  let changed = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    for (const slug of slugs) {
      const meta = metaAll[slug];
      if (!meta.title && !meta.description) continue;
      html = refreshCardsForSlug(html, slug, meta.title || '', meta.description || '');
    }
    if (html !== before) {
      fs.writeFileSync(file, html);
      changed += 1;
    }
  }
  console.log(`refreshed related cards in ${changed} files`);
}

main();

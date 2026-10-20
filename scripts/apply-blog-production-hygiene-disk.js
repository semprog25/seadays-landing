#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { applyBlogProductionHygieneToHtml } = require('./lib/blogProductionHygiene');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');

function patchBlogArticleFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const next = raw.replace(
    /<div class="article-body">([\s\S]*?)<\/div>\s*<aside class="get-seadays-cta"/,
    (_m, body) =>
      `<div class="article-body">${applyBlogProductionHygieneToHtml(body)}</div><aside class="get-seadays-cta"`
  );
  if (next !== raw) fs.writeFileSync(filePath, next, 'utf8');
  return next !== raw;
}

function main() {
  let patched = 0;
  for (const ent of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const index = path.join(BLOG, ent.name, 'index.html');
    if (!fs.existsSync(index)) continue;
    if (patchBlogArticleFile(index)) patched += 1;
  }
  console.log(`[apply-blog-production-hygiene-disk] patched ${patched} article bodies`);
}

main();

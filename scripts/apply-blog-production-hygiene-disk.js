#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  extractArticleBodyFromPage,
  replaceArticleBodyInPage,
  measureInlineBoldDensity,
  reduceExcessiveInlineBold,
} = require('./lib/blogProductionHygiene');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');

function patchBlogArticleFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const slot = extractArticleBodyFromPage(raw);
  if (!slot) return false;
  if (measureInlineBoldDensity(slot.body).per100 <= 3) return false;
  const nextBody = reduceExcessiveInlineBold(slot.body);
  if (nextBody === slot.body) return false;
  const next = replaceArticleBodyInPage(raw, nextBody);
  if (next === raw) return false;
  fs.writeFileSync(filePath, next, 'utf8');
  return true;
}

function main() {
  let patched = 0;
  for (const ent of fs.readdirSync(BLOG, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const index = path.join(BLOG, ent.name, 'index.html');
    if (!fs.existsSync(index)) continue;
    if (patchBlogArticleFile(index)) patched += 1;
  }
  console.log(`[apply-blog-production-hygiene-disk] SD-07 patched ${patched} article bodies`);
}

main();

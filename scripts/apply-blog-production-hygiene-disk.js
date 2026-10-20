#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  extractArticleBodyFromPage,
  replaceArticleBodyInPage,
  measureInlineBoldDensity,
  reduceExcessiveInlineBold,
  applyBlogProductionHygieneToHtml,
} = require('./lib/blogProductionHygiene');

const ROOT = path.join(__dirname, '..');
const BLOG = path.join(ROOT, 'blog');

function patchBlogArticleFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const slot = extractArticleBodyFromPage(raw);
  if (!slot) return false;
  let nextBody = applyBlogProductionHygieneToHtml(slot.body);
  nextBody = reduceExcessiveInlineBold(nextBody);
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
  console.log(`[apply-blog-production-hygiene-disk] patched ${patched} article bodies (SD-07 + SD-28 hygiene)`);
}

main();

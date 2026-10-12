#!/usr/bin/env node
/**
 * Apply the blog store CTA template to existing generated articles.
 * Uses the same inserter as generateBlogs.js so a CMS refetch is not required
 * and article copy, images, and structure stay put.
 *
 * Usage: node scripts/inject-blog-store-ctas.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { applyBlogStoreCtasToHtml } = require('./lib/blogStoreCta');

const ROOT = path.join(__dirname, '..');
const BLOG_DIR = path.join(ROOT, 'blog');

function main() {
  const entries = fs.readdirSync(BLOG_DIR, { withFileTypes: true });
  let updated = 0;
  let skipped = 0;
  let unchanged = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const filePath = path.join(BLOG_DIR, slug, 'index.html');
    if (!fs.existsSync(filePath)) continue;
    const before = fs.readFileSync(filePath, 'utf8');
    if (!before.includes('<div class="article-body">') || /http-equiv=["']refresh["']/i.test(before)) {
      skipped += 1;
      continue;
    }
    const after = applyBlogStoreCtasToHtml(before, slug);
    if (after === before) {
      unchanged += 1;
      continue;
    }
    fs.writeFileSync(filePath, after, 'utf8');
    updated += 1;
  }

  console.log(JSON.stringify({ updated, unchanged, skipped }, null, 2));
}

main();

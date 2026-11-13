#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { patchBlogArticleNavAndMoreCardTitles } = require('./repair-blog-article-nav-cms-titles');

const repoRoot = path.join(__dirname, '..');

function loadTitleCorrections() {
  const file = path.join(repoRoot, 'data', 'blog-article-corrections.json');
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  return parsed.titleBySourceSlug;
}

function testPatchNavUsesApprovedTitle() {
  const map = {
    'cvs-celebrity-edge-modern-cruise-ship-comparison':
      'Norwegian Prima vs Celebrity Edge: Modern Cruise Ship Comparison',
  };
  const html = `<nav class="article-nav" aria-label="Article navigation"><a href="/blog/cvs-celebrity-edge-modern-cruise-ship-comparison/" class="article-nav-next"><span class="article-nav-label">Next</span><span>cvs Celebrity Edge: Modern Cruise Ship Comparison</span></a></nav>`;
  const { html: out, changed } = patchBlogArticleNavAndMoreCardTitles(html, map);
  assert.equal(changed, true);
  assert.match(out, /Norwegian Prima vs Celebrity Edge/);
  assert.doesNotMatch(out, /cvs Celebrity/);
}

function testCommittedBlogNavMatchesCorrections() {
  const corrections = loadTitleCorrections();
  const blogDir = path.join(repoRoot, 'blog');
  const failures = [];
  for (const pageSlug of fs.readdirSync(blogDir)) {
    const dir = path.join(blogDir, pageSlug);
    if (!fs.statSync(dir).isDirectory()) continue;
    const file = path.join(dir, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const nav = html.match(/<nav class="article-nav"[^>]*>([\s\S]*?)<\/nav>/);
    if (!nav) continue;
    const re =
      /<a href="\/blog\/([^"]+)\/"[^>]*>[\s\S]*?<span class="article-nav-label">[^<]*<\/span><span>([^<]*)<\/span><\/a>/gi;
    let m;
    while ((m = re.exec(nav[1]))) {
      const target = m[1].replace(/\/$/, '');
      const shown = m[2].trim();
      const expected = corrections[target];
      if (expected && shown !== expected) failures.push(`${pageSlug} → ${target}`);
    }
    if (/cvs Celebrity/i.test(html)) failures.push(`${pageSlug}: cvs typo leak`);
  }
  assert.deepStrictEqual(failures, [], failures.join('; '));
}

testPatchNavUsesApprovedTitle();
testCommittedBlogNavMatchesCorrections();

console.log('OK blog article-nav CMS titles');

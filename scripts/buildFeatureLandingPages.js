#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { FEATURE_PAGES, buildFeatureLandingPageHtml } = require('./lib/seoFeatureLandingPages');

const repoRoot = path.join(__dirname, '..');

for (const page of FEATURE_PAGES) {
  const dir = path.join(repoRoot, page.slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, 'index.html');
  fs.writeFileSync(out, buildFeatureLandingPageHtml(page), 'utf8');
  console.log('Wrote', path.relative(repoRoot, out));
}

console.log('Done. Feature landing pages:', FEATURE_PAGES.length);

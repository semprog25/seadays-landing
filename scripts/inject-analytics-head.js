#!/usr/bin/env node
/**
 * Inject shared GA4 + Consent Mode head snippet into existing static HTML.
 * Also ensures the AdSense account meta (verification only, no ad script).
 * Used so generated pages get analytics without a full Supabase regenerate.
 * Generators also embed the same snippet for future builds.
 *
 * Usage: node scripts/inject-analytics-head.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { injectAnalyticsHead, stripAnalyticsFromHtml } = require('./lib/analyticsSnippet');

const ROOT = path.join(__dirname, '..');

const SKIP_BASENAMES = new Set([
  'blog.html', // redirect-only → avoid duplicate page_view with /blog/
  'landing-page.html', // redirect-only → root
]);

const SKIP_RELATIVE = new Set([
  'auth/redirect.html', // OAuth helper — no marketing analytics
]);

function shouldProcess(relPath) {
  const base = path.basename(relPath);
  if (SKIP_BASENAMES.has(base)) return false;
  if (SKIP_RELATIVE.has(relPath.replace(/\\/g, '/'))) return false;
  if (relPath.includes('node_modules')) return false;
  return true;
}

function walkHtmlFiles(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = path.relative(ROOT, full);
    const st = fs.statSync(full);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.git') continue;
      walkHtmlFiles(full, out);
    } else if (name.endsWith('.html')) {
      out.push(full);
    }
  }
}

function stripOnly(relPath) {
  return SKIP_BASENAMES.has(path.basename(relPath)) || SKIP_RELATIVE.has(relPath.replace(/\\/g, '/'));
}

function main() {
  const files = [];
  walkHtmlFiles(ROOT, files);

  let injected = 0;
  let stripped = 0;
  let unchanged = 0;

  for (const full of files) {
    const rel = path.relative(ROOT, full).replace(/\\/g, '/');
    const before = fs.readFileSync(full, 'utf8');

    if (stripOnly(rel)) {
      const after = stripAnalyticsFromHtml(before);
      if (after !== before) {
        fs.writeFileSync(full, after, 'utf8');
        stripped += 1;
        console.log('stripped', rel);
      } else {
        unchanged += 1;
      }
      continue;
    }

    if (!shouldProcess(rel)) {
      unchanged += 1;
      continue;
    }

    const after = injectAnalyticsHead(before);
    if (after !== before) {
      fs.writeFileSync(full, after, 'utf8');
      injected += 1;
      console.log('injected', rel);
    } else {
      unchanged += 1;
    }
  }

  console.log(
    JSON.stringify({ injected, stripped, unchanged, total: files.length }, null, 2)
  );
}

main();

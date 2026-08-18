#!/usr/bin/env node
'use strict';

/**
 * Replace signed / private storage URLs in existing static HTML with stable public URLs.
 * Does not commit, push, or deploy. Safe to re-run.
 */

const fs = require('fs');
const path = require('path');
const {
  resolveImageUrl,
  isSignedStorageUrl,
  getFallbackImage,
  replaceSignedStorageImgSrcInHtml,
} = require('./generateBlogs');

const ROOT = path.join(__dirname, '..');
const SIGNED_RE = /https:\/\/[^\s"'<>\\]+\/storage\/v1\/object\/sign\/[^\s"'<>\\]+/gi;

function walkHtmlFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'node_modules' || ent.name === '.git') continue;
      walkHtmlFiles(p, out);
    } else if (ent.isFile() && ent.name.endsWith('.html')) {
      out.push(p);
    }
  }
  return out;
}

function extractPublicOg(html) {
  const m =
    html.match(/property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
    html.match(/content=["']([^"']+)["']\s+property=["']og:image["']/i);
  const url = m && m[1] ? String(m[1]).trim() : '';
  if (!url) return '';
  if (isSignedStorageUrl(url)) return '';
  if (!/^https:\/\//i.test(url)) return '';
  if (/\/object\/public\//i.test(url) || /seadays\.app\/(?:og-image|logo)\.png/i.test(url)) return url;
  return '';
}

function patchRuntimeGuard(html) {
  if (!html.includes('function safeImage(src)')) return html;
  if (html.includes("/storage/v1/object/sign/")) return html;
  return html.replace(
    /function safeImage\(src\)\{\s*if\(!src\|\|!src\.startsWith\('https:\/\/'\)\)return FB;\s*if\(src\.includes\('cdn\.seadays\.app'\)\)return FB;/,
    "function safeImage(src){if(!src||!src.startsWith('https://'))return FB;if(src.includes('cdn.seadays.app'))return FB;if(src.indexOf('/storage/v1/object/sign/')!==-1)return FB;"
  );
}

async function main() {
  const files = [
    path.join(ROOT, 'index.html'),
    ...walkHtmlFiles(path.join(ROOT, 'blog')),
    ...walkHtmlFiles(path.join(ROOT, 'ships')),
    ...walkHtmlFiles(path.join(ROOT, 'ports')),
  ].filter((p, i, arr) => arr.indexOf(p) === i && fs.existsSync(p));

  const unique = new Map();
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    for (const m of html.match(SIGNED_RE) || []) unique.set(m, true);
  }
  const signedList = [...unique.keys()];
  console.log(`[strip-signed] ${signedList.length} unique signed URLs in ${files.length} HTML files`);

  const resolved = new Map();
  for (let i = 0; i < signedList.length; i++) {
    const signed = signedList[i];
    const publicUrl = await resolveImageUrl(signed, `strip-${i}`, i, {});
    if (publicUrl && !isSignedStorageUrl(publicUrl)) resolved.set(signed, publicUrl);
    else resolved.set(signed, null);
  }

  let filesChanged = 0;
  let replacements = 0;
  for (const file of files) {
    let html = fs.readFileSync(file, 'utf8');
    const before = html;
    const pageOg = extractPublicOg(html);
    html = html.replace(SIGNED_RE, (signed) => {
      replacements += 1;
      return resolved.get(signed) || pageOg || getFallbackImage(replacements);
    });
    html = patchRuntimeGuard(html);
    html = replaceSignedStorageImgSrcInHtml(html);
    if (html !== before) {
      fs.writeFileSync(file, html, 'utf8');
      filesChanged += 1;
    }
  }
  const leftover = [];
  for (const file of files) {
    const html = fs.readFileSync(file, 'utf8');
    const hits = html.match(SIGNED_RE) || [];
    if (hits.length) leftover.push({ file: path.relative(ROOT, file), n: hits.length });
  }
  console.log(`[strip-signed] filesChanged=${filesChanged} leftoverFiles=${leftover.length}`);
  if (leftover.length) {
    leftover.slice(0, 12).forEach((row) => console.warn('  leftover', row.file, row.n));
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

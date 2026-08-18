#!/usr/bin/env node
'use strict';

/** Patch empty more-card image alts from card titles in existing blog HTML. */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', 'blog');
let changed = 0;
let fixedImgs = 0;

function escapeAttr(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .trim();
}

for (const ent of fs.readdirSync(ROOT, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const indexPath = path.join(ROOT, ent.name, 'index.html');
  if (!fs.existsSync(indexPath)) continue;
  let html = fs.readFileSync(indexPath, 'utf8');
  const before = html;
  html = html.replace(
    /<a href="([^"]+)" class="more-card">([\s\S]*?)<div class="more-card-body"><h3 class="more-card-title">([^<]+)<\/h3>/gi,
    (full, href, inner, title) => {
      const safe = escapeAttr(title) || 'Related SeaDays article';
      const nextInner = inner.replace(
        /(<img\b[^>]*?\balt=")([^"]*)(")/i,
        (_m, pre, altVal, post) => {
          if (altVal && altVal.trim()) return _m;
          fixedImgs += 1;
          return `${pre}${safe}${post}`;
        }
      );
      if (nextInner === inner) return full;
      return `<a href="${href}" class="more-card">${nextInner}<div class="more-card-body"><h3 class="more-card-title">${title}</h3>`;
    }
  );
  if (html !== before) {
    fs.writeFileSync(indexPath, html, 'utf8');
    changed += 1;
  }
}

console.log(`[fix-more-card-alts] updated ${changed} blog pages, ${fixedImgs} images`);

#!/usr/bin/env node
'use strict';

const fs = require('fs');

const BAD_RE =
  /Websitehomebucket\/Cruise%20planner\.jpg|Websitehomebucket\/Discover%20Ships%20%20Ports\.jpg|SeadaysPublic\/seadaysfav\.png/i;

function main() {
  const files = process.argv.slice(2);
  const targets = files.length ? files : ['ports/index.html', 'ships/index.html'];
  let failed = false;
  for (const file of targets) {
    if (!fs.existsSync(file)) {
      console.error('missing', file);
      failed = true;
      continue;
    }
    const html = fs.readFileSync(file, 'utf8');
    const cards = [...html.matchAll(/<a class="guide-card"[^>]*>[\s\S]*?<img\b([^>]*)>/gi)];
    for (const match of cards) {
      const attrs = match[1] || '';
      const src = (attrs.match(/\bsrc="([^"]+)"/i) || [])[1] || '';
      const type = (attrs.match(/data-img-type="([^"]+)"/i) || [])[1] || '';
      if (type === 'fallback' || BAD_RE.test(src)) {
        console.error('PLACEHOLDER featured thumb in', file, src.slice(0, 120));
        failed = true;
      }
    }
  }
  if (failed) process.exit(1);
  console.log('featured thumbs OK');
}

main();

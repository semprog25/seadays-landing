#!/usr/bin/env node
'use strict';

/** No published page may carry a title or ship-name typo listed in data/title-fixes.json. */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTitleFixes, fixBlogTitle, fixShipName, applyTitleFixesToText } = require('./lib/titleFixes');

const root = path.join(__dirname, '..');
const fixes = loadTitleFixes();

assert.strictEqual(
  fixBlogTitle('cvs Celebrity Edge: Modern Cruise Ship Comparison'),
  'Norwegian Prima vs Celebrity Edge: Modern Cruise Ship Comparison'
);
assert.strictEqual(fixBlogTitle('Untouched Title'), 'Untouched Title');
assert.strictEqual(fixShipName('AIDANova'), 'AIDAnova');
assert.strictEqual(applyTitleFixesToText('line.\\nAIDAPrima is'), 'line.\\nAIDAprima is');

const bad = [
  ...Object.keys(fixes.blogTitles),
  ...Object.keys(fixes.inlinePhrases),
  ...Object.keys(fixes.shipNames),
];

function walk(dir, out) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (path.relative(root, full) === path.join('data', 'reports')) continue;
      walk(full, out);
    } else if (ent.name.endsWith('.html')) {
      out.push(full);
    }
  }
  return out;
}

const hits = [];
for (const file of walk(root, [])) {
  const html = fs.readFileSync(file, 'utf8');
  for (const s of bad) if (html.includes(s)) hits.push(`${path.relative(root, file)}: ${s}`);
}
assert.deepStrictEqual(hits, [], `title typos still published:\n${hits.join('\n')}`);
console.log(`title fixes ok (${bad.length} typo strings, 0 on published pages)`);

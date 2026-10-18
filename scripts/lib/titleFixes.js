'use strict';

/**
 * Title and ship-name typo corrections (data/title-fixes.json).
 * Applied when pages are generated, so a CMS or app-dataset value with a typo
 * does not reach the published HTML again.
 */

const fs = require('fs');
const path = require('path');

const FIXES_PATH = path.join(__dirname, '..', '..', 'data', 'title-fixes.json');
let cache = null;

function loadTitleFixes() {
  if (cache) return cache;
  try {
    const raw = JSON.parse(fs.readFileSync(FIXES_PATH, 'utf8'));
    cache = {
      blogTitles: raw.blogTitles || {},
      inlinePhrases: raw.inlinePhrases || {},
      shipNames: raw.shipNames || {},
    };
  } catch {
    cache = { blogTitles: {}, inlinePhrases: {}, shipNames: {} };
  }
  return cache;
}

function fixBlogTitle(title) {
  const t = String(title || '');
  const map = loadTitleFixes().blogTitles;
  return Object.prototype.hasOwnProperty.call(map, t.trim()) ? map[t.trim()] : t;
}

function fixShipName(name) {
  const n = String(name || '');
  const map = loadTitleFixes().shipNames;
  return Object.prototype.hasOwnProperty.call(map, n.trim()) ? map[n.trim()] : n;
}

/** Replace every known typo string inside free text or HTML. */
function applyTitleFixesToText(text) {
  let out = String(text || '');
  const { blogTitles, inlinePhrases, shipNames } = loadTitleFixes();
  for (const map of [blogTitles, inlinePhrases]) {
    for (const [from, to] of Object.entries(map)) out = out.split(from).join(to);
  }
  for (const [from, to] of Object.entries(shipNames)) out = out.split(from).join(to);
  return out;
}

module.exports = { loadTitleFixes, fixBlogTitle, fixShipName, applyTitleFixesToText };

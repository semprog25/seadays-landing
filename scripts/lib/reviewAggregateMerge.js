'use strict';

const fs = require('fs');
const path = require('path');

/**
 * SeaDays app repo root (parent of `src/`), from `seadays-landing-repo/scripts/lib/`.
 */
function getAppRepoRoot() {
  return path.join(__dirname, '..', '..', '..');
}

function readUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function loadCountryIdToDisplayName(appRoot) {
  const p = path.join(appRoot, 'src/utils/cruise-data/country-data.ts');
  const text = readUtf8(p);
  const map = new Map();
  const re = /(\w+):\s*\{\s*name:\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(text))) {
    map.set(m[1], m[2].replace(/\\'/g, "'"));
  }
  return map;
}

function loadCruiseLineFileToDisplayName(appRoot) {
  const p = path.join(appRoot, 'src/utils/cruise-data/cruise-lines-by-region.ts');
  const text = readUtf8(p);
  const map = new Map();
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'((?:\\'|[^'])*)'/g;
  let m;
  while ((m = re.exec(text))) {
    if (!map.has(m[1])) map.set(m[1], m[2].replace(/\\'/g, "'"));
  }
  return map;
}

function extractShipIdNamePairs(tsContent) {
  const idx = tsContent.indexOf('export const ships');
  const body = idx >= 0 ? tsContent.slice(idx) : tsContent;
  const out = [];
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = re.exec(body))) {
    out.push({ id: m[1], name: m[2].replace(/\\'/g, "'") });
  }
  return out;
}

function extractPortIdNamePairs(tsContent) {
  const idx = tsContent.indexOf('export const ports');
  const body = idx >= 0 ? tsContent.slice(idx) : tsContent;
  const out = [];
  const re = /\{\s*id:\s*'([^']+)'\s*,\s*name:\s*'((?:\\.|[^'\\])*)'/g;
  let m;
  while ((m = re.exec(body))) {
    out.push({ id: m[1], name: m[2].replace(/\\'/g, "'") });
  }
  return out;
}

/**
 * Maps landing ship page slug → KV review key (`ship.id` in app cruise data).
 */
function buildShipSlugToReviewKeyMap(appRoot, allShipsFromDataset) {
  const lineDisplay = loadCruiseLineFileToDisplayName(appRoot);
  const dir = path.join(appRoot, 'src/utils/cruise-data/ships/data');
  const parsed = [];
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  } catch {
    return new Map();
  }
  for (const file of files) {
    const lineId = file.replace(/\.ts$/, '');
    const display = lineDisplay.get(lineId) || lineId;
    const text = readUtf8(path.join(dir, file));
    for (const { id, name } of extractShipIdNamePairs(text)) {
      parsed.push({ reviewKey: id, name, lineDisplay: display });
    }
  }
  const map = new Map();
  const list = Array.isArray(allShipsFromDataset) ? allShipsFromDataset : [];
  for (const s of list) {
    const slug = String(s.slug || '').trim();
    const line = String(s.cruiseLine || '').trim();
    const name = String(s.name || '').trim();
    const hit = parsed.find((p) => p.name === name && p.lineDisplay === line);
    if (hit && slug) map.set(slug, hit.reviewKey);
  }
  return map;
}

function stripCountrySuffixFromPortLabel(label, country) {
  const l = String(label || '').trim();
  const c = String(country || '').trim();
  if (c && l.toLowerCase().endsWith(', ' + c.toLowerCase())) return l.slice(0, -(c.length + 2)).trim();
  return l;
}

/**
 * Maps landing port page slug → KV review key (`port.id` in app cruise data).
 */
function buildPortSlugToReviewKeyMap(appRoot, allPortsFromDataset) {
  const countryNames = loadCountryIdToDisplayName(appRoot);
  const dir = path.join(appRoot, 'src/utils/cruise-data/ports/data');
  const parsed = [];
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  } catch {
    return new Map();
  }
  for (const file of files) {
    const countryId = file.replace(/\.ts$/, '');
    const countryDisplay = countryNames.get(countryId) || countryId;
    const text = readUtf8(path.join(dir, file));
    for (const { id, name } of extractPortIdNamePairs(text)) {
      parsed.push({ reviewKey: id, name, countryDisplay });
    }
  }
  const map = new Map();
  const list = Array.isArray(allPortsFromDataset) ? allPortsFromDataset : [];
  for (const p of list) {
    const slug = String(p.slug || '').trim();
    const country = String(p.country || '').trim();
    const core = stripCountrySuffixFromPortLabel(p.name, country);
    const hit = parsed.find((x) => x.countryDisplay === country && (x.name === core || x.name === String(p.name || '').trim()));
    if (hit && slug) map.set(slug, hit.reviewKey);
  }
  return map;
}

/**
 * @param {Array<{ id?: string, rating?: number, reviewCount?: number }>} rows
 * @returns {Map<string, { rating: number, reviewCount: number }>}
 */
function buildReviewAggregateByIdMap(rows) {
  const map = new Map();
  if (!Array.isArray(rows)) return map;
  for (const row of rows) {
    const id = typeof row?.id === 'string' ? row.id.trim() : '';
    if (!id) continue;
    const rating = Number(row?.rating);
    const reviewCount = Number(row?.reviewCount);
    map.set(id, {
      rating: Number.isFinite(rating) ? rating : 0,
      reviewCount: Number.isFinite(reviewCount) ? reviewCount : 0,
    });
  }
  return map;
}

module.exports = {
  getAppRepoRoot,
  buildShipSlugToReviewKeyMap,
  buildPortSlugToReviewKeyMap,
  buildReviewAggregateByIdMap,
};

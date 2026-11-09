'use strict';

function stableSortKeys(value) {
  if (Array.isArray(value)) return value.map(stableSortKeys);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = stableSortKeys(value[key]);
    }
    return out;
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableSortKeys(value));
}

function deepEqual(a, b) {
  return stableStringify(a) === stableStringify(b);
}

function collectChangedPaths(before, after, prefix = '') {
  const changed = [];
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  for (const key of keys) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    const a = before ? before[key] : undefined;
    const b = after ? after[key] : undefined;
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      changed.push(...collectChangedPaths(a, b, pathKey));
      continue;
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) changed.push(pathKey);
  }
  return changed;
}

module.exports = {
  stableSortKeys,
  stableStringify,
  deepEqual,
  collectChangedPaths,
};

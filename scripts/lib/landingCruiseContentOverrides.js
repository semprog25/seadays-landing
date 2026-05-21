'use strict';

const fs = require('fs');
const path = require('path');

const OVERRIDES_PATH = path.join(__dirname, '..', '..', 'data', 'landing-cruise-content-overrides.json');

function loadLandingCruiseContentOverrides() {
  if (!fs.existsSync(OVERRIDES_PATH)) {
    return { ships: {}, ports: {}, version: 1, updatedAt: null };
  }
  try {
    const raw = JSON.parse(fs.readFileSync(OVERRIDES_PATH, 'utf8'));
    return {
      version: raw.version ?? 1,
      updatedAt: raw.updatedAt ?? null,
      ships: raw.ships && typeof raw.ships === 'object' ? raw.ships : {},
      ports: raw.ports && typeof raw.ports === 'object' ? raw.ports : {},
    };
  } catch (err) {
    console.warn('[generateBlogs] Could not parse landing cruise content overrides:', err.message);
    return { ships: {}, ports: {}, version: 1, updatedAt: null };
  }
}

function pickString(value) {
  if (value == null) return '';
  const s = String(value).trim();
  return s;
}

function pickStringArray(value, max = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((x) => pickString(x)).filter(Boolean).slice(0, max);
}

function applyShipContentOverride(record, override) {
  if (!override || typeof override !== 'object') return record;
  const description = pickString(override.description);
  const experience = pickString(override.experience);
  const shipClass = pickString(override.shipClass);
  const metaDescription = pickString(override.metaDescription);
  const highlights = pickStringArray(override.highlights);
  return {
    ...record,
    hasContentOverride: true,
    ...(description ? { description } : {}),
    ...(experience ? { experience } : {}),
    ...(shipClass ? { shipClass } : {}),
    ...(metaDescription ? { metaDescription } : {}),
    ...(highlights.length ? { highlights } : {}),
  };
}

function applyPortContentOverride(record, override) {
  if (!override || typeof override !== 'object') return record;
  const description = pickString(override.description);
  const metaDescription = pickString(override.metaDescription);
  const highlights = pickStringArray(override.highlights);
  return {
    ...record,
    hasContentOverride: true,
    ...(description ? { description } : {}),
    ...(metaDescription ? { metaDescription } : {}),
    ...(highlights.length ? { highlights } : {}),
  };
}

module.exports = {
  OVERRIDES_PATH,
  loadLandingCruiseContentOverrides,
  applyShipContentOverride,
  applyPortContentOverride,
};

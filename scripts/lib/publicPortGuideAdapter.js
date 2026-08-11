'use strict';

const fs = require('fs');
const path = require('path');
const { resolveAppRepoRoot } = require('./resolveAppRepoRoot');

/**
 * PublicPortGuide adapter — extracts only public fields from the app's
 * canonical `src/utils/port-details/ports/*.ts` modules.
 * Website consumes the exported JSON; the app remains the source of truth.
 */

function readUtf8(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return '';
  }
}

function stripTsComments(src) {
  return String(src || '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function extractObjectLiteral(src, exportName) {
  const re = new RegExp(
    `export\\s+const\\s+${exportName}\\s*:\\s*[^=]*=\\s*(\\{)`,
    'm'
  );
  const m = re.exec(src);
  if (!m) return null;
  const start = m.index + m[0].length - 1;
  let depth = 0;
  let inStr = null;
  let escaped = false;
  for (let i = start; i < src.length; i++) {
    const ch = src[i];
    if (inStr) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (ch === '\\') {
        escaped = true;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      inStr = ch;
      continue;
    }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return src.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Convert a TypeScript object literal (single-quoted strings, unquoted keys)
 * into a plain object without eval of the full app module graph.
 */
function tsObjectToJson(literal) {
  let out = '';
  let i = 0;
  const s = String(literal);
  while (i < s.length) {
    const ch = s[i];
    if (ch === "'" || ch === '"') {
      const quote = ch;
      let str = '"';
      i++;
      while (i < s.length) {
        const c = s[i];
        if (c === '\\') {
          const next = s[i + 1];
          if (next === "'" || next === '"' || next === '\\' || next === 'n' || next === 't') {
            if (next === "'") str += "'";
            else if (next === '"') str += '\\"';
            else if (next === '\\') str += '\\\\';
            else if (next === 'n') str += '\\n';
            else if (next === 't') str += '\\t';
            i += 2;
            continue;
          }
          str += c;
          i++;
          continue;
        }
        if (c === quote) {
          str += '"';
          i++;
          break;
        }
        if (c === '"') str += '\\"';
        else str += c;
        i++;
      }
      out += str;
      continue;
    }
    // Bare identifier key before colon
    if (/[A-Za-z_]/.test(ch)) {
      let j = i;
      while (j < s.length && /[A-Za-z0-9_]/.test(s[j])) j++;
      let k = j;
      while (k < s.length && /\s/.test(s[k])) k++;
      if (s[k] === ':') {
        out += `"${s.slice(i, j)}"`;
        i = j;
        continue;
      }
    }
    out += ch;
    i++;
  }
  out = out.replace(/,\s*([}\]])/g, '$1');
  try {
    return JSON.parse(out);
  } catch {
    try {
      // eslint-disable-next-line no-new-func
      return Function(`"use strict"; return (${literal});`)();
    } catch {
      return null;
    }
  }
}

function loadPortNameMap(appRoot) {
  const text = readUtf8(path.join(appRoot, 'src/utils/port-details/port-name-map.ts'));
  const map = {};
  const reverse = {};
  const block = text.match(/export const portNameMap[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (block) {
    const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(block[1]))) {
      map[m[1].toLowerCase()] = m[2];
    }
  }
  const revBlock = text.match(/export const reversePortNameMap[^=]*=\s*\{([\s\S]*?)\n\};/);
  if (revBlock) {
    const re = /['"]([^'"]+)['"]\s*:\s*['"]([^'"]+)['"]/g;
    let m;
    while ((m = re.exec(revBlock[1]))) {
      reverse[m[1]] = m[2];
    }
  }
  return { map, reverse };
}

function toPublicGuide(raw, appPortId) {
  if (!raw || typeof raw !== 'object') return null;
  const info = raw.portInfo || {};
  const facts = raw.facts || {};
  const size = raw.size || {};
  const climate = raw.climate || {};
  const politics = raw.politics || {};
  const gettingThere = raw.gettingThere || {};
  return {
    appPortId,
    portName: String(raw.portName || '').trim(),
    country: String(raw.country || '').trim(),
    portInfo: {
      description: info.description || '',
      location: info.location || '',
      timezone: info.timezone || '',
      language: info.language || '',
      currency: info.currency || '',
      population: info.population || '',
    },
    facts: {
      established: facts.established || '',
      significance: facts.significance || '',
      notableFeatures: Array.isArray(facts.notableFeatures) ? facts.notableFeatures.map(String) : [],
      culturalHighlights: Array.isArray(facts.culturalHighlights)
        ? facts.culturalHighlights.map(String)
        : [],
    },
    size: {
      portCapacity: size.portCapacity || '',
      terminalCount: typeof size.terminalCount === 'number' ? size.terminalCount : null,
      berthCount: typeof size.berthCount === 'number' ? size.berthCount : null,
      annualVisitors: size.annualVisitors || '',
      citySize: size.citySize || '',
    },
    climate: {
      type: climate.type || '',
      averageTemp: climate.averageTemp || '',
      bestMonths: Array.isArray(climate.bestMonths) ? climate.bestMonths.map(String) : [],
      rainySeason: climate.rainySeason || '',
      humidity: climate.humidity || '',
      description: climate.description || '',
    },
    politics: {
      governmentType: politics.governmentType || '',
      stability: politics.stability || '',
      visaRequirements: politics.visaRequirements || '',
      entryRequirements: politics.entryRequirements || '',
    },
    gettingThere: {
      fromTerminal: gettingThere.fromTerminal || '',
      transportation: Array.isArray(gettingThere.transportation)
        ? gettingThere.transportation.map(String)
        : [],
      distanceToCity: gettingThere.distanceToCity || '',
      walkingTime: gettingThere.walkingTime || '',
      taxiInfo: gettingThere.taxiInfo || '',
      publicTransport: gettingThere.publicTransport || '',
    },
  };
}

function extractAllPublicPortGuides(appRoot) {
  const root = appRoot || resolveAppRepoRoot();
  const dir = path.join(root, 'src/utils/port-details/ports');
  const { reverse } = loadPortNameMap(root);
  const byAppPortId = {};
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  } catch (e) {
    return { byAppPortId: {}, meta: { error: String(e.message || e), appRoot: root, count: 0 } };
  }
  for (const file of files) {
    const appPortId = file.replace(/\.ts$/, '');
    const src = stripTsComments(readUtf8(path.join(dir, file)));
    const lit = extractObjectLiteral(src, 'portInformation');
    if (!lit) continue;
    const raw = tsObjectToJson(lit);
    const pub = toPublicGuide(raw, appPortId);
    if (!pub) continue;
    if (!pub.portName && reverse[appPortId]) pub.portName = reverse[appPortId];
    byAppPortId[appPortId] = pub;
  }
  return {
    byAppPortId,
    meta: {
      appRoot: root,
      count: Object.keys(byAppPortId).length,
      generatedAt: new Date().toISOString(),
      source: 'src/utils/port-details/ports/*.ts',
    },
  };
}

/**
 * Known SEO/review-key aliases → canonical app port guide IDs.
 * App `port-name-map` uses German/legacy IDs in a few cases (e.g. genua).
 */
const APP_PORT_ID_ALIASES = {
  genoa: 'genua',
  // English SEO names that differ from app guide keys
  'genoa-italy': 'genua',
};

function resolveGuideId(candidate, guidesById) {
  const raw = String(candidate || '')
    .trim()
    .toLowerCase();
  if (!raw) return '';
  if (guidesById[raw]) return raw;
  const aliased = APP_PORT_ID_ALIASES[raw];
  if (aliased && guidesById[aliased]) return aliased;
  return '';
}

/**
 * Build website-slug → appPortId using review key map + name heuristics.
 */
function buildSlugToAppPortIdMap(seoPorts, portSlugToReviewKey, guidesById) {
  const out = {};
  const guideIds = Object.keys(guidesById || {});
  const byName = new Map();
  for (const id of guideIds) {
    const g = guidesById[id];
    const key = `${String(g.portName || '').toLowerCase()}|${String(g.country || '').toLowerCase()}`;
    byName.set(key, id);
    byName.set(String(g.portName || '').toLowerCase(), id);
    // Also index common English aliases for German/legacy portName values
    if (id === 'genua') {
      byName.set('genoa|italy', id);
      byName.set('genoa', id);
    }
  }
  for (const port of seoPorts || []) {
    const slug = String(port.slug || '').trim();
    if (!slug) continue;
    const reviewKey =
      portSlugToReviewKey && typeof portSlugToReviewKey.get === 'function'
        ? portSlugToReviewKey.get(slug)
        : portSlugToReviewKey
          ? portSlugToReviewKey[slug]
          : '';
    const fromReview = resolveGuideId(reviewKey, guidesById);
    if (fromReview) {
      out[slug] = fromReview;
      continue;
    }
    const fromSlug = resolveGuideId(slug, guidesById);
    if (fromSlug) {
      out[slug] = fromSlug;
      continue;
    }
    const name = String(port.name || '').trim().toLowerCase();
    const country = String(port.country || '').trim().toLowerCase();
    // "Genoa, Italy" → try bare city name too
    const bareName = name.replace(/,\s*[^,]+$/, '').trim();
    const hit =
      byName.get(`${name}|${country}`) ||
      byName.get(`${bareName}|${country}`) ||
      byName.get(name) ||
      byName.get(bareName);
    if (hit) out[slug] = hit;
    else {
      // hamburg-germany → hamburg; genoa-italy → genoa alias → genua
      const first = slug.split('-')[0];
      const fromFirst = resolveGuideId(first, guidesById);
      if (fromFirst) out[slug] = fromFirst;
    }
  }
  return out;
}

function loadPublicPortGuidesFile(repoRoot) {
  const p = path.join(repoRoot, 'data', 'public-port-guides.json');
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function writePublicPortGuidesFile(repoRoot, payload) {
  const dir = path.join(repoRoot, 'data');
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, 'public-port-guides.json');
  fs.writeFileSync(p, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  return p;
}

module.exports = {
  resolveAppRepoRoot,
  extractAllPublicPortGuides,
  buildSlugToAppPortIdMap,
  loadPublicPortGuidesFile,
  writePublicPortGuidesFile,
  toPublicGuide,
};

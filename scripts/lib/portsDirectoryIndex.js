'use strict';

/**
 * Ports & Destinations directory index (Region → Country → Ports).
 * Presentation-layer only — does not delete or rewrite individual port URLs.
 */

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Alias slugs → canonical directory slug (URLs retained; aliases hidden from browse grid). */
const DIRECTORY_ALIAS_TO_CANONICAL = {
  'chennai-port-india': 'chennai-india',
  'cochin-india': 'kochi-india',
  'cochin-port-india': 'kochi-india',
  'mumbai-port-india': 'mumbai-india',
  'vizag-india': 'visakhapatnam-india',
};

/** Canonical display names + search aliases for known duplicate destinations. */
const CANONICAL_DISPLAY = {
  'kochi-india': { displayName: 'Kochi', aliases: ['kochi', 'cochin', 'cochin port'] },
  'chennai-india': { displayName: 'Chennai', aliases: ['chennai', 'chennai port', 'madras'] },
  'mumbai-india': { displayName: 'Mumbai', aliases: ['mumbai', 'mumbai port', 'bombay'] },
  'visakhapatnam-india': { displayName: 'Visakhapatnam', aliases: ['visakhapatnam', 'vizag'] },
};

const NORTH_AMERICA_REGIONS = [
  'Atlantic Canada',
  'Baja Mexico',
  'California',
  'Florida',
  'Gulf of Mexico',
  'Hawaii',
  'Mexican Riviera',
  'Mid-Atlantic',
  'New England',
  'Northeast',
  'Pacific Coast',
  'Pacific Northwest',
  'South',
  'St. Lawrence',
  'Texas',
];

/**
 * Priority browse regions. `key` is the filter token; `regions` lists underlying data regions.
 */
const PRIORITY_REGION_DEFS = [
  { key: 'Mediterranean', label: 'Mediterranean', regions: ['Mediterranean'] },
  { key: 'Caribbean', label: 'Caribbean', regions: ['Caribbean'] },
  { key: 'Northern Europe', label: 'Northern Europe', regions: ['Northern Europe'] },
  { key: 'Baltic', label: 'Baltic Sea', regions: ['Baltic'] },
  { key: 'Fjords', label: 'Norwegian Fjords', regions: ['Fjords'] },
  { key: 'British Isles', label: 'British Isles', regions: ['British Isles'] },
  { key: 'Alaska', label: 'Alaska', regions: ['Alaska'] },
  { key: 'Asia', label: 'Asia', regions: ['Asia'] },
  {
    key: '__virt_anz__',
    label: 'Australia & New Zealand',
    regions: ['Australia', 'New Zealand'],
  },
  {
    key: '__virt_na__',
    label: 'North America',
    regions: NORTH_AMERICA_REGIONS,
  },
  { key: 'South America', label: 'South America', regions: ['South America'] },
  { key: 'Middle East', label: 'Middle East', regions: ['Middle East'] },
];

function formatDirectoryRating(rating) {
  const n = typeof rating === 'number' ? rating : Number(String(rating || '').trim());
  if (!Number.isFinite(n) || n <= 0) return { display: null, numeric: null };
  return { display: (Math.round(n * 10) / 10).toFixed(1), numeric: n };
}

function buildStarGlyphsFromRating(numeric) {
  const n = Number(numeric);
  const rounded = !Number.isFinite(n) ? 0 : Math.min(5, Math.max(0, Math.round(n)));
  let s = '';
  for (let i = 1; i <= 5; i++) s += i <= rounded ? '★' : '☆';
  return s;
}

function buildDirectoryRatingVisualHtml(displayStr, numeric) {
  const stars = buildStarGlyphsFromRating(numeric);
  return (
    `<span class="rating-visual" role="img" aria-label="Average rating ${escapeHtml(displayStr)} out of 5 stars">` +
    `<span class="rating-stars" aria-hidden="true">${stars}</span>` +
    `<span class="rating-num">${escapeHtml(displayStr)} / 5</span>` +
    `</span>`
  );
}

function normalizeKey(value) {
  return String(value || '').trim();
}

function normalizeSearch(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function stripTrailingCountry(name, country) {
  const label = String(name || '').trim();
  const c = String(country || '').trim();
  if (!c) return label;
  const lower = label.toLowerCase();
  const suffix = `, ${c.toLowerCase()}`;
  if (lower.endsWith(suffix)) return label.slice(0, -suffix.length).trim();
  return label;
}

function isBoilerplateDescription(text) {
  const t = String(text || '').toLowerCase();
  if (!t) return true;
  if (t.includes('cruise port profile in the seadays directory')) return true;
  if (/^[^.]+\s+is a cruise port in\s+[^.]+\.?$/.test(t) && t.length < 120) return true;
  if (/, [^,]+, [^,]+ is a cruise port profile/.test(t)) return true;
  return false;
}

function shortDirectoryBlurb(description) {
  const raw = String(description || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!raw || isBoilerplateDescription(raw)) return '';
  const first = raw.split(/(?<=[.!?])\s+/)[0] || raw;
  const clipped = first.length > 140 ? `${first.slice(0, 137).trim()}…` : first;
  return clipped;
}

/**
 * Decide which ports appear in the browse grid.
 * Alias/duplicate destination records stay on disk for SEO; they are omitted from browse.
 */
function resolveDirectoryPorts(ports) {
  const safe = Array.isArray(ports) ? ports : [];
  const bySlug = new Map(safe.map((p) => [String(p.slug || ''), p]));

  // Heuristic: "X Port" when "X" exists in same country → treat as alias of X
  const heuristicAlias = new Map();
  for (const port of safe) {
    const slug = String(port.slug || '');
    if (DIRECTORY_ALIAS_TO_CANONICAL[slug]) continue;
    const country = normalizeKey(port.country);
    const baseName = stripTrailingCountry(port.name || port.portName, country);
    const m = baseName.match(/^(.*)\s+Port$/i);
    if (!m) continue;
    const stem = m[1].trim();
    if (!stem || /^(port)\b/i.test(stem)) continue; // Port Blair, Port Said, etc.
    const stemNorm = normalizeSearch(stem);
    const match = safe.find((other) => {
      if (other === port) return false;
      if (normalizeKey(other.country) !== country) return false;
      const otherName = stripTrailingCountry(other.name || other.portName, other.country);
      return normalizeSearch(otherName) === stemNorm;
    });
    if (match && match.slug) heuristicAlias.set(slug, String(match.slug));
  }

  const aliasToCanonical = { ...DIRECTORY_ALIAS_TO_CANONICAL };
  for (const [alias, canonical] of heuristicAlias.entries()) {
    if (!aliasToCanonical[alias]) aliasToCanonical[alias] = canonical;
  }

  const aliasesByCanonical = new Map();
  for (const [aliasSlug, canonicalSlug] of Object.entries(aliasToCanonical)) {
    if (!bySlug.has(canonicalSlug)) continue;
    if (!aliasesByCanonical.has(canonicalSlug)) aliasesByCanonical.set(canonicalSlug, []);
    const aliasPort = bySlug.get(aliasSlug);
    const aliasName = stripTrailingCountry(aliasPort?.name || aliasPort?.portName, aliasPort?.country);
    aliasesByCanonical.get(canonicalSlug).push(normalizeSearch(aliasName));
    aliasesByCanonical.get(canonicalSlug).push(normalizeSearch(aliasSlug.replace(/-/g, ' ')));
  }

  const directoryPorts = [];
  for (const port of safe) {
    const slug = String(port.slug || '');
    if (aliasToCanonical[slug]) continue;

    const country = normalizeKey(port.country);
    const region = normalizeKey(port.region) || 'Other';
    const rawName = stripTrailingCountry(port.name || port.portName, country) || slug;
    const canon = CANONICAL_DISPLAY[slug];
    const displayName = (canon && canon.displayName) || rawName;
    const aliasList = new Set([
      normalizeSearch(displayName),
      normalizeSearch(rawName),
      normalizeSearch(slug.replace(/-/g, ' ')),
      ...(canon && Array.isArray(canon.aliases) ? canon.aliases.map(normalizeSearch) : []),
      ...(aliasesByCanonical.get(slug) || []),
    ]);

    directoryPorts.push({
      ...port,
      slug,
      country,
      region,
      displayName,
      searchAliases: [...aliasList].filter(Boolean).join(' '),
      shortBlurb: shortDirectoryBlurb(port.description),
    });
  }

  return { directoryPorts, aliasToCanonical };
}

function countPortsForRegions(directoryPorts, regionKeys) {
  const set = new Set(regionKeys);
  return directoryPorts.filter((p) => set.has(p.region)).length;
}

function compareLabelsAz(a, b) {
  return String(a || '').localeCompare(String(b || ''), undefined, { sensitivity: 'base' });
}

function buildRegionBrowseHtml(directoryPorts) {
  const presentRegions = new Set(directoryPorts.map((p) => p.region));
  const priorityKeys = new Set();
  const cards = [];

  const priorityDefsAz = PRIORITY_REGION_DEFS.slice().sort((a, b) => compareLabelsAz(a.label, b.label));
  for (const def of priorityDefsAz) {
    const available = def.regions.filter((r) => presentRegions.has(r));
    if (!available.length) continue;
    const count = countPortsForRegions(directoryPorts, available);
    if (!count) continue;
    available.forEach((r) => priorityKeys.add(r));
    cards.push(
      `<button type="button" class="region-card" data-region-key="${escapeHtml(def.key)}" ` +
        `data-regions="${escapeHtml(available.join('|'))}" aria-pressed="false">` +
        `<span class="region-card-name">${escapeHtml(def.label)}</span>` +
        `<span class="region-card-count">${count} port${count === 1 ? '' : 's'}</span>` +
        `</button>`
    );
  }

  const otherRegions = [...presentRegions]
    .filter((r) => !priorityKeys.has(r))
    .sort(compareLabelsAz);

  const otherPills = otherRegions
    .map((region) => {
      const count = countPortsForRegions(directoryPorts, [region]);
      return (
        `<button type="button" class="pill region-more-pill" data-region-key="${escapeHtml(region)}" ` +
        `data-regions="${escapeHtml(region)}" aria-pressed="false">` +
        `${escapeHtml(region)} · ${count}</button>`
      );
    })
    .join('');

  return {
    regionCardsHtml: cards.join('\n'),
    otherRegionsHtml: otherPills,
    otherRegionCount: otherRegions.length,
  };
}

function buildPortCardsHtml(directoryPorts) {
  return directoryPorts
    .slice()
    .sort((a, b) => {
      const regionCmp = compareLabelsAz(a.region, b.region);
      if (regionCmp !== 0) return regionCmp;
      const countryCmp = compareLabelsAz(a.country, b.country);
      if (countryCmp !== 0) return countryCmp;
      return compareLabelsAz(a.displayName, b.displayName);
    })
    .map((port) => {
      const fr = formatDirectoryRating(port.rating);
      const ratingHtml = fr.display
        ? buildDirectoryRatingVisualHtml(fr.display, fr.numeric)
        : `<span class="rating-pill rating-pill-muted">In-app rating</span>`;
      const blurbHtml = port.shortBlurb
        ? `<span class="seo-grid-card-desc">${escapeHtml(port.shortBlurb)}</span>`
        : '';
      const bookableHtml = port.hasBookableExperiences
        ? `<span class="seo-grid-card-bookable">Bookable experiences available</span>`
        : '';
      const ratingVal =
        typeof port.rating === 'number' && Number.isFinite(port.rating) ? String(port.rating) : '';
      const reviewCount =
        typeof port.reviewCount === 'number' && Number.isFinite(port.reviewCount)
          ? String(port.reviewCount)
          : '0';
      return (
        `<a href="/ports/${escapeHtml(port.slug)}/" class="seo-grid-card directory-card" ` +
        `data-group="${escapeHtml(port.region)}" data-item="${escapeHtml(port.slug)}" ` +
        `data-name="${escapeHtml(normalizeSearch(port.displayName))}" ` +
        `data-country="${escapeHtml(normalizeSearch(port.country))}" ` +
        `data-region="${escapeHtml(port.region)}" ` +
        `data-aliases="${escapeHtml(port.searchAliases)}" ` +
        `data-bookable="${port.hasBookableExperiences ? '1' : '0'}" ` +
        `data-rating="${escapeHtml(ratingVal)}" data-reviews="${escapeHtml(reviewCount)}">` +
        `<span class="seo-grid-card-title">${escapeHtml(port.displayName)}</span>` +
        `<span class="seo-grid-card-meta">${escapeHtml(port.country)}${
          port.region ? ` · ${escapeHtml(port.region)}` : ''
        }</span>` +
        blurbHtml +
        bookableHtml +
        `<span class="seo-grid-card-bottom">` +
        ratingHtml +
        `<span class="seo-grid-card-hint">Open Port Guide →</span>` +
        `</span>` +
        `</a>`
      );
    })
    .join('\n');
}

function buildDirectoryHeaderNav() {
  return `<nav class="header-nav">
        <a href="/">Home</a>
        <a href="/blog/">Blog</a>
        <a href="/ships/">Ships</a>
        <a href="/ports/">Ports</a>
        <a href="https://seadays.app/privacy.html">Privacy</a>
        <a href="https://seadays.app/terms.html">Terms</a>
      </nav>`;
}

const PORTS_DIRECTORY_EXTRA_CSS = `
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.seo-prose { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.75; }
.seo-prose h2 { font-size: 26px; margin: 32px 0 16px; font-weight: 800; color: #fff; }
.seo-prose p { margin-bottom: 18px; }
.seo-prose a { color: var(--neon-red); text-decoration: none; font-weight: 600; }
.seo-prose a:hover { text-decoration: underline; }
.directory-hero { max-width: 1200px; margin: 0 auto; padding: 140px 20px 36px; display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 40px; align-items: center; }
.directory-hero h1 { font-size: 56px; font-weight: 900; letter-spacing: -1px; line-height: 1.06; margin-bottom: 14px; }
.directory-hero p { font-size: 18px; color: rgba(255,255,255,0.7); line-height: 1.7; margin-bottom: 16px; }
.directory-cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 18px; }
.directory-btn { display: inline-flex; align-items: center; justify-content: center; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; }
.directory-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); transform: translateY(-1px); }
.directory-btn-primary { background: rgba(255,0,51,0.18); border-color: rgba(255,0,51,0.4); }
.directory-hero-art { border-radius: 22px; border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.04); overflow: hidden; box-shadow: 0 18px 60px rgba(0,0,0,0.4); position: relative; }
.directory-hero-art::after { content: ''; position: absolute; inset: -80px -120px auto auto; width: 240px; height: 240px; background: radial-gradient(circle at center, rgba(6,182,212,0.32), rgba(6,182,212,0)); filter: blur(4px); pointer-events: none; }
.directory-hero-art img { width: 100%; height: 100%; display: block; object-fit: cover; object-position: center; }
.directory-controls { max-width: 1200px; margin: 0 auto; padding: 0 20px 18px; }
.directory-section { max-width: 1200px; margin: 0 auto 22px; padding: 0 20px; }
.directory-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.directory-section-head h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 0; }
.directory-section-note { font-size: 13px; color: rgba(255,255,255,0.55); }
.directory-search-wrap { position: relative; max-width: 640px; width: 100%; margin: 0 auto 8px; }
.directory-search { width: 100%; max-width: none; margin: 0; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: #fff; font-size: 16px; font-weight: 600; }
.directory-search::placeholder { color: rgba(255,255,255,0.45); font-weight: 600; }
.directory-search:focus { outline: none; border-color: rgba(6,182,212,0.7); box-shadow: 0 0 0 1px rgba(6,182,212,0.35); }
.search-results { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 40; max-height: 340px; overflow: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); background: rgba(12,12,12,0.98); box-shadow: 0 16px 40px rgba(0,0,0,0.45); display: none; }
.search-results.is-open { display: block; }
.search-result-item { display: block; width: 100%; text-align: left; padding: 12px 14px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.06); background: transparent; color: #fff; cursor: pointer; text-decoration: none; }
.search-result-item:last-child { border-bottom: 0; }
.search-result-item:hover, .search-result-item:focus { background: rgba(255,255,255,0.06); outline: none; }
.search-result-name { display: block; font-weight: 800; font-size: 15px; }
.search-result-meta { display: block; margin-top: 2px; font-size: 12px; color: rgba(255,255,255,0.55); }
.search-empty { padding: 14px; font-size: 13px; color: rgba(255,255,255,0.55); }
.region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 12px; }
.region-card { appearance: none; text-align: left; padding: 16px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; cursor: pointer; transition: border-color 0.2s, transform 0.2s, background 0.2s; }
.region-card:hover { border-color: rgba(6,182,212,0.55); transform: translateY(-1px); }
.region-card[aria-pressed="true"] { border-color: rgba(6,182,212,0.85); background: rgba(6,182,212,0.16); }
.region-card-name { display: block; font-weight: 800; font-size: 15px; line-height: 1.25; }
.region-card-count { display: block; margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.region-more-wrap { margin-top: 14px; }
.region-more-toggle { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; }
.region-more-toggle:hover { border-color: rgba(6,182,212,0.55); }
.region-more-panel { display: none; margin-top: 12px; }
.region-more-panel.is-open { display: block; }
.region-more-scroll { display: flex; flex-wrap: nowrap; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.region-more-scroll .pill { flex: 0 0 auto; }
.country-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.country-card { appearance: none; text-align: left; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; cursor: pointer; transition: border-color 0.2s, background 0.2s; }
.country-card:hover { border-color: rgba(6,182,212,0.55); }
.country-card[aria-pressed="true"] { border-color: rgba(6,182,212,0.85); background: rgba(6,182,212,0.16); }
.country-card-name { display: block; font-weight: 800; font-size: 16px; line-height: 1.2; }
.country-card-count { display: block; margin-top: 4px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.country-empty { font-size: 14px; color: rgba(255,255,255,0.55); padding: 8px 0; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 14px; }
.filter-select { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.92); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; min-height: 42px; }
.filter-select:focus { outline: 2px solid rgba(6,182,212,0.7); outline-offset: 2px; }
.filter-select option { color: #111; }
.results-meta { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 12px; }
.pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
.pill { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; }
.pill:hover { border-color: rgba(6,182,212,0.55); }
.pill[aria-pressed="true"] { border-color: rgba(6,182,212,0.85); background: rgba(6,182,212,0.16); }
.seo-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 0 20px 100px; max-width: 1200px; margin: 0 auto; }
.seo-grid-card { display: flex; flex-direction: column; gap: 8px; padding: 20px; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.seo-grid-card:hover { border-color: var(--neon-red); transform: translateY(-2px); }
.seo-grid-card-title { font-weight: 800; font-size: 18px; letter-spacing: -0.2px; }
.seo-grid-card-hint { font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.seo-grid-card-meta { font-size: 13px; color: rgba(255,255,255,0.55); }
.seo-grid-card-desc { font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.68); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.seo-grid-card-bookable { display: inline-flex; width: fit-content; margin-top: 2px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #042f2e; background: linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,211,238,0.9)); }
.seo-grid-card-bottom { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-top: 6px; }
.rating-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); }
.rating-pill-muted { color: rgba(255,255,255,0.6); font-weight: 700; }
.rating-visual { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.95); min-width: 0; }
.rating-stars { letter-spacing: 2px; color: #fbbf24; font-size: 15px; line-height: 1; }
.rating-num { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.75); }
.directory-card.is-hidden { display: none; }
.featured-guides { max-width: 1200px; margin: 0 auto 20px; padding: 0 20px; }
.featured-guides h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 8px 0 12px; }
.featured-guides-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.guide-card { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; }
.guide-card:hover { border-color: rgba(6,182,212,0.85); transform: translateY(-2px); }
.guide-card-image { width: 100%; height: 150px; min-height: 150px; object-fit: cover; object-position: center; background: linear-gradient(135deg, rgba(6,182,212,0.18), rgba(255,255,255,0.06)); display: block; }
.guide-card-body { padding: 12px 14px 14px; }
.guide-card-title { font-size: 14px; font-weight: 800; line-height: 1.25; letter-spacing: -0.2px; margin: 0; }
.guide-card-meta { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.55); }
.app-cta { max-width: 1200px; margin: 0 auto 26px; padding: 0 20px; }
.app-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(6,182,212,0.06); }
.app-cta strong { display: block; font-size: 15px; }
.app-cta span { display: block; font-size: 13px; color: rgba(255,255,255,0.68); margin-top: 2px; }
.app-cta a { flex: 0 0 auto; }
.header { position: sticky; top: 0; background: rgba(10,10,10,0.92); border-bottom: 1px solid rgba(255,255,255,0.06); }
@media (max-width: 900px) {
  .directory-hero { grid-template-columns: 1fr; padding-top: 120px; }
  .directory-hero h1 { font-size: 38px; }
  .featured-guides-grid { grid-template-columns: 1fr; }
  .app-cta-inner { flex-direction: column; align-items: flex-start; }
  .region-grid { display: flex; flex-wrap: nowrap; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
  .region-card { flex: 0 0 min(78vw, 240px); }
  .country-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-select { width: 100%; }
}
`;

function buildPortsDirectoryClientScript() {
  return `
  (function(){
    var search = document.getElementById('portSearch');
    var searchResults = document.getElementById('portSearchResults');
    var regionBrowse = document.getElementById('regionBrowse');
    var regionMoreToggle = document.getElementById('regionMoreToggle');
    var regionMorePanel = document.getElementById('regionMorePanel');
    var countryBrowse = document.getElementById('countryBrowse');
    var countryHeading = document.getElementById('countryHeading');
    var countryEmpty = document.getElementById('countryEmpty');
    var grid = document.getElementById('directoryGrid');
    var resultsMeta = document.getElementById('resultsMeta');
    var filterRegion = document.getElementById('filterRegion');
    var filterCountry = document.getElementById('filterCountry');
    var filterBookable = document.getElementById('filterBookable');
    var filterSort = document.getElementById('filterSort');
    if(!grid) return;

    var cards = Array.prototype.slice.call(grid.querySelectorAll('.directory-card'));
    var state = {
      regions: null,
      country: '__all__',
      bookable: false,
      sort: 'name',
      query: ''
    };

    function norm(s){
      return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    }
    function setPressed(container, attr, activeValue){
      if(!container) return;
      Array.prototype.slice.call(container.querySelectorAll('[' + attr + ']')).forEach(function(btn){
        var v = btn.getAttribute(attr);
        btn.setAttribute('aria-pressed', String(v === activeValue));
      });
    }
    function activeRegionKey(){
      var pressed = document.querySelector('.region-card[aria-pressed="true"], .region-more-pill[aria-pressed="true"]');
      return pressed ? pressed.getAttribute('data-region-key') : '__all__';
    }
    function parseRegionsAttr(el){
      if(!el) return null;
      var raw = el.getAttribute('data-regions') || '';
      if(!raw) return null;
      return raw.split('|').map(function(s){ return s.trim(); }).filter(Boolean);
    }
    function cardMatchesRegions(card, regions){
      if(!regions || !regions.length) return true;
      var region = card.getAttribute('data-region') || card.getAttribute('data-group') || '';
      return regions.indexOf(region) !== -1;
    }
    function cardMatchesQuery(card, q){
      if(!q) return true;
      var name = card.getAttribute('data-name') || '';
      var country = card.getAttribute('data-country') || '';
      var region = norm(card.getAttribute('data-region') || card.getAttribute('data-group') || '');
      var aliases = card.getAttribute('data-aliases') || '';
      var item = card.getAttribute('data-item') || '';
      var title = ((card.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
      return name.indexOf(q) !== -1
        || country.indexOf(q) !== -1
        || region.indexOf(q) !== -1
        || aliases.indexOf(q) !== -1
        || title.indexOf(q) !== -1
        || item.indexOf(q) !== -1;
    }
    function visiblePool(){
      var q = state.query;
      return cards.filter(function(card){
        if(state.bookable && card.getAttribute('data-bookable') !== '1') return false;
        if(q) return cardMatchesQuery(card, q);
        if(!cardMatchesRegions(card, state.regions)) return false;
        if(state.country && state.country !== '__all__'){
          var c = card.getAttribute('data-country') || '';
          if(c !== state.country) return false;
        }
        return true;
      });
    }
    function sortCards(list){
      var mode = state.sort || 'name';
      return list.slice().sort(function(a, b){
        if(mode === 'name'){
          var na = ((a.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          var nb = ((b.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          return na.localeCompare(nb);
        }
        if(mode === 'country'){
          var ca = a.getAttribute('data-country') || '';
          var cb = b.getAttribute('data-country') || '';
          if(ca !== cb) return ca.localeCompare(cb);
          var ta = ((a.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          var tb = ((b.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
          return ta.localeCompare(tb);
        }
        var ra = Number(a.getAttribute('data-rating') || 0);
        var rb = Number(b.getAttribute('data-rating') || 0);
        if(rb !== ra) return rb - ra;
        var va = Number(a.getAttribute('data-reviews') || 0);
        var vb = Number(b.getAttribute('data-reviews') || 0);
        if(vb !== va) return vb - va;
        var pa = ((a.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
        var pb = ((b.querySelector('.seo-grid-card-title') || {}).textContent || '').toLowerCase();
        return pa.localeCompare(pb);
      });
    }
    function rebuildCountryOptions(poolForCountries){
      var hasRegion = !!(state.regions && state.regions.length);
      var showCountries = hasRegion || !!state.query;
      var counts = {};
      if(showCountries){
        poolForCountries.forEach(function(card){
          var c = card.getAttribute('data-country') || '';
          var labelEl = card.querySelector('.seo-grid-card-meta');
          var label = '';
          if(labelEl){
            var parts = (labelEl.textContent || '').split('·');
            label = (parts[0] || '').trim();
          }
          if(!c) return;
          if(!counts[c]) counts[c] = { key: c, label: label || c, count: 0 };
          counts[c].count += 1;
          if(label) counts[c].label = label;
        });
      }
      var entries = Object.keys(counts).map(function(k){ return counts[k]; })
        .sort(function(a, b){ return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' }); });

      if(countryBrowse){
        countryBrowse.innerHTML = '';
        if(!showCountries){
          if(countryEmpty){
            countryEmpty.style.display = 'block';
            countryEmpty.textContent = 'Select a region to see its countries, or search above.';
          }
        } else if(!entries.length){
          if(countryEmpty){
            countryEmpty.style.display = 'block';
            countryEmpty.textContent = 'No countries match the current filters.';
          }
        } else {
          if(countryEmpty) countryEmpty.style.display = 'none';
          var allBtn = document.createElement('button');
          allBtn.type = 'button';
          allBtn.className = 'country-card';
          allBtn.setAttribute('data-country', '__all__');
          allBtn.setAttribute('aria-pressed', state.country === '__all__' ? 'true' : 'false');
          allBtn.innerHTML = '<span class="country-card-name">All countries</span><span class="country-card-count">' +
            poolForCountries.length + ' port' + (poolForCountries.length === 1 ? '' : 's') + '</span>';
          countryBrowse.appendChild(allBtn);
          entries.forEach(function(entry){
            var b = document.createElement('button');
            b.type = 'button';
            b.className = 'country-card';
            b.setAttribute('data-country', entry.key);
            b.setAttribute('aria-pressed', state.country === entry.key ? 'true' : 'false');
            b.innerHTML = '<span class="country-card-name">' + entry.label + '</span>' +
              '<span class="country-card-count">' + entry.count + ' port' + (entry.count === 1 ? '' : 's') + '</span>';
            countryBrowse.appendChild(b);
          });
        }
      }

      if(filterCountry){
        var previous = filterCountry.value;
        filterCountry.innerHTML = '<option value="__all__">All Countries</option>';
        entries.forEach(function(entry){
          var opt = document.createElement('option');
          opt.value = entry.key;
          opt.textContent = entry.label + ' (' + entry.count + ')';
          filterCountry.appendChild(opt);
        });
        var still = entries.some(function(e){ return e.key === previous; });
        filterCountry.value = still ? previous : '__all__';
        if(!still) state.country = '__all__';
      }

      if(countryHeading){
        var regionLabel = 'Select a region';
        var pressed = document.querySelector('.region-card[aria-pressed="true"], .region-more-pill[aria-pressed="true"]');
        if(pressed){
          var nameEl = pressed.querySelector('.region-card-name');
          regionLabel = nameEl ? nameEl.textContent.trim() : (pressed.textContent || '').split('·')[0].trim();
        }
        countryHeading.textContent = state.query ? 'Countries matching search' : regionLabel;
      }
    }
    function apply(){
      var q = state.query;
      var regionPool = cards.filter(function(card){
        if(q) return cardMatchesQuery(card, q);
        return cardMatchesRegions(card, state.regions);
      });
      rebuildCountryOptions(regionPool);

      var matched = sortCards(visiblePool());
      var matchedSet = {};
      matched.forEach(function(card, idx){
        matchedSet[card.getAttribute('data-item')] = idx;
      });
      cards.forEach(function(card){
        var slug = card.getAttribute('data-item');
        if(Object.prototype.hasOwnProperty.call(matchedSet, slug)){
          card.classList.remove('is-hidden');
          card.style.order = String(matchedSet[slug]);
        } else {
          card.classList.add('is-hidden');
          card.style.order = '';
        }
      });
      if(resultsMeta){
        var label = matched.length + ' port' + (matched.length === 1 ? '' : 's');
        if(q) label += ' matching “' + q + '”';
        else if(state.regions && state.regions.length) label += ' in selected region';
        if(state.country && state.country !== '__all__') label += ' · filtered by country';
        resultsMeta.textContent = label;
      }
    }
    function renderSearchResults(){
      if(!searchResults) return;
      var q = state.query;
      if(!q){
        searchResults.classList.remove('is-open');
        searchResults.innerHTML = '';
        return;
      }
      var hits = sortCards(cards.filter(function(card){ return cardMatchesQuery(card, q); })).slice(0, 8);
      if(!hits.length){
        searchResults.innerHTML = '<div class="search-empty">No ports found. Try a city, port, or country name.</div>';
        searchResults.classList.add('is-open');
        return;
      }
      searchResults.innerHTML = hits.map(function(card){
        var href = card.getAttribute('href') || '#';
        var name = ((card.querySelector('.seo-grid-card-title') || {}).textContent || '').trim();
        var meta = ((card.querySelector('.seo-grid-card-meta') || {}).textContent || '').trim();
        return '<a class="search-result-item" href="' + href + '">' +
          '<span class="search-result-name">' + name + '</span>' +
          '<span class="search-result-meta">' + meta + '</span></a>';
      }).join('');
      searchResults.classList.add('is-open');
    }
    function selectRegion(btn){
      var key = btn ? btn.getAttribute('data-region-key') : '__all__';
      setPressed(document, 'data-region-key', key === '__all__' ? '' : key);
      if(key === '__all__' || !btn){
        document.querySelectorAll('[data-region-key]').forEach(function(el){
          el.setAttribute('aria-pressed', 'false');
        });
        state.regions = null;
        if(filterRegion) filterRegion.value = '__all__';
      } else {
        document.querySelectorAll('[data-region-key]').forEach(function(el){
          el.setAttribute('aria-pressed', String(el === btn));
        });
        state.regions = parseRegionsAttr(btn);
        if(filterRegion){
          var opt = Array.prototype.slice.call(filterRegion.options).find(function(o){ return o.value === key; });
          if(opt) filterRegion.value = key;
        }
      }
      state.country = '__all__';
      if(filterCountry) filterCountry.value = '__all__';
      apply();
    }

    if(regionBrowse){
      regionBrowse.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-region-key]');
        if(!btn) return;
        if(btn.getAttribute('aria-pressed') === 'true'){
          selectRegion(null);
          return;
        }
        selectRegion(btn);
      });
    }
    if(regionMorePanel){
      regionMorePanel.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-region-key]');
        if(!btn) return;
        selectRegion(btn);
      });
    }
    if(regionMoreToggle && regionMorePanel){
      regionMoreToggle.addEventListener('click', function(){
        var open = regionMorePanel.classList.toggle('is-open');
        regionMoreToggle.setAttribute('aria-expanded', String(open));
        regionMoreToggle.textContent = open ? 'Hide additional regions' : 'View all regions';
      });
    }
    if(countryBrowse){
      countryBrowse.addEventListener('click', function(e){
        var btn = e.target && e.target.closest && e.target.closest('[data-country]');
        if(!btn) return;
        state.country = btn.getAttribute('data-country') || '__all__';
        setPressed(countryBrowse, 'data-country', state.country);
        if(filterCountry) filterCountry.value = state.country;
        apply();
      });
    }
    if(filterRegion){
      filterRegion.addEventListener('change', function(){
        var val = filterRegion.value;
        if(val === '__all__'){
          selectRegion(null);
          return;
        }
        var btn = document.querySelector('[data-region-key="' + val.replace(/"/g, '') + '"]');
        if(btn) selectRegion(btn);
        else {
          state.regions = [val];
          state.country = '__all__';
          apply();
        }
      });
    }
    if(filterCountry){
      filterCountry.addEventListener('change', function(){
        state.country = filterCountry.value || '__all__';
        if(countryBrowse) setPressed(countryBrowse, 'data-country', state.country);
        apply();
      });
    }
    if(filterBookable){
      filterBookable.addEventListener('change', function(){
        state.bookable = filterBookable.value === 'bookable';
        apply();
      });
    }
    if(filterSort){
      filterSort.addEventListener('change', function(){
        state.sort = filterSort.value || 'name';
        apply();
      });
    }
    if(search){
      search.addEventListener('input', function(){
        state.query = norm(search.value || '');
        if(state.query){
          state.regions = null;
          state.country = '__all__';
          document.querySelectorAll('[data-region-key]').forEach(function(el){ el.setAttribute('aria-pressed', 'false'); });
          if(filterRegion) filterRegion.value = '__all__';
          if(filterCountry) filterCountry.value = '__all__';
        }
        renderSearchResults();
        apply();
      });
      search.addEventListener('keydown', function(e){
        if(e.key === 'Escape'){
          searchResults && searchResults.classList.remove('is-open');
        }
      });
    }
    document.addEventListener('click', function(e){
      if(!searchResults || !search) return;
      if(search.contains(e.target) || searchResults.contains(e.target)) return;
      searchResults.classList.remove('is-open');
    });

    // Default: no forced region — search or browse freely (all ports visible, sorted).
    state.regions = null;
    state.country = '__all__';
    apply();
  })();
`;
}

/**
 * @param {object} opts
 * @param {Array} opts.ports
 * @param {string} [opts.featuredGuideCardsHtml]
 * @param {string} opts.indexStyles
 * @param {string} opts.analyticsHeadHtml
 * @param {string} opts.runtimeGuardScript
 * @param {string} [opts.baseUrl]
 * @param {string} [opts.defaultFavicon]
 */
function buildPortsIndexHtml(opts) {
  const BASE_URL = opts.baseUrl || 'https://seadays.app';
  const DEFAULT_FAVICON =
    opts.defaultFavicon ||
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
  const INDEX_STYLES = opts.indexStyles || '';
  const analyticsHeadHtml = opts.analyticsHeadHtml || '';
  const runtimeGuardScript = opts.runtimeGuardScript || '';
  const featuredGuideCardsHtml =
    typeof opts.featuredGuideCardsHtml === 'string' ? opts.featuredGuideCardsHtml : '';

  const canonical = `${BASE_URL}/ports/`;
  const title = 'Cruise Ports & Destinations | SeaDays';
  const desc =
    'Explore cruise ports and destinations: browse by region and country, search port guides, and plan shore days with SeaDays.';

  const { directoryPorts } = resolveDirectoryPorts(opts.ports);
  const { regionCardsHtml, otherRegionsHtml, otherRegionCount } = buildRegionBrowseHtml(directoryPorts);
  const cards = buildPortCardsHtml(directoryPorts);

  const allRegions = [...new Set(directoryPorts.map((p) => p.region))].sort(compareLabelsAz);
  const priorityFilterDefsAz = PRIORITY_REGION_DEFS.filter((def) =>
    def.regions.some((r) => allRegions.includes(r))
  ).sort((a, b) => compareLabelsAz(a.label, b.label));
  const filterRegionOptions = [
    `<option value="__all__">All Regions</option>`,
    ...priorityFilterDefsAz.map(
      (def) => `<option value="${escapeHtml(def.key)}">${escapeHtml(def.label)}</option>`
    ),
    ...allRegions
      .filter((r) => !PRIORITY_REGION_DEFS.some((d) => d.regions.includes(r) && d.key === r))
      .map((r) => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`),
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
${analyticsHeadHtml}
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="index, follow">
  <meta name="description" content="${escapeHtml(desc)}">
  <title>${escapeHtml(title)}</title>
  <link rel="canonical" href="${canonical}">
  <link rel="icon" type="image/png" href="${DEFAULT_FAVICON}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="${DEFAULT_FAVICON}">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(desc)}">
  <meta property="twitter:image" content="${DEFAULT_FAVICON}">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cruise ports and destinations',
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: BASE_URL + '/' },
  })}</script>
  <style>${INDEX_STYLES}
${PORTS_DIRECTORY_EXTRA_CSS}
</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    <header class="header">${buildDirectoryHeaderNav()}</header>
    <section class="directory-hero" aria-labelledby="ports-title">
      <div class="directory-hero-copy">
        <h1 id="ports-title">Explore Cruise Ports &amp; Destinations</h1>
        <p>Discover cruise ports, destinations, and port guides. Search by name, or browse Region → Country → Port—the same clear hierarchy as our ships directory.</p>
        <div class="directory-cta-row">
          <a class="directory-btn directory-btn-primary" href="/#download">Download SeaDays</a>
          <a class="directory-btn" href="/blog/">Read destination guides</a>
        </div>
      </div>
      <div class="directory-hero-art" aria-hidden="true">
        <img src="https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20planner.jpg" alt="" loading="lazy" decoding="async">
      </div>
    </section>

    <section class="directory-section" aria-label="Search ports">
      <div class="directory-section-head">
        <h2>Search</h2>
        <span class="directory-section-note">Jump straight to a port, city, or country</span>
      </div>
      <div class="directory-search-wrap">
        <label class="sr-only" for="portSearch">Search ports by name or country</label>
        <input id="portSearch" class="directory-search" type="search" placeholder="Search ports by name or country" autocomplete="off">
        <div id="portSearchResults" class="search-results" role="listbox" aria-label="Search results"></div>
      </div>
    </section>

    <section class="directory-section" aria-label="Browse by region">
      <div class="directory-section-head">
        <h2>Browse by Region</h2>
        <span class="directory-section-note">Region → Country → Ports</span>
      </div>
      <div class="region-grid" id="regionBrowse">
${regionCardsHtml}
      </div>
      ${
        otherRegionCount
          ? `<div class="region-more-wrap">
        <button type="button" class="region-more-toggle" id="regionMoreToggle" aria-expanded="false">View all regions</button>
        <div class="region-more-panel" id="regionMorePanel">
          <div class="region-more-scroll pill-row" role="list">${otherRegionsHtml}</div>
        </div>
      </div>`
          : ''
      }
    </section>

    <section class="directory-section" aria-label="Browse by country">
      <div class="directory-section-head">
        <h2>Browse by Country</h2>
        <span class="directory-section-note" id="countryHeading">All regions</span>
      </div>
      <p class="country-empty" id="countryEmpty">Select a region to see its countries, or search above.</p>
      <div class="country-grid" id="countryBrowse"></div>
    </section>

    <section class="directory-controls" aria-label="Filters">
      <div class="filter-bar">
        <label class="sr-only" for="filterRegion">Region</label>
        <select id="filterRegion" class="filter-select">${filterRegionOptions}</select>
        <label class="sr-only" for="filterCountry">Country</label>
        <select id="filterCountry" class="filter-select"><option value="__all__">All Countries</option></select>
        <label class="sr-only" for="filterBookable">Experiences</label>
        <select id="filterBookable" class="filter-select">
          <option value="__all__">All ports</option>
          <option value="bookable">Bookable experiences</option>
        </select>
        <label class="sr-only" for="filterSort">Sort</label>
        <select id="filterSort" class="filter-select">
          <option value="name" selected>Sort: Name</option>
          <option value="country">Sort: Country</option>
          <option value="popular">Sort: Popular</option>
        </select>
      </div>
      <p class="results-meta" id="resultsMeta"></p>
    </section>

    <div class="seo-directory-grid" id="directoryGrid">${cards}</div>
    <section class="app-cta" aria-label="App call to action">
      <div class="app-cta-inner">
        <div>
          <strong>Want the full reviews?</strong>
          <span>Download SeaDays to read and leave reviews for ports and ships.</span>
        </div>
        <a class="directory-btn directory-btn-primary" href="/#download">Get the app</a>
      </div>
    </section>
    <section class="featured-guides" aria-label="Popular destination guides">
      <h2>Popular destination guides</h2>
      <div class="featured-guides-grid">${
        featuredGuideCardsHtml ||
        `<a class="guide-card" href="/blog/"><div class="guide-card-body"><p class="guide-card-title">SeaDays cruise blog</p><p class="guide-card-meta">Browse destination guides and shore-day tips</p></div></a>`
      }</div>
    </section>
    <article class="seo-prose">
      <h2>Plan smarter shore days</h2>
      <p>Ports are where itineraries become real: timing, walk-off convenience, excursion windows, and how far you can roam before all-aboard. A strong plan balances must-see sights with buffer for weather, traffic, and the simple joy of wandering.</p>
      <p>SeaDays connects <a href="/ships/">ship choice</a> with <a href="/blog/">destination guides from our blog</a> so you can line up sea days, overnight stays, and back-to-back sea-and-port rhythms that match your travel style.</p>
      <h2>Regions, countries, and gateway cities</h2>
      <p>Browse like our ships directory: start from a region, narrow by country, then open a port guide. Each link opens a static port guide; terminals, safety notes, and fresher crowd patterns load in the SeaDays app.</p>
      <p>When you are ready to compare vessels for these regions, return to the <a href="/ships/">ships directory</a> and cross-check cabins, dining, and entertainment before you commit.</p>
    </article>
    <footer class="footer">
      <div class="container">
        <div class="footer-content">
          <div class="footer-section"><h4>Product</h4><ul><li><a href="/#download">Download</a></li></ul></div>
          <div class="footer-section"><h4>Guides</h4><ul><li><a href="/blog/">Blog</a></li><li><a href="/ships/">Ships</a></li></ul></div>
          <div class="footer-section"><h4>Legal</h4><ul><li><a href="https://seadays.app/privacy.html">Privacy</a></li><li><a href="https://seadays.app/terms.html">Terms</a></li></ul></div>
        </div>
        <div class="footer-bottom"><p>&copy; 2026 SeaDays. All rights reserved.</p></div>
      </div>
    </footer>
  </div>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  <script>${buildPortsDirectoryClientScript()}
  </script>
  ${runtimeGuardScript}
</body>
</html>`;
}

module.exports = {
  buildPortsIndexHtml,
  resolveDirectoryPorts,
  DIRECTORY_ALIAS_TO_CANONICAL,
  CANONICAL_DISPLAY,
  PRIORITY_REGION_DEFS,
  shortDirectoryBlurb,
};

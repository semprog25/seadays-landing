'use strict';

/**
 * Ports & Destinations directory index (Region → Country → Ports).
 * Presentation-layer only — does not delete or rewrite individual port URLs.
 */

const { getFaviconHeadHtml } = require('./faviconHead');
const {
  getSiteHeaderHtml,
  getSiteFooterHtml,
  getSiteShellCssLinkHtml,
} = require('./siteShell');
const fs = require('fs');
const path = require('path');
const buildPortsDirectoryClientScriptSource = require('./portsDirectoryIndex.client');

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
  'doha-port-qatar': 'doha-qatar',
};

/** Canonical display names + search aliases for known duplicate destinations. */
const CANONICAL_DISPLAY = {
  'kochi-india': { displayName: 'Kochi', aliases: ['kochi', 'cochin', 'cochin port'] },
  'chennai-india': { displayName: 'Chennai', aliases: ['chennai', 'chennai port', 'madras'] },
  'mumbai-india': { displayName: 'Mumbai', aliases: ['mumbai', 'mumbai port', 'bombay'] },
  'visakhapatnam-india': { displayName: 'Visakhapatnam', aliases: ['visakhapatnam', 'vizag'] },
  'doha-qatar': { displayName: 'Doha', aliases: ['doha', 'doha port'] },
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

/** Editorial default set shown before region/search/browse-all (12 ports). */
const DEFAULT_FEATURED_SLUGS = [
  'barcelona-spain',
  'miami-fl-united-states',
  'cozumel-mexico',
  'santorini-greece',
  'nassau-bahamas',
  'juneau-ak-united-states',
  'hamburg-germany',
  'sydney-australia',
  'dubrovnik-croatia',
  'san-juan-puerto-rico',
  'southampton-united-kingdom',
  'singapore-singapore',
];

const DIRECTORY_PAGE_SIZE = 24;
const DIRECTORY_FEATURED_SIZE = 12;

function isDirectoryPlaceholderImage(url) {
  const s = String(url || '').trim();
  return !s || s.includes('seadaysfav.png');
}

function loadRegionImageManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, 'data', 'ports-directory-region-images.json');
  if (!fs.existsSync(manifestPath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return raw.regions && typeof raw.regions === 'object' ? raw.regions : {};
  } catch {
    return {};
  }
}

/** When a port has no hero/og image, reuse curated region photography from the directory manifest. */
function applyDirectoryImageFromRegionManifest(port, regionImages) {
  const current = String(port.directoryImageUrl || port.image_url || '').trim();
  if (!isDirectoryPlaceholderImage(current)) return current;
  const images = regionImages && typeof regionImages === 'object' ? regionImages : {};
  for (const def of PRIORITY_REGION_DEFS) {
    if (!def.regions.includes(port.region)) continue;
    const meta = images[def.key];
    const candidate = String(meta?.imageUrl || '').trim();
    if (!isDirectoryPlaceholderImage(candidate)) {
      port.directoryImageUrl = candidate;
      return candidate;
    }
  }
  const direct = images[port.region];
  const candidate = String(direct?.imageUrl || '').trim();
  if (!isDirectoryPlaceholderImage(candidate)) {
    port.directoryImageUrl = candidate;
    return candidate;
  }
  return current;
}

function buildPortCardImageHtml(port) {
  const url = String(port.directoryImageUrl || port.image_url || '').trim();
  const alt = `${port.displayName}, ${port.country}`;
  if (isDirectoryPlaceholderImage(url)) {
    return `<span class="directory-card-image directory-card-image--placeholder" role="img" aria-label="${escapeHtml(alt)}"></span>`;
  }
  return (
    `<img class="directory-card-image img-loading" src="${escapeHtml(url)}" alt="${escapeHtml(alt)}" ` +
    `width="400" height="225" loading="lazy" decoding="async" data-img-source="directory" ` +
    `onload="this.classList.remove('img-loading')">`
  );
}

function buildNoScriptCrawlLinksHtml(directoryPorts) {
  const links = directoryPorts
    .slice()
    .sort((a, b) => compareLabelsAz(a.displayName, b.displayName))
    .map(
      (port) =>
        `<li><a href="/ports/${escapeHtml(port.slug)}/">${escapeHtml(port.displayName)}${
          port.country ? `, ${escapeHtml(port.country)}` : ''
        }</a></li>`
    )
    .join('\n');
  return (
    `<noscript><section class="directory-crawl-fallback" aria-label="All cruise port guides">` +
    `<h2>All port guides</h2><ul class="directory-crawl-list">${links}</ul></section></noscript>`
  );
}

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

const { isBoilerplateDescription } = require('./portCopyHygiene');

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

function buildRegionBrowseHtml(directoryPorts, regionImages) {
  const images = regionImages && typeof regionImages === 'object' ? regionImages : {};
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
    const imgMeta = images[def.key] || {};
    const imgUrl = String(imgMeta.imageUrl || '').trim();
    const imgAlt = String(imgMeta.alt || def.label).trim();
    const imgHtml = imgUrl
      ? `<img class="region-card-image" src="${escapeHtml(imgUrl)}" alt="" loading="lazy" decoding="async" width="320" height="180">`
      : `<span class="region-card-image region-card-image--placeholder" aria-hidden="true"></span>`;
    cards.push(
      `<button type="button" class="region-card" data-region-key="${escapeHtml(def.key)}" ` +
        `data-regions="${escapeHtml(available.join('|'))}" aria-pressed="false">` +
        imgHtml +
        `<span class="region-card-body">` +
        `<span class="region-card-name">${escapeHtml(def.label)}</span>` +
        `<span class="region-card-count">${count} port${count === 1 ? '' : 's'}</span>` +
        `</span></button>`
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
      const reviewCountNum = Number(port.reviewCount);
      const ratingHtml =
        fr.display && Number.isFinite(reviewCountNum) && reviewCountNum > 0
          ? `<span class="rating-pill">${escapeHtml(fr.display)} ★ · ${escapeHtml(String(Math.round(reviewCountNum)))} review${reviewCountNum === 1 ? '' : 's'}</span>`
          : '';
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
      const featured = DEFAULT_FEATURED_SLUGS.includes(port.slug) ? '1' : '0';
      const imageHtml = buildPortCardImageHtml(port);
      return (
        `<a href="/ports/${escapeHtml(port.slug)}/" class="seo-grid-card directory-card" ` +
        `data-group="${escapeHtml(port.region)}" data-item="${escapeHtml(port.slug)}" ` +
        `data-name="${escapeHtml(normalizeSearch(port.displayName))}" ` +
        `data-country="${escapeHtml(normalizeSearch(port.country))}" ` +
        `data-region="${escapeHtml(port.region)}" ` +
        `data-aliases="${escapeHtml(port.searchAliases)}" ` +
        `data-bookable="${port.hasBookableExperiences ? '1' : '0'}" ` +
        `data-featured="${featured}" ` +
        `data-rating="${escapeHtml(ratingVal)}" data-reviews="${escapeHtml(reviewCount)}">` +
        imageHtml +
        `<span class="directory-card-body">` +
        `<span class="seo-grid-card-title">${escapeHtml(port.displayName)}</span>` +
        `<span class="seo-grid-card-meta">${escapeHtml(port.country)}${
          port.region ? ` · ${escapeHtml(port.region)}` : ''
        }</span>` +
        blurbHtml +
        bookableHtml +
        `<span class="seo-grid-card-bottom">` +
        ratingHtml +
        `<span class="seo-grid-card-hint">Open Port Guide →</span>` +
        `</span></span>` +
        `</a>`
      );
    })
    .join('\n');
}

function buildDirectoryHeaderNav() {
  return getSiteHeaderHtml({ page: 'default' });
}

const PORTS_DIRECTORY_EXTRA_CSS = `
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.seo-prose { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.75; }
.seo-prose h2 { font-size: 26px; margin: 32px 0 16px; font-weight: 800; color: #fff; }
.seo-prose p { margin-bottom: 18px; }
.seo-prose a { color: var(--neon-red); text-decoration: none; font-weight: 600; }
.seo-prose a:hover { text-decoration: underline; }
.directory-hero { max-width: 1200px; margin: 0 auto; padding: 120px 20px 20px; }
.directory-hero--compact { padding-bottom: 8px; }
.directory-hero h1 { font-size: clamp(2rem, 5vw, 2.75rem); font-weight: 900; letter-spacing: -1px; line-height: 1.08; margin-bottom: 10px; }
.directory-hero p { font-size: 17px; color: rgba(255,255,255,0.68); line-height: 1.55; margin-bottom: 12px; max-width: 42em; }
.directory-cta-row { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
.directory-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-size: 14px; }
.directory-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); transform: translateY(-1px); }
.directory-btn:focus-visible { outline: 2px solid var(--neon-red); outline-offset: 2px; }
.directory-btn-primary { background: rgba(255,0,51,0.18); border-color: rgba(255,0,51,0.4); }
.directory-btn-outline { background: transparent; }
.directory-section--search { margin-top: 0; padding-top: 8px; }
.directory-search-wrap--primary { max-width: 720px; margin: 0 auto; }
.directory-search--primary { padding: 16px 18px; font-size: 17px; border: 1px solid rgba(255,0,51,0.45); box-shadow: 0 0 0 1px rgba(255,0,51,0.2), 0 0 18px rgba(255,0,51,0.22); }
.directory-search--primary:focus { outline: none; border-color: rgba(255,0,51,0.78); box-shadow: 0 0 0 2px rgba(255,0,51,0.45); }
.directory-controls { max-width: 1200px; margin: 0 auto; padding: 0 20px 18px; }
.directory-section { max-width: 1200px; margin: 0 auto 22px; padding: 0 20px; }
.directory-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.directory-section-head h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 0; }
.directory-section-note { font-size: 13px; color: rgba(255,255,255,0.55); }
.directory-search-wrap { position: relative; max-width: 640px; width: 100%; margin: 0 auto 8px; }
.directory-search { width: 100%; max-width: none; margin: 0; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: #fff; font-size: 16px; font-weight: 600; }
.directory-search::placeholder { color: rgba(255,255,255,0.45); font-weight: 600; }
.directory-search:focus { outline: none; border-color: rgba(255,0,51,0.65); box-shadow: 0 0 0 1px rgba(255,0,51,0.35); }
.search-results { position: absolute; left: 0; right: 0; top: calc(100% + 8px); z-index: 40; max-height: 340px; overflow: auto; border-radius: 14px; border: 1px solid rgba(255,255,255,0.12); background: rgba(12,12,12,0.98); box-shadow: 0 16px 40px rgba(0,0,0,0.45); display: none; }
.search-results.is-open { display: block; }
.search-result-item { display: block; width: 100%; text-align: left; padding: 12px 14px; border: 0; border-bottom: 1px solid rgba(255,255,255,0.06); background: transparent; color: #fff; cursor: pointer; text-decoration: none; }
.search-result-item:last-child { border-bottom: 0; }
.search-result-item:hover, .search-result-item:focus { background: rgba(255,255,255,0.06); outline: none; }
.search-result-name { display: block; font-weight: 800; font-size: 15px; }
.search-result-meta { display: block; margin-top: 2px; font-size: 12px; color: rgba(255,255,255,0.55); }
.search-empty { padding: 14px; font-size: 13px; color: rgba(255,255,255,0.55); }
.region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 12px; }
.region-card { appearance: none; text-align: left; padding: 0; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; cursor: pointer; transition: border-color 0.2s, transform 0.2s, background 0.2s; overflow: hidden; display: flex; flex-direction: column; }
.region-card:hover { border-color: rgba(255,0,51,0.55); transform: translateY(-1px); }
.region-card[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.12); }
.region-card-image { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); }
.region-card-image--placeholder { min-height: 100px; }
.region-card-body { padding: 12px 14px 14px; }
.region-card-name { display: block; font-weight: 800; font-size: 15px; line-height: 1.25; }
.region-card-count { display: block; margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.region-more-wrap { margin-top: 14px; }
.region-more-toggle { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; min-height: 44px; }
.region-more-toggle:hover { border-color: rgba(255,0,51,0.55); }
.region-more-panel { display: none; margin-top: 12px; }
.region-more-panel.is-open { display: block; }
.region-more-scroll { display: flex; flex-wrap: nowrap; gap: 10px; overflow-x: auto; padding-bottom: 4px; -webkit-overflow-scrolling: touch; }
.region-more-scroll .pill { flex: 0 0 auto; }
.country-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
.country-card { appearance: none; text-align: left; padding: 14px 16px; border-radius: 14px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); color: #fff; cursor: pointer; transition: border-color 0.2s, background 0.2s; min-height: 44px; }
.country-card:hover { border-color: rgba(255,0,51,0.55); }
.country-card[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.12); }
.country-card-name { display: block; font-weight: 800; font-size: 16px; line-height: 1.2; }
.country-card-count { display: block; margin-top: 4px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.country-empty { font-size: 14px; color: rgba(255,255,255,0.55); padding: 8px 0; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 14px; }
.filter-select { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.92); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 13px; cursor: pointer; min-height: 44px; }
.filter-select:focus { outline: 2px solid var(--neon-red); outline-offset: 2px; }
.filter-select option { color: #111; }
.results-meta { font-size: 13px; color: rgba(255,255,255,0.55); margin: 0 0 12px; }
.pill-row { display: flex; flex-wrap: wrap; gap: 10px; }
.pill { appearance: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); padding: 10px 14px; border-radius: 999px; font-weight: 700; font-size: 14px; cursor: pointer; min-height: 44px; }
.pill:hover { border-color: rgba(255,0,51,0.55); }
.pill[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.12); }
.region-card:focus-visible, .country-card:focus-visible, .pill:focus-visible { outline: 2px solid var(--neon-red); outline-offset: 2px; }
.seo-grid-card:focus-visible { outline: 2px solid var(--neon-red); outline-offset: 3px; }
.seo-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; padding: 0 20px 24px; max-width: 1200px; margin: 0 auto; }
.seo-grid-card { display: flex; flex-direction: column; gap: 0; padding: 0; border-radius: 16px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s; overflow: hidden; }
.directory-card-body { display: flex; flex-direction: column; gap: 8px; padding: 14px 16px 16px; }
.directory-card-image { width: 100%; aspect-ratio: 16 / 9; object-fit: cover; display: block; background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(20,20,20,0.9)); }
.directory-card-image--placeholder { min-height: 140px; }
.directory-card.is-filter-hidden, .directory-card.is-page-hidden { display: none !important; }
.directory-empty { max-width: 1200px; margin: 0 auto 16px; padding: 0 20px; color: rgba(255,255,255,0.62); font-size: 15px; }
.directory-load-more-wrap { max-width: 1200px; margin: 0 auto 48px; padding: 0 20px; text-align: center; }
.directory-load-more { min-width: min(100%, 280px); }
.directory-crawl-fallback { max-width: 900px; margin: 0 auto 48px; padding: 0 20px; color: rgba(255,255,255,0.78); }
.directory-crawl-list { columns: 2; column-gap: 24px; list-style: none; padding: 0; margin: 12px 0 0; }
.directory-crawl-list li { break-inside: avoid; margin-bottom: 6px; }
.directory-crawl-list a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
.directory-crawl-list a:hover { text-decoration: underline; }
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
.guide-card:hover { border-color: rgba(255,0,51,0.75); transform: translateY(-2px); }
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
  .directory-hero { padding-top: 100px; }
  .directory-hero h1 { font-size: 2rem; }
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
  return buildPortsDirectoryClientScriptSource();
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
  const INDEX_STYLES = opts.indexStyles || '';
  const analyticsHeadHtml = opts.analyticsHeadHtml || '';
  const runtimeGuardScript = opts.runtimeGuardScript || '';
  const featuredGuideCardsHtml =
    typeof opts.featuredGuideCardsHtml === 'string' ? opts.featuredGuideCardsHtml : '';

  const canonical = `${BASE_URL}/ports/`;
  const title = 'Cruise Ports & Destinations | SeaDays';
  const desc =
    'Explore cruise ports and destinations: browse by region and country, search port guides, and plan shore days with SeaDays.';

  const regionImages = opts.regionImages && typeof opts.regionImages === 'object' ? opts.regionImages : {};
  const { directoryPorts } = resolveDirectoryPorts(opts.ports);
  const { regionCardsHtml, otherRegionsHtml, otherRegionCount } = buildRegionBrowseHtml(
    directoryPorts,
    regionImages
  );
  const cards = buildPortCardsHtml(directoryPorts);
  const noscriptLinksHtml = buildNoScriptCrawlLinksHtml(directoryPorts);

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
${getFaviconHeadHtml()}
  <meta property="og:type" content="website">
  <meta property="og:url" content="${canonical}">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(desc)}">
  <meta property="og:image" content="https://seadays.app/og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:type" content="image/png">
  <meta property="og:image:alt" content="SeaDays — plan your cruise in one app">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:url" content="${canonical}">
  <meta property="twitter:title" content="${escapeHtml(title)}">
  <meta property="twitter:description" content="${escapeHtml(desc)}">
  <meta property="twitter:image" content="https://seadays.app/og-image.png">
  <script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Cruise ports and destinations',
    description: desc,
    url: canonical,
    isPartOf: { '@type': 'WebSite', name: 'SeaDays', url: BASE_URL + '/' },
  })}</script>
  ${getSiteShellCssLinkHtml()}
  <style>${INDEX_STYLES}
${PORTS_DIRECTORY_EXTRA_CSS}
</style>
</head>
<body>
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    ${buildDirectoryHeaderNav()}
    <section class="directory-hero directory-hero--compact" aria-labelledby="ports-title">
      <div class="directory-hero-copy">
        <h1 id="ports-title">Cruise ports &amp; destinations</h1>
        <p>Search for a port or browse by region and country. Every card opens a static port guide—same URLs, clearer discovery.</p>
        <div class="directory-cta-row">
          <a class="directory-btn directory-btn-primary" href="/download/?utm_source=seadays_web&amp;utm_medium=port_guide&amp;utm_campaign=port_guide">Get SeaDays</a>
        </div>
      </div>
    </section>

    <section class="directory-section directory-section--search" aria-label="Search ports">
      <div class="directory-search-wrap directory-search-wrap--primary">
        <label class="sr-only" for="portSearch">Search ports by name or country</label>
        <input id="portSearch" class="directory-search directory-search--primary" type="search" placeholder="Search ports by name or country" autocomplete="off">
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
        </select>
        <button type="button" class="directory-btn directory-btn-outline" id="directoryReset" aria-label="Reset all filters">Reset</button>
        <button type="button" class="directory-btn directory-btn-outline" id="browseAllPorts">Browse all ports</button>
      </div>
      <p class="results-meta" id="resultsMeta" aria-live="polite"></p>
    </section>

    <p class="directory-empty" id="directoryEmpty" hidden>No ports match these filters.</p>
    <div class="seo-directory-grid" id="directoryGrid">${cards}</div>
    <div class="directory-load-more-wrap">
      <button type="button" class="directory-btn directory-btn-outline directory-load-more" id="directoryLoadMore" hidden>Load more ports</button>
    </div>
    ${noscriptLinksHtml}
    <section class="app-cta" aria-label="App call to action">
      <div class="app-cta-inner">
        <div>
          <strong>Want the full reviews?</strong>
          <span>Download SeaDays to read and leave reviews for ports and ships.</span>
        </div>
        <a class="directory-btn directory-btn-primary" href="/download/?utm_source=seadays_web&amp;utm_medium=port_guide&amp;utm_campaign=port_guide">Get SeaDays</a>
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
    ${getSiteFooterHtml()}
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
  loadRegionImageManifest,
  applyDirectoryImageFromRegionManifest,
  DIRECTORY_ALIAS_TO_CANONICAL,
  CANONICAL_DISPLAY,
  PRIORITY_REGION_DEFS,
  DEFAULT_FEATURED_SLUGS,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_FEATURED_SIZE,
  shortDirectoryBlurb,
  isDirectoryPlaceholderImage,
};

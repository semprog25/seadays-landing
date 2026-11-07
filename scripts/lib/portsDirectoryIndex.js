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
const {
  buildNoPhotoRegionOrCountryMediaHtml,
  NO_PHOTO_OBJECT_FIT_CSS,
} = require('./seadaysNoPhotoAsset');
const buildPortsDirectoryClientScriptSource = require('./portsDirectoryIndex.client');
const { isApprovedDestinationPhotographyUrl } = require('./destinationImageSourcePolicy');
const { assessPortDirectoryThumbnail, ownerPortsDirectoryAssetExists } = require('./directoryThumbnailQuality');
const {
  buildDestinationDirectoryCardHtml,
  DESTINATION_DIRECTORY_CARD_CSS,
} = require('./destinationDirectoryCard');

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

const MEDITERRANEAN_COLLECTION_REGIONS = ['Greek Isles', 'Riviera', 'Balearic Islands'];
const ATLANTIC_COLLECTION_REGIONS = ['Atlantic Islands', 'Canary Islands'];
const NORTHERN_EUROPE_COLLECTION_REGIONS = ['Scandinavia', 'North Sea', 'Arctic'];
const FJORDS_COLLECTION_REGIONS = ['Lofoten', 'Southern Norway'];
const BRITISH_ISLES_COLLECTION_REGIONS = ['Scotland', 'Northern Ireland'];

/** Catalogue regions rolled into virtual browse cards — never top-level region tiles. */
const SUBSUMED_CATALOG_REGIONS = new Set([
  ...NORTH_AMERICA_REGIONS,
  'Australia',
  'New Zealand',
  ...MEDITERRANEAN_COLLECTION_REGIONS,
  ...ATLANTIC_COLLECTION_REGIONS,
  ...NORTHERN_EUROPE_COLLECTION_REGIONS,
  ...FJORDS_COLLECTION_REGIONS,
  ...BRITISH_ISLES_COLLECTION_REGIONS,
]);

/** US catalogue region → visitor-facing sub-area label (browse + cards). */
const US_DATA_REGION_BROWSE_LABEL = {
  South: 'Southern US',
};

function isUnitedStatesCountry(country) {
  return normalizeSearch(country) === 'united states';
}

function displayRegionLineForPort(port) {
  const country = String(port.country || '').trim();
  const region = String(port.region || '').trim();
  if (!region) return country;
  if (isUnitedStatesCountry(country) && US_DATA_REGION_BROWSE_LABEL[region]) {
    return `${country} · ${US_DATA_REGION_BROWSE_LABEL[region]}`;
  }
  return `${country} · ${region}`;
}

function catalogBrowseSubregionKey(port) {
  const region = String(port.region || '').trim();
  if (!region) return '';
  if (isUnitedStatesCountry(port.country)) {
    const label = US_DATA_REGION_BROWSE_LABEL[region] || region;
    return normalizeSearch(label);
  }
  return normalizeSearch(region);
}

function usBrowseSubregionKey(port) {
  if (!isUnitedStatesCountry(port.country)) return '';
  return catalogBrowseSubregionKey(port);
}

const PRIORITY_REGION_DEFS = [
  {
    key: 'Mediterranean',
    label: 'Mediterranean',
    regions: ['Mediterranean', ...MEDITERRANEAN_COLLECTION_REGIONS],
  },
  { key: 'Caribbean', label: 'Caribbean', regions: ['Caribbean'] },
  {
    key: 'Northern Europe',
    label: 'Northern Europe',
    regions: ['Northern Europe', ...NORTHERN_EUROPE_COLLECTION_REGIONS],
  },
  { key: 'Baltic', label: 'Baltic Sea', regions: ['Baltic'] },
  {
    key: 'Fjords',
    label: 'Norwegian Fjords',
    regions: ['Fjords', ...FJORDS_COLLECTION_REGIONS],
  },
  {
    key: 'British Isles',
    label: 'British Isles',
    regions: ['British Isles', ...BRITISH_ISLES_COLLECTION_REGIONS],
  },
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
  {
    key: 'Atlantic',
    label: 'Atlantic',
    regions: ['Atlantic', ...ATLANTIC_COLLECTION_REGIONS],
  },
  { key: 'South America', label: 'South America', regions: ['South America'] },
  { key: 'Middle East', label: 'Middle East', regions: ['Middle East'] },
  { key: 'Private Island', label: 'Private Island', regions: ['Private Island'] },
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
  return !s || s.includes('seadaysfav.png') || s.includes('seadays-no-image.webp');
}

function loadRegionImageManifest(repoRoot) {
  const { loadRegionImageManifest: loadMerged } = require('./portsDirectoryRegionImages');
  return loadMerged(repoRoot);
}

function portHasVerifiedDirectoryPhoto(port) {
  return resolveVerifiedPortDirectoryImageUrl(port, path.join(__dirname, '..', '..')).hasVerifiedPhoto;
}

/**
 * Only surface directory photos that pass policy, quality, and on-disk asset checks.
 * @returns {{ hasVerifiedPhoto: boolean, imgUrl: string }}
 */
function resolveVerifiedPortDirectoryImageUrl(port, repoRoot) {
  const url = String(port.directoryImageUrl || port.image_url || '').trim();
  if (isDirectoryPlaceholderImage(url)) {
    return { hasVerifiedPhoto: false, imgUrl: '' };
  }
  if (!isApprovedDestinationPhotographyUrl(url)) {
    return { hasVerifiedPhoto: false, imgUrl: '' };
  }
  const quality = assessPortDirectoryThumbnail(url, { slug: port.slug }, repoRoot);
  if (!quality.ok) {
    return { hasVerifiedPhoto: false, imgUrl: '' };
  }
  if (url.startsWith('/assets/') && !ownerPortsDirectoryAssetExists(url, repoRoot)) {
    return { hasVerifiedPhoto: false, imgUrl: '' };
  }
  return { hasVerifiedPhoto: true, imgUrl: url };
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

/** Public region-carousel alt only — never internal geography/licence QA strings. */
function sanitizePublicRegionCardImageAlt(regionKey, alt, fallbackLabel) {
  const raw = String(alt || fallbackLabel || '').trim();
  const key = String(regionKey || '').trim();
  if (
    key === 'Alaska' &&
    (/confirm geography/i.test(raw) || /owner-provided download/i.test(raw))
  ) {
    return 'Alaska cruise region';
  }
  if (/confirm licen[sc]e and geography before production/i.test(raw)) {
    return `${String(fallbackLabel || key || 'Cruise').trim()} cruise region`;
  }
  return raw;
}

function buildRegionCardButton(def, imgMeta) {
  const imgUrl = String(imgMeta?.imageUrl || '').trim();
  const imgAlt = sanitizePublicRegionCardImageAlt(def.key, imgMeta?.alt, def.label);
  const imgHtml = imgUrl
    ? `<span class="region-card-media"><img class="region-card-image" src="${escapeHtml(imgUrl)}" alt="${escapeHtml(imgAlt)}" loading="lazy" decoding="async" width="320" height="180"></span>`
    : buildNoPhotoRegionOrCountryMediaHtml('region-card-image');
  const cardClass = 'region-card';
  return (
    `<button type="button" class="${cardClass}" data-region-key="${escapeHtml(def.key)}" ` +
    `data-regions="${escapeHtml(def.regions.join('|'))}" aria-pressed="false" ` +
    `aria-label="${escapeHtml(def.label)}, ${def.count} port${def.count === 1 ? '' : 's'}">` +
    imgHtml +
    `<span class="region-card-body">` +
    `<span class="region-card-name">${escapeHtml(def.label)}</span>` +
    `<span class="region-card-count">${def.count} port${def.count === 1 ? '' : 's'}</span>` +
    `</span></button>`
  );
}

function buildRegionBrowseHtml(directoryPorts, regionImages, verifiedBySlug, repoRoot) {
  const images = regionImages && typeof regionImages === 'object' ? regionImages : {};
  const presentRegions = new Set(directoryPorts.map((p) => p.region));
  const priorityKeys = new Set();
  const cardEntries = [];
  const root = repoRoot || '';

  const { resolveCatalogRegionBrowseImage } = require('./portsDirectoryRegionImages');

  const priorityDefsAz = PRIORITY_REGION_DEFS.slice().sort((a, b) => compareLabelsAz(a.label, b.label));
  for (const def of priorityDefsAz) {
    const available = def.regions.filter((r) => presentRegions.has(r));
    if (!available.length) continue;
    const count = countPortsForRegions(directoryPorts, available);
    if (!count) continue;
    available.forEach((r) => priorityKeys.add(r));
    const imgMeta =
      images[def.key] ||
      resolveCatalogRegionBrowseImage(def.key, root, directoryPorts, verifiedBySlug);
    cardEntries.push({
      label: def.label,
      html: buildRegionCardButton(
        { key: def.key, label: def.label, regions: available, count },
        imgMeta
      ),
    });
  }

  const otherRegions = [...presentRegions]
    .filter((r) => !priorityKeys.has(r) && !SUBSUMED_CATALOG_REGIONS.has(r))
    .sort(compareLabelsAz);

  for (const region of otherRegions) {
    const count = countPortsForRegions(directoryPorts, [region]);
    const imgMeta = resolveCatalogRegionBrowseImage(
      region,
      root,
      directoryPorts,
      verifiedBySlug
    );
    cardEntries.push({
      label: region,
      html: buildRegionCardButton(
        { key: region, label: region, regions: [region], count },
        imgMeta
      ),
    });
  }

  cardEntries.sort((a, b) => compareLabelsAz(a.label, b.label));

  return {
    regionCardsHtml: cardEntries.map((e) => e.html).join('\n'),
    regionCardCount: cardEntries.length,
  };
}

function buildPortCardsHtml(directoryPorts, repoRoot) {
  const root = repoRoot || path.join(__dirname, '..', '..');
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
      const featured = DEFAULT_FEATURED_SLUGS.includes(port.slug) ? '1' : '0';
      const blurbHtml = '';
      const bookableHtml = port.hasBookableExperiences
        ? `<span class="seo-grid-card-bookable">Bookable experiences available</span>`
        : '';
      const ratingVal =
        typeof port.rating === 'number' && Number.isFinite(port.rating) ? String(port.rating) : '';
      const reviewCount =
        typeof port.reviewCount === 'number' && Number.isFinite(port.reviewCount)
          ? String(port.reviewCount)
          : '0';
      const resolved = resolveVerifiedPortDirectoryImageUrl(port, root);
      const hasVerifiedPhoto = resolved.hasVerifiedPhoto;
      const imgUrl = resolved.imgUrl;
      const dataAttrs =
        `data-group="${escapeHtml(port.region)}" data-item="${escapeHtml(port.slug)}" ` +
        `data-name="${escapeHtml(normalizeSearch(port.displayName))}" ` +
        `data-country="${escapeHtml(normalizeSearch(port.country))}" ` +
        `data-region="${escapeHtml(port.region)}" ` +
        `data-browse-subregion="${escapeHtml(catalogBrowseSubregionKey(port))}" ` +
        `data-aliases="${escapeHtml(port.searchAliases)}" ` +
        `data-bookable="${port.hasBookableExperiences ? '1' : '0'}" ` +
        `data-featured="${featured}" ` +
        `data-verified-photo="${hasVerifiedPhoto ? '1' : '0'}" ` +
        `data-rating="${escapeHtml(ratingVal)}" data-reviews="${escapeHtml(reviewCount)}"`;

      return buildDestinationDirectoryCardHtml({
        href: `/ports/${port.slug}/`,
        dataAttrs,
        title: port.displayName,
        meta: displayRegionLineForPort(port),
        hint: 'Open Port Guide →',
        imgUrl,
        alt: `${port.displayName}, ${port.country}`,
        objectPosition: port.directoryImageObjectPosition,
        blurbHtml,
        bookableHtml,
        ratingHtml,
      });
    })
    .join('\n');
}

function buildDirectoryHeaderNav() {
  return getSiteHeaderHtml({ page: 'default', activeNav: 'ports' });
}

/**
 * Best verified destination photo per country key (normalized), for country browse cards.
 * @param {Array} directoryPorts
 * @param {string} repoRoot
 */
function buildCountryImagesManifest(directoryPorts, repoRoot) {
  const root = repoRoot || path.join(__dirname, '..', '..');
  const manifest = Object.create(null);
  const countryKeys = new Set();
  for (const port of directoryPorts) {
    const key = normalizeSearch(port.country);
    if (!key) continue;
    countryKeys.add(key);
    if (manifest[key]) {
      const existingUrl = String(manifest[key].url || '').trim();
      if (
        existingUrl &&
        (!existingUrl.startsWith('/assets/') || ownerPortsDirectoryAssetExists(existingUrl, root))
      ) {
        continue;
      }
    }
    const url = String(port.directoryImageUrl || '').trim();
    if (!url || url.includes('seadaysfav.png')) continue;
    const quality = assessPortDirectoryThumbnail(url, { slug: port.slug }, root);
    if (!quality.ok) continue;
    if (url.startsWith('/assets/') && !ownerPortsDirectoryAssetExists(url, root)) continue;
    manifest[key] = {
      url,
      alt: `${port.country} cruise destinations`,
      label: port.country,
      sourcePortSlug: port.slug,
      verification: quality.reason,
    };
  }
  const overridesPath = path.join(root, 'data', 'ports-directory-country-images.json');
  if (fs.existsSync(overridesPath)) {
    try {
      const overrides = JSON.parse(fs.readFileSync(overridesPath, 'utf8'));
      const byKey = overrides.countries && typeof overrides.countries === 'object' ? overrides.countries : {};
      for (const [key, entry] of Object.entries(byKey)) {
        const normKey = normalizeSearch(key);
        const url = String(entry?.url || '').trim();
        if (!normKey || !url) continue;
        const quality = assessPortDirectoryThumbnail(url, { slug: entry.sourcePortSlug || '' }, root);
        if (!quality.ok && !url.startsWith('/assets/')) continue;
        if (url.startsWith('/assets/') && !ownerPortsDirectoryAssetExists(url, root)) continue;
        manifest[normKey] = {
          url,
          alt: String(entry.alt || entry.label || key).trim(),
          label: String(entry.label || key).trim(),
          sourcePortSlug: entry.sourcePortSlug || '',
          verification: entry.verification || 'override',
        };
        if (entry.attributionRequired) {
          manifest[normKey].attributionRequired = true;
          manifest[normKey].photographer = String(entry.photographer || '').trim();
          manifest[normKey].licenseTerms = String(entry.licenseTerms || '').trim();
          manifest[normKey].licenseUrl = String(entry.licenseUrl || '').trim();
          manifest[normKey].sourcePageUrl = String(entry.sourcePageUrl || '').trim();
        }
      }
    } catch {
      /* keep manifest from ports */
    }
  }
  return {
    manifest,
    countriesRepresented: countryKeys.size,
    countriesWithPhoto: Object.keys(manifest).length,
  };
}

const PORTS_DIRECTORY_EXTRA_CSS = `
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
.directory-scroll-target { scroll-margin-top: 92px; }
body.ports-directory-v2 { overflow-x: clip; scrollbar-color: rgba(255, 0, 51, 0.55) rgba(255, 255, 255, 0.08); scrollbar-width: thin; }
body.ports-directory-v2::-webkit-scrollbar { width: 10px; height: 10px; }
body.ports-directory-v2::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.06); }
body.ports-directory-v2::-webkit-scrollbar-thumb { background: rgba(255, 0, 51, 0.5); border-radius: 999px; border: 2px solid rgba(10, 10, 10, 0.85); }
body.ports-directory-v2::-webkit-scrollbar-thumb:hover { background: rgba(255, 0, 51, 0.72); }
@media (prefers-reduced-motion: reduce) { body.ports-directory-v2::-webkit-scrollbar-thumb:hover { background: rgba(255, 0, 51, 0.5); } }
.search-results { scrollbar-color: rgba(255, 0, 51, 0.55) rgba(255, 255, 255, 0.08); scrollbar-width: thin; }
.search-results::-webkit-scrollbar { width: 8px; }
.search-results::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.06); border-radius: 8px; }
.search-results::-webkit-scrollbar-thumb { background: rgba(255, 0, 51, 0.5); border-radius: 999px; }
.search-results::-webkit-scrollbar-thumb:hover { background: rgba(255, 0, 51, 0.72); }
.seo-prose { max-width: 900px; margin: 0 auto; padding: 0 20px 40px; color: rgba(255,255,255,0.82); font-size: 17px; line-height: 1.75; }
.seo-prose h2 { font-size: 26px; margin: 32px 0 16px; font-weight: 800; color: #fff; }
.seo-prose p { margin-bottom: 18px; }
.seo-prose a { color: var(--seadays-editorial-link, #79D8FF); font-weight: 650; text-decoration: underline; text-decoration-color: rgba(121,216,255,0.45); text-underline-offset: 3px; }
.seo-prose a:hover { color: var(--seadays-editorial-link-hover, #a8e8ff); text-decoration-color: rgba(168,232,255,0.75); }
body.ports-directory-v2 .directory-hero { max-width: 720px; margin: 0 auto; padding: 24px 20px 4px; text-align: center; }
@media (min-width: 721px) {
  body.ports-directory-v2 .directory-hero { padding-top: 36px; }
}
@media (min-width: 1025px) {
  body.ports-directory-v2 .directory-hero { padding-top: 48px; }
}
.directory-scroll-target { scroll-margin-top: calc(var(--site-header-height, 72px) + 16px); }
.directory-hero--compact { padding-bottom: 0; }
.directory-hero h1 { font-size: clamp(1.85rem, 4.5vw, 2.65rem); font-weight: 900; letter-spacing: -0.04em; line-height: 1.06; margin: 0 0 12px; color: #fff; }
.directory-hero p { font-size: 16px; color: rgba(255,255,255,0.58); line-height: 1.55; margin: 0 auto 16px; max-width: 34em; }
.directory-section--search { margin-top: 0; padding: 4px 20px 12px; }
.directory-search-wrap--primary { max-width: 620px; margin: 0 auto; }
.directory-search--primary { padding: 17px 20px 17px 44px; font-size: 17px; border-radius: 16px; border: 1px solid rgba(255,0,51,0.42); background: rgba(8,8,10,0.92); box-shadow: 0 0 0 1px rgba(255,0,51,0.18), 0 12px 40px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.04); background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' fill='none' stroke='%23FF0033' stroke-width='2' viewBox='0 0 24 24'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='M20 20l-3.5-3.5'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: 14px 50%; }
.directory-search--primary:hover { border-color: rgba(255,0,51,0.58); }
.directory-search--primary:focus { outline: none; border-color: rgba(255,0,51,0.82); box-shadow: 0 0 0 2px rgba(255,0,51,0.35), 0 12px 40px rgba(0,0,0,0.45); }
.directory-section--search .directory-search::placeholder { color: rgba(255,255,255,0.42); font-weight: 600; }
.directory-btn { display: inline-flex; align-items: center; justify-content: center; min-height: 44px; padding: 12px 18px; border-radius: 999px; font-weight: 700; text-decoration: none; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; cursor: pointer; font-size: 14px; transition: border-color 0.2s, box-shadow 0.2s; }
.directory-btn[hidden] { display: none !important; }
.directory-btn:hover { border-color: var(--neon-red); box-shadow: 0 10px 32px rgba(255, 0, 51, 0.18); }
.directory-btn:focus-visible { outline: 2px solid var(--neon-red); outline-offset: 2px; }
.directory-btn-primary { background: var(--seadays-brand-cta-bg, rgba(58, 10, 18, 0.92)); border-color: var(--seadays-brand-cta-border, rgba(255,0,51,0.52)); }
.directory-btn-outline { background: rgba(255,255,255,0.03); }
.directory-controls { max-width: 1200px; margin: 0 auto; padding: 0 20px 18px; }
.directory-section { max-width: 1200px; margin: 0 auto 20px; padding: 0 20px; }
.directory-section--region { margin-top: 4px; margin-bottom: 20px; }
.directory-section-head--region { flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 6px; margin-bottom: 14px; }
.directory-section-lead { margin: 0; font-size: 14px; line-height: 1.45; color: rgba(255,255,255,0.58); max-width: 28em; }
.directory-drill-nav { max-width: 1200px; margin: 0 auto 16px; padding: 0 20px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px 14px; }
.directory-drill-nav.is-discover-layout { justify-content: center; margin-top: 0; margin-bottom: 12px; }
.directory-drill-nav.is-discover-layout .directory-breadcrumb { display: none; }
.directory-drill-nav.is-discover-layout .directory-toolbar { width: 100%; justify-content: center; }
.directory-breadcrumb { margin: 0; flex: 1 1 200px; font-size: 13px; color: rgba(255,255,255,0.55); font-weight: 600; }
.directory-toolbar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.region-grid-wrap { position: relative; max-width: 100%; margin-top: 4px; }
.region-grid-wrap:not(.is-expanded)::after { content: ''; position: absolute; right: 0; top: 0; bottom: 72px; width: 28px; pointer-events: none; background: linear-gradient(to right, rgba(10,10,10,0), rgba(10,10,10,0.92)); }
.region-grid-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: center; gap: 8px 12px; margin: 14px 0 0; width: 100%; max-width: 100%; }
.region-scroll-hint { font-size: 12px; color: rgba(255,255,255,0.5); margin: 0 0 10px; font-weight: 600; text-align: center; width: 100%; }
.region-grid { display: flex; flex-wrap: nowrap; gap: 12px; overflow-x: auto; padding: 4px 2px 14px; -webkit-overflow-scrolling: touch; scroll-behavior: auto; scroll-snap-type: x proximity; scroll-padding-inline-start: 2px; scrollbar-width: thin; scrollbar-color: rgba(255, 0, 51, 0.55) rgba(255, 255, 255, 0.08); }
.directory-section--browse { margin-top: 8px; }
.filter-panel { border-radius: 18px; border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.025); padding: 14px 16px 12px; box-shadow: inset 0 1px 0 rgba(255,255,255,0.04); }
.directory-empty { max-width: 1200px; margin: 0 auto 16px; padding: 16px 18px; color: rgba(255,255,255,0.62); font-size: 15px; border-radius: 14px; border: 1px dashed rgba(255,255,255,0.14); text-align: center; background: rgba(255,255,255,0.02); }
.directory-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.directory-section-head h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 0; }
.directory-section-head--ports { max-width: 1200px; margin: 8px auto 10px; padding: 0 20px; }
.directory-section-head--ports h2 { font-size: 20px; letter-spacing: -0.03em; }
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
.region-grid-nav { display: inline-flex; gap: 8px; align-items: center; }
.region-scroll-btn { appearance: none; min-width: 44px; min-height: 44px; padding: 0 14px; border-radius: 999px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.05); color: #fff; font-weight: 800; font-size: 18px; line-height: 1; cursor: pointer; transition: border-color 0.2s, opacity 0.2s; }
.region-scroll-btn:hover:not(:disabled) { border-color: rgba(255,0,51,0.55); }
.region-scroll-btn:focus-visible { outline: 2px solid var(--neon-red); outline-offset: 2px; }
.region-scroll-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.region-expand-toggle { margin-left: 0; }
.region-grid::-webkit-scrollbar { height: 10px; }
.region-grid::-webkit-scrollbar-track { background: rgba(255, 255, 255, 0.06); border-radius: 999px; }
.region-grid::-webkit-scrollbar-thumb { background: rgba(255, 0, 51, 0.5); border-radius: 999px; border: 2px solid rgba(10, 10, 10, 0.85); }
.region-grid .region-card { flex: 0 0 min(72vw, 272px); max-width: 272px; scroll-snap-align: start; }
.region-grid-wrap.is-expanded .region-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; overflow: visible; flex-wrap: unset; padding-bottom: 0; }
.region-grid-wrap.is-expanded .region-grid .region-card { flex: unset; max-width: none; }
.region-grid-wrap.is-expanded .region-scroll-hint,
.region-grid-wrap.is-expanded .region-grid-nav { display: none; }
.region-grid-wrap.is-expanded .region-expand-toggle { margin-left: 0; }
@media (min-width: 901px) {
  .region-grid .region-card { flex: 0 0 min(42vw, 272px); }
}
.region-card { appearance: none; text-align: left; padding: 0; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(18,18,20,0.85); color: #fff; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; overflow: hidden; display: flex; flex-direction: column; min-width: 0; box-shadow: 0 8px 28px rgba(0,0,0,0.28); }
.region-card:hover { border-color: rgba(255,0,51,0.55); box-shadow: 0 12px 36px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,0,51,0.15); }
.region-card[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.1); box-shadow: 0 0 0 1px rgba(255,0,51,0.35); }
.region-card-media { position: relative; display: block; overflow: hidden; }
.region-card-media::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,0,51,0.06) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.72) 100%); }
.region-card-image { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); }
${NO_PHOTO_OBJECT_FIT_CSS}
.region-card--text-first { border-top: 3px solid rgba(255,0,51,0.35); }
.region-card--text-first .region-card-body { padding: 16px 15px 15px; background: rgba(14,14,16,0.95); }
.region-card-body { padding: 13px 15px 15px; min-width: 0; background: linear-gradient(180deg, rgba(14,14,16,0.2), rgba(14,14,16,0.95)); }
.region-card-name { display: block; font-weight: 800; font-size: 14px; line-height: 1.35; overflow-wrap: break-word; word-break: normal; }
.region-card-count { display: block; margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.directory-breadcrumb span[aria-current="page"] { color: rgba(255,255,255,0.92); }
.directory-breadcrumb-sep { margin: 0 6px; opacity: 0.45; }
.directory-controls--slim .filter-panel { border: 0; background: transparent; padding: 0; box-shadow: none; }
.directory-controls--slim .filter-bar { margin-bottom: 6px; }
.directory-section.is-drill-hidden { display: none !important; }
.country-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 14px; }
.country-card { appearance: none; text-align: left; padding: 0; border-radius: 18px; border: 1px solid rgba(255,255,255,0.1); background: rgba(18,18,20,0.85); color: #fff; cursor: pointer; transition: border-color 0.2s, box-shadow 0.2s, background 0.2s; min-height: 44px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 8px 28px rgba(0,0,0,0.28); }
.country-card:hover { border-color: rgba(255,0,51,0.55); box-shadow: 0 12px 36px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,0,51,0.15); }
.country-card[aria-pressed="true"] { border-color: rgba(255,0,51,0.85); background: rgba(255,0,51,0.1); box-shadow: 0 0 0 1px rgba(255,0,51,0.35); }
.country-card-media { position: relative; display: block; overflow: hidden; }
.country-card-media::after { content: ''; position: absolute; inset: 0; pointer-events: none; background: linear-gradient(180deg, rgba(255,0,51,0.05) 0%, rgba(0,0,0,0.08) 40%, rgba(0,0,0,0.72) 100%); }
.country-card-image { width: 100%; aspect-ratio: 16 / 10; object-fit: cover; display: block; background: linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.03)); }
.country-card-body { padding: 13px 15px 15px; min-width: 0; background: linear-gradient(180deg, rgba(14,14,16,0.2), rgba(14,14,16,0.95)); }
.country-card-name { display: block; font-weight: 800; font-size: 14px; line-height: 1.35; overflow-wrap: break-word; }
.country-card-count { display: block; margin-top: 6px; font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.country-card-photo-credit { display: block; margin-top: 8px; font-size: 10px; line-height: 1.35; color: rgba(255,255,255,0.45); font-weight: 600; }
.country-card-photo-credit a { color: rgba(121,216,255,0.85); text-decoration: underline; text-underline-offset: 2px; }
.country-empty { font-size: 14px; color: rgba(255,255,255,0.55); padding: 8px 0; }
.filter-bar { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin: 0 0 10px; }
.directory-btn-reset { border-color: rgba(255,0,51,0.5); background: rgba(255,0,51,0.08); }
.directory-btn-reset:hover { border-color: rgba(255,0,51,0.75); background: rgba(255,0,51,0.14); }
@media (min-width: 901px) {
  #browseAllPorts { margin-left: auto; }
}
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
.seo-directory-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 260px), 1fr)); gap: 18px; padding: 0 20px 28px; max-width: 1200px; margin: 0 auto; align-items: start; }
@media (max-width: 520px) { .seo-directory-grid { grid-template-columns: 1fr; gap: 14px; } }
.seo-grid-card { display: flex; flex-direction: column; gap: 0; padding: 0; border-radius: 18px; border: 1px solid rgba(255,255,255,0.09); background: rgba(16,16,18,0.88); text-decoration: none; color: #fff; transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s; overflow: hidden; box-shadow: 0 6px 28px rgba(0,0,0,0.28); min-width: 0; }
.seo-grid-card:hover { border-color: rgba(255,0,51,0.65); box-shadow: 0 14px 40px rgba(0,0,0,0.38), 0 0 0 1px rgba(255,0,51,0.12); }
${DESTINATION_DIRECTORY_CARD_CSS}
.directory-card.is-filter-hidden, .directory-card.is-page-hidden { display: none !important; }
.directory-load-more-wrap { position: relative; z-index: 5; max-width: 1200px; margin: 8px auto 48px; padding: 8px 20px 12px; text-align: center; }
.directory-load-more { min-width: min(100%, 280px); min-height: 44px; }
@media (prefers-reduced-motion: reduce) {
  .region-card, .country-card, .seo-grid-card, .guide-card, .directory-btn { transition: none; }
  .region-grid { scroll-behavior: auto; scroll-snap-type: none; }
}
.directory-crawl-fallback { max-width: 900px; margin: 0 auto 48px; padding: 0 20px; color: rgba(255,255,255,0.78); }
.directory-crawl-list { columns: 2; column-gap: 24px; list-style: none; padding: 0; margin: 12px 0 0; }
.directory-crawl-list li { break-inside: avoid; margin-bottom: 6px; }
.directory-crawl-list a { color: var(--neon-red); font-weight: 600; text-decoration: none; }
.directory-crawl-list a:hover { text-decoration: underline; }
.seo-grid-card-title { font-weight: 800; font-size: 18px; letter-spacing: -0.2px; line-height: 1.25; }
.seo-grid-card-hint { font-size: 12px; color: rgba(255,255,255,0.55); font-weight: 700; }
.seo-grid-card-meta { font-size: 13px; color: rgba(255,255,255,0.55); }
.seo-grid-card-desc { font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.68); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.seo-grid-card-bookable { display: inline-flex; width: fit-content; margin-top: 2px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #042f2e; background: linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,211,238,0.9)); }
.rating-pill { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.9); }
.rating-pill-muted { color: rgba(255,255,255,0.6); font-weight: 700; }
.rating-visual { display: inline-flex; flex-direction: column; align-items: flex-start; gap: 4px; padding: 6px 10px; border-radius: 12px; font-size: 12px; font-weight: 800; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: rgba(255,255,255,0.95); min-width: 0; }
.rating-stars { letter-spacing: 2px; color: #fbbf24; font-size: 15px; line-height: 1; }
.rating-num { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.75); }
.directory-card.is-hidden { display: none; }
.featured-guides { max-width: 1200px; margin: 12px auto 24px; padding: 0 20px; }
.featured-guides h2 { font-size: 18px; font-weight: 900; letter-spacing: -0.2px; margin: 8px 0 12px; }
.featured-guides-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
.guide-card { display: block; border-radius: 18px; overflow: hidden; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.03); text-decoration: none; color: #fff; transition: border-color 0.2s, box-shadow 0.2s; }
.guide-card:hover { border-color: rgba(255,0,51,0.75); }
.guide-card-image { width: 100%; height: 150px; min-height: 150px; object-fit: cover; object-position: center; background: linear-gradient(135deg, rgba(6,182,212,0.18), rgba(255,255,255,0.06)); display: block; }
.guide-card-body { padding: 12px 14px 14px; }
.guide-card-title { font-size: 14px; font-weight: 800; line-height: 1.25; letter-spacing: -0.2px; margin: 0; }
.guide-card-meta { margin-top: 8px; font-size: 12px; color: rgba(255,255,255,0.55); }
.app-cta { max-width: 1200px; margin: 0 auto 26px; padding: 0 20px; }
.app-cta-inner { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 18px 20px; border-radius: 18px; border: 1px solid rgba(255,0,51,0.22); background: linear-gradient(135deg, rgba(255,255,255,0.04), rgba(18,18,20,0.92)); box-shadow: inset 0 1px 0 rgba(255,255,255,0.05); }
.app-cta strong { display: block; font-size: 15px; }
.app-cta span { display: block; font-size: 13px; color: rgba(255,255,255,0.68); margin-top: 2px; }
.app-cta a { flex: 0 0 auto; }
@media (max-width: 900px) {
  body.ports-directory-v2 .directory-hero { padding-left: 16px; padding-right: 16px; }
  body.ports-directory-v2 .directory-hero h1 { font-size: 1.75rem; }
  .directory-section--search { padding: 8px 16px 0; }
  .seo-directory-grid { grid-template-columns: 1fr; gap: 14px; padding: 0 16px 24px; }
  .directory-section, .directory-controls, .directory-section-head--ports { padding-left: 16px; padding-right: 16px; }
  .featured-guides-grid { grid-template-columns: 1fr; }
  .app-cta-inner { flex-direction: column; align-items: flex-start; }
  .region-scroll-hint { display: block; }
  .region-grid-wrap:not(.is-expanded)::after { top: 26px; bottom: 96px; }
  .region-expand-toggle { margin-left: 0; flex: 0 0 auto; }
  .country-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .filter-bar { flex-direction: column; align-items: stretch; }
  .filter-select { width: 100%; }
}
@media (min-width: 901px) {
  .region-scroll-hint { display: none; }
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
  const verifiedBySlug =
    opts.verifiedPortImagesBySlug && typeof opts.verifiedPortImagesBySlug === 'object'
      ? opts.verifiedPortImagesBySlug
      : {};
  const repoRoot = opts.repoRoot || path.join(__dirname, '..', '..');
  const { directoryPorts } = resolveDirectoryPorts(opts.ports);
  const { regionCardsHtml, regionCardCount } = buildRegionBrowseHtml(
    directoryPorts,
    regionImages,
    verifiedBySlug,
    repoRoot
  );
  const cards = buildPortCardsHtml(directoryPorts, repoRoot);
  const countryImagesPayload = buildCountryImagesManifest(directoryPorts, repoRoot);
  const countryImagesJson = JSON.stringify(countryImagesPayload.manifest).replace(/</g, '\\u003c');
  const noscriptLinksHtml = buildNoScriptCrawlLinksHtml(directoryPorts);
  const coverageNoteHtml = '';

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
<body class="ports-directory-v2">
  <div class="starfield" id="starfield"></div>
  <div class="grid-overlay"></div>
  <div class="content-layer">
    ${buildDirectoryHeaderNav()}
    <section class="directory-hero directory-hero--compact" aria-labelledby="ports-title">
      <div class="directory-hero-copy">
        <h1 id="ports-title">Cruise ports &amp; destinations</h1>
        <p>Search by name or explore by region and country—each card opens a full port guide.</p>
      </div>
    </section>

    <section class="directory-section directory-section--search" aria-label="Search ports">
      <div class="directory-search-wrap directory-search-wrap--primary">
        <label class="sr-only" for="portSearch">Search ports by name or country</label>
        <input id="portSearch" class="directory-search directory-search--primary" type="search" placeholder="Search ports by name or country" autocomplete="off">
        <div id="portSearchResults" class="search-results" role="listbox" aria-label="Search results"></div>
      </div>
    </section>

    <section class="directory-section directory-section--region" id="regionBrowseSection" aria-label="Browse by region">
      <div class="directory-section-head directory-section-head--region">
        <h2>Browse by region</h2>
        <p class="directory-section-lead">Choose a region to discover its countries and ports.</p>
      </div>
      <div class="region-grid-wrap" id="regionGridWrap">
        <p class="region-scroll-hint" id="regionScrollHint">Swipe sideways for more regions</p>
      <div class="region-grid" id="regionBrowse" data-region-card-count="${regionCardCount}">
        ${regionCardsHtml}
      </div>
        <div class="region-grid-toolbar">
          <div class="region-grid-nav" aria-label="Region carousel navigation">
            <button type="button" class="region-scroll-btn" id="regionScrollPrev" aria-label="Previous regions" disabled aria-hidden="true">‹</button>
            <button type="button" class="region-scroll-btn" id="regionScrollNext" aria-label="Next regions" disabled aria-hidden="true">›</button>
          </div>
          <button type="button" class="directory-btn directory-btn-outline region-expand-toggle" id="regionExpandToggle" aria-expanded="false" aria-controls="regionBrowse">View all regions</button>
        </div>
      </div>
    </section>

    <nav class="directory-drill-nav" id="directoryDrillNav" aria-label="Browse path">
      <p class="directory-breadcrumb" id="directoryBreadcrumb"><span aria-current="page">Regions</span></p>
      <div class="directory-toolbar">
        <button type="button" class="directory-btn directory-btn-outline" id="directoryBack" hidden>Back</button>
        <button type="button" class="directory-btn directory-btn-outline" id="browseAllPorts">Browse all ports</button>
      </div>
    </nav>

    <section class="directory-section directory-scroll-target" id="countryBrowseSection" aria-label="Browse by country">
      <div class="directory-section-head">
        <h2>Browse by Country</h2>
        <span class="directory-section-note" id="countryHeading">All regions</span>
      </div>
      <p class="country-empty" id="countryEmpty">Select a region to see its countries, or search above.</p>
      <div class="country-grid" id="countryBrowse"></div>
    </section>

    <section class="directory-controls directory-scroll-target directory-controls--slim" id="directoryResults" aria-label="Port results">
      <div class="filter-panel">
      <div class="filter-bar">
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
        <button type="button" class="directory-btn directory-btn-outline directory-btn-reset" id="directoryReset" aria-label="Reset browse">Start over</button>
      </div>
      <p class="results-meta" id="resultsMeta" aria-live="polite"></p>
      </div>
    </section>

    <p class="directory-empty" id="directoryEmpty" hidden>No ports match these filters.</p>
    <div id="directoryPortsWrap">
    ${coverageNoteHtml}
    <div class="seo-directory-grid" id="directoryGrid">${cards}</div>
    <div class="directory-load-more-wrap">
      <button type="button" class="directory-btn directory-btn-outline directory-load-more" id="directoryLoadMore" hidden>Load more ports</button>
    </div>
    </div>
    ${noscriptLinksHtml}
    <section class="featured-guides" aria-label="Popular destination guides">
      <h2>Popular destination guides</h2>
      <div class="featured-guides-grid">${
        featuredGuideCardsHtml ||
        `<a class="guide-card" href="/blog/"><div class="guide-card-body"><p class="guide-card-title">SeaDays cruise blog</p><p class="guide-card-meta">Browse destination guides and shore-day tips</p></div></a>`
      }</div>
    </section>
    <section class="app-cta" aria-label="App call to action">
      <div class="app-cta-inner">
        <div>
          <strong>Want the full reviews?</strong>
          <span>Download SeaDays to read and leave reviews for ports and ships.</span>
        </div>
        <a class="directory-btn directory-btn-primary seadays-brand-cta" href="/download/?utm_source=seadays_web&amp;utm_medium=port_guide&amp;utm_campaign=port_guide">Get SeaDays</a>
      </div>
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
  <script type="application/json" id="portsDirectoryCountryImages">${countryImagesJson}</script>
  <script>(function(){var sf=document.getElementById('starfield');if(sf){for(var i=0;i<120;i++){var s=document.createElement('div');s.className='star';s.style.left=Math.random()*100+'%';s.style.top=Math.random()*100+'%';s.style.animationDelay=Math.random()*3+'s';sf.appendChild(s);}}})();</script>
  <script>${buildPortsDirectoryClientScript()}
  </script>
  ${runtimeGuardScript}
</body>
</html>`;
}

module.exports = {
  buildPortsIndexHtml,
  buildCountryImagesManifest,
  resolveDirectoryPorts,
  loadRegionImageManifest,
  DIRECTORY_ALIAS_TO_CANONICAL,
  CANONICAL_DISPLAY,
  PRIORITY_REGION_DEFS,
  DEFAULT_FEATURED_SLUGS,
  DIRECTORY_PAGE_SIZE,
  DIRECTORY_FEATURED_SIZE,
  shortDirectoryBlurb,
  isDirectoryPlaceholderImage,
  portHasVerifiedDirectoryPhoto,
  sanitizePublicRegionCardImageAlt,
};

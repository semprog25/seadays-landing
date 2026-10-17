#!/usr/bin/env node
'use strict';

/**
 * Regenerate /ports/<slug>/ pages from local dataset + public adapters.
 * Does not require blog Supabase fetch.
 *
 * Usage:
 *   SEADAYS_APP_ROOT=/path/to/Seadays-main node scripts/regenerate-port-pages.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const fs = require('fs');
const {
  buildSeoPortRecords,
  buildSeoShipRecords,
  buildPortDetailHtml,
  buildShipDetailHtml,
  pickRelatedPorts,
  pickShipsForPortPage,
  pickBlogArticlesForEntity,
  extractArticleCardImageFromHtml,
} = require('./lib/seoShipPortPages');
const { allShips: APP_ALL_SHIPS, allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const {
  loadPublicPortGuidesFile,
  buildSlugToAppPortIdMap,
  extractAllPublicPortGuides,
  writePublicPortGuidesFile,
} = require('./lib/publicPortGuideAdapter');
const {
  loadKnownAffiliatePortIds,
  resolvePortAffiliateCta,
  getViatorConfigFromEnv,
} = require('./lib/viatorAffiliate');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');
const {
  getAliasRedirectTarget,
  isPortSplitSlug,
  isPortSeoRedirectSlug,
  writePortSeoRedirectPages,
} = require('./lib/portSeoRedirects');
const {
  loadLandingCruiseContentOverrides,
  applyPortContentOverride,
  applyShipContentOverride,
} = require('./lib/landingCruiseContentOverrides');

const BASE_URL = 'https://seadays.app';
const DEFAULT_FAVICON =
  'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';

const INDEX_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --dark-bg: #0a0a0a; --neon-red: #ff0033; }
body { font-family: Inter, system-ui, sans-serif; background: var(--dark-bg); color: #fff; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.header { position: sticky; top: 0; z-index: 50; backdrop-filter: blur(12px); }
.header-nav { display: flex; gap: 18px; padding: 16px 20px; max-width: 1200px; margin: 0 auto; }
.header-nav a { color: rgba(255,255,255,0.7); text-decoration: none; font-weight: 600; font-size: 14px; }
.header-nav a:hover { color: #fff; }
.footer { margin-top: 40px; padding: 40px 0; border-top: 1px solid rgba(255,255,255,0.08); }
.footer-bottom { text-align: center; color: rgba(255,255,255,0.45); font-size: 13px; }
.content-layer { position: relative; z-index: 1; }
.starfield, .grid-overlay { pointer-events: none; position: fixed; inset: 0; }
.star { position: absolute; width: 2px; height: 2px; background: #fff; border-radius: 50%; opacity: 0.35; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
`;

function loadTerminals(repoRoot) {
  try {
    return JSON.parse(
      fs.readFileSync(path.join(repoRoot, 'data', 'public-port-terminals.json'), 'utf8')
    );
  } catch {
    return { byPortId: {} };
  }
}

function loadBlogArticlesFromDisk(repoRoot) {
  const blogDir = path.join(repoRoot, 'blog');
  const out = [];
  if (!fs.existsSync(blogDir)) return out;
  for (const ent of fs.readdirSync(blogDir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const htmlPath = path.join(blogDir, ent.name, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const descMatch = html.match(/name="description" content="([^"]*)"/i);
    const title = (titleMatch && titleMatch[1] ? titleMatch[1] : ent.name)
      .replace(/\s*\|\s*SeaDays.*$/i, '')
      .trim();
    const image = extractArticleCardImageFromHtml(html);
    out.push({
      slug: ent.name,
      title,
      excerpt: (descMatch && descMatch[1]) || '',
      thumbnailUrl: image,
      heroImageUrl: image,
      ogImage: image,
    });
  }
  return out;
}

function patchPortsIndexCards(repoRoot, seoPorts) {
  const indexPath = path.join(repoRoot, 'ports', 'index.html');
  if (!fs.existsSync(indexPath)) return false;
  let html = fs.readFileSync(indexPath, 'utf8');
  const bySlug = new Map(seoPorts.map((p) => [p.slug, p]));

  html = html.replace(
    /<a href="\/ports\/([^"]+)\/" class="seo-grid-card directory-card"([\s\S]*?)<\/a>/g,
    (full, slug, rest) => {
      const port = bySlug.get(slug);
      if (!port) return full;
      let next = full;
      if (!/data-name=/.test(next)) {
        next = next.replace(
          'class="seo-grid-card directory-card"',
          `class="seo-grid-card directory-card" data-name="${String(port.name || '')
            .toLowerCase()
            .replace(/"/g, '')}" data-country="${String(port.country || '')
            .toLowerCase()
            .replace(/"/g, '')}"`
        );
      }
      if (port.description && !/seo-grid-card-desc/.test(next)) {
        const blurb = String(port.description).replace(/\s+/g, ' ').trim().slice(0, 120);
        next = next.replace(
          /<span class="seo-grid-card-meta">[\s\S]*?<\/span>/,
          (meta) =>
            `${meta}<span class="seo-grid-card-desc">${blurb.replace(/&/g, '&amp;').replace(/</g, '&lt;')}${
              blurb.length >= 120 ? '…' : ''
            }</span>`
        );
      }
      if (slug === 'marigot-st-maarten') {
        next = next
          .replace('data-country="st maarten"', 'data-country="saint-martin"')
          .replace('>St. Maarten · Caribbean<', '>Saint-Martin · Caribbean<')
          .replace(
            /<span class="seo-grid-card-desc">[\s\S]*?<\/span>/,
            '<span class="seo-grid-card-desc">Marigot is the capital of the French side of the island, in Saint-Martin.</span>'
          );
      }
      if (port.hasBookableExperiences && !/seo-grid-card-bookable/.test(next)) {
        next = next.replace(
          '<span class="seo-grid-card-bottom">',
          '<span class="seo-grid-card-bookable">Bookable experiences available</span><span class="seo-grid-card-bottom">'
        );
      }
      return next;
    }
  );

  if (!html.includes('id="portSearch"')) {
    html = html.replace(
      '<section class="directory-controls" aria-label="Filters">',
      `<section class="directory-controls" aria-label="Filters">
      <label class="sr-only" for="portSearch">Search ports</label>
      <input id="portSearch" class="directory-search" type="search" placeholder="Search ports by name or country" autocomplete="off">`
    );
  }
  if (!html.includes('.seo-grid-card-bookable')) {
    html = html.replace(
      '</style>',
      `.seo-grid-card-desc { font-size: 13px; line-height: 1.45; color: rgba(255,255,255,0.68); }
.seo-grid-card-bookable { display: inline-flex; width: fit-content; margin-top: 2px; padding: 5px 10px; border-radius: 999px; font-size: 11px; font-weight: 800; color: #042f2e; background: linear-gradient(90deg, rgba(52,211,153,0.95), rgba(34,211,238,0.9)); }
.directory-search { width: 100%; max-width: 420px; margin: 0 0 14px; padding: 12px 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.14); background: rgba(255,255,255,0.04); color: #fff; font-size: 15px; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
</style>`
    );
  }

  // Never leave expiring /object/sign/ URLs in the ports index (CI + local).
  const publicFallbacks = [
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20planner.jpg',
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Discover%20Ships%20%20Ports.jpg',
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png',
  ];
  let fb = 0;
  html = html.replace(
    /(<img\b[^>]*?\bsrc=")(https:\/\/[^"]+\/storage\/v1\/object\/sign\/[^"]+)(")/gi,
    (_m, pre, _signed, post) => `${pre}${publicFallbacks[fb++ % publicFallbacks.length]}${post}`
  );

  html = html.replace(
    /<a href="\/ports\/([^"]+)\/" class="seo-grid-card[\s\S]*?<\/a>\n?/g,
    (full, slug) => (isPortSeoRedirectSlug(slug) ? '' : full)
  );

  fs.writeFileSync(indexPath, html, 'utf8');
  return true;
}

function patchShipIndexCard(repoRoot, ship) {
  const indexPath = path.join(repoRoot, 'ships', 'index.html');
  if (!fs.existsSync(indexPath)) return;
  let html = fs.readFileSync(indexPath, 'utf8');
  const card = new RegExp(
    `(<a href="/ships/${ship.slug}/" class="seo-grid-card[\\s\\S]*?<span class="seo-grid-card-title">)[\\s\\S]*?(</span><span class="seo-grid-card-meta">)[\\s\\S]*?(</span>)`
  );
  if (!card.test(html)) return;
  const name = String(ship.name || '').replace(/</g, '');
  const line = String(ship.cruise_line || '').replace(/</g, '');
  html = html.replace(card, `$1${name}$2${line}$3`);
  if (ship.slug === 'celebrity-xpedition') {
    html = html.replace(
      'data-group="Celebrity Cruises" data-item="celebrity-xpedition"',
      'data-group="Lindblad Expeditions" data-item="celebrity-xpedition"'
    );
  }
  fs.writeFileSync(indexPath, html, 'utf8');
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  if (!process.env.SEADAYS_APP_ROOT) {
    process.env.SEADAYS_APP_ROOT = path.join(repoRoot, '..', 'Seadays-main');
  }
  const appRoot = getAppRepoRoot();
  console.log('[regenerate-port-pages] app root:', appRoot);

  let guides = loadPublicPortGuidesFile(repoRoot);
  if (!guides?.byAppPortId || !Object.keys(guides.byAppPortId).length) {
    guides = extractAllPublicPortGuides(appRoot);
    writePublicPortGuidesFile(repoRoot, guides);
  }
  const terminals = loadTerminals(repoRoot);
  const articles = loadBlogArticlesFromDisk(repoRoot);
  const portSlugToReviewKey = buildPortSlugToReviewKeyMap(appRoot, APP_ALL_PORTS);
  const overrides = loadLandingCruiseContentOverrides();

  const rawPorts = APP_ALL_PORTS.map((p) => {
    const slug = String(p.slug || '').trim();
    const country = p.country || '';
    const label = String(p.name || '').trim();
    const portName =
      country && label.toLowerCase().endsWith(`, ${String(country).toLowerCase()}`)
        ? label.slice(0, -2 - String(country).length).trim()
        : label || slug;
    return {
      id: slug,
      slug,
      portName,
      country,
      region: p.region || '',
      description: '',
      highlights: [],
    };
  });
  const seoPorts = buildSeoPortRecords(rawPorts).map((p) =>
    applyPortContentOverride(p, overrides.ports[p.slug])
  );
  const seoShips = buildSeoShipRecords(
    APP_ALL_SHIPS.map((s) => ({
      id: s.slug,
      slug: s.slug,
      name: s.name,
      cruise_line: s.cruiseLine,
      description: s.description || '',
      highlights: [],
      shipClass: s.shipClass || '',
      capacity: s.capacity,
      capacityMax: s.capacityMax,
      capacityBasis: s.capacityBasis,
      crew: s.crew,
      yearBuilt: s.yearBuilt,
      tonnage: s.tonnage,
      length: s.length,
      beam: s.beam,
      status: s.status || '',
      appId: s.appId || '',
      lineId: s.lineId || '',
    }))
  ).map((s) => applyShipContentOverride(s, overrides.ships[s.slug]));

  const slugToAppPortId = buildSlugToAppPortIdMap(
    seoPorts,
    portSlugToReviewKey,
    guides.byAppPortId || {}
  );
  const knownAffiliatePortIds = loadKnownAffiliatePortIds(appRoot);
  const viatorConfig = getViatorConfigFromEnv();
  const spOpts = {
    baseUrl: BASE_URL,
    defaultImage: DEFAULT_FAVICON,
    indexStyles: INDEX_STYLES,
    runtimeGuardScript: '',
    appRoot,
    slugToAppPortId,
    knownAffiliatePortIds,
  };

  let withGuide = 0;
  let withTerminals = 0;
  let withAffiliate = 0;

  for (const port of seoPorts) {
    // Browse-hidden aliases: publish as noindex redirects (batch-written below).
    if (getAliasRedirectTarget(port.slug) || isPortSplitSlug(port.slug)) continue;
    const dir = path.join(repoRoot, 'ports', port.slug);
    fs.mkdirSync(dir, { recursive: true });
    const appPortId = slugToAppPortId[port.slug] || '';
    // Cross-country guides are already filtered by buildSlugToAppPortIdMap.
    // Editorial overrides must not inherit another place's climate/politics sections.
    const portGuide = (appPortId && guides.byAppPortId[appPortId]) || null;
    const portTerminals = (appPortId && terminals.byPortId && terminals.byPortId[appPortId]) || [];
    const affiliate = resolvePortAffiliateCta(
      { ...port, appPortId },
      {
        appRoot,
        slugToAppPortId,
        knownPortIds: knownAffiliatePortIds,
        destinationLabel: port.name,
        config: viatorConfig,
      }
    );
    if (portGuide) {
      withGuide += 1;
      // Prefer editorial overrides; never clobber unique port prose with guide blurbs.
      if (
        portGuide.portInfo &&
        portGuide.portInfo.description &&
        !port.hasContentOverride &&
        !String(port.description || '').trim()
      ) {
        port.description = portGuide.portInfo.description;
      }
      if (
        portGuide.climate &&
        portGuide.climate.bestMonths &&
        portGuide.climate.bestMonths.length &&
        !port.hasContentOverride
      ) {
        port.popularMonths = portGuide.climate.bestMonths;
      }
    }
    if (portTerminals.length) withTerminals += 1;
    if (affiliate.show) {
      withAffiliate += 1;
      port.hasBookableExperiences = true;
    }
    const blogs = pickBlogArticlesForEntity(
      articles,
      [port.name, port.country, port.region, 'cruise port'],
      6
    );
    const html = buildPortDetailHtml(
      port,
      pickRelatedPorts(seoPorts, port, 5),
      pickShipsForPortPage(seoShips, port, 4),
      blogs,
      { ...spOpts, portGuide, portTerminals, affiliate }
    );
    fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
  }

  const portRedirects = writePortSeoRedirectPages(repoRoot, seoPorts);
  console.log(
    `[regenerate-port-pages] port SEO redirects: standalone=${portRedirects.standaloneCount} aliases=${portRedirects.aliasCount}`
  );

  let shipPages = 0;
  for (const ship of seoShips) {
    if (ship.status && ship.status !== 'active') continue;
    const dir = path.join(repoRoot, 'ships', ship.slug);
    fs.mkdirSync(dir, { recursive: true });
    const blogs = pickBlogArticlesForEntity(
      articles,
      [ship.name, ship.cruise_line, 'cruise ship'],
      6
    );
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      buildShipDetailHtml(ship, [], [], blogs, spOpts),
      'utf8'
    );
    if (ship.slug === 'celebrity-xpedition') patchShipIndexCard(repoRoot, ship);
    shipPages += 1;
  }
  console.log(`[regenerate-port-pages] wrote ${shipPages} ship pages`);

  const patchedIndex = patchPortsIndexCards(repoRoot, seoPorts);
  console.log(
    `[regenerate-port-pages] wrote ${seoPorts.length} port pages (guides=${withGuide}, terminals=${withTerminals}, affiliateShown=${withAffiliate}, indexPatched=${patchedIndex})`
  );

  const sample = ['hamburg-germany', 'barcelona-spain', 'vigo-spain', 'miami-fl-united-states'];
  for (const slug of sample) {
    const p = path.join(repoRoot, 'ports', slug, 'index.html');
    if (!fs.existsSync(p)) {
      console.log(`[verify] /ports/${slug}/ MISSING`);
      continue;
    }
    const html = fs.readFileSync(p, 'utf8');
    const checks = [
      'Getting there',
      'Bookable Experiences',
      'Traveler questions',
      'id="plan-port-day"',
      'Quick facts',
    ];
    const missing = checks.filter((c) => !html.includes(c));
    console.log(`[verify] /ports/${slug}/ missing=[${missing.join(', ') || 'none'}]`);
  }
}

main();

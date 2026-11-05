#!/usr/bin/env node
'use strict';

/**
 * Regenerate only /ports/index.html (Region → Country → Ports IA).
 * Offline-friendly: uses local app cruise dataset + public guides + affiliate flags.
 *
 * Usage:
 *   SEADAYS_APP_ROOT=/path/to/Seadays-main node scripts/regenerate-ports-index.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const fs = require('fs');
const { resolveDirectoryPorts } = require('./lib/portsDirectoryIndex');
const { writePortsDirectoryIndexFromCatalogue } = require('./lib/preparePortsDirectoryIndexWrite');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const {
  loadPublicPortGuidesFile,
  buildSlugToAppPortIdMap,
} = require('./lib/publicPortGuideAdapter');
const {
  loadKnownAffiliatePortIds,
  getViatorConfigFromEnv,
} = require('./lib/viatorAffiliate');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');
const { getAnalyticsHeadHtml } = require('./lib/analyticsSnippet');
const { buildDirectoryRuntimeImageGuardScript } = require('./lib/directoryRuntimeImageGuard');
const { loadLandingCruiseContentOverrides, applyPortContentOverride } = require('./lib/landingCruiseContentOverrides');
const { PORTS_DIRECTORY_PAGE_SHELL_STYLES } = require('./lib/portsDirectoryPageShellStyles');
const { applyHasBookableExperiencesToSeoPorts } = require('./lib/portsDirectoryBookable');
const { resolvePortsDirectoryFeaturedGuideCardsHtml } = require('./lib/portsDirectoryFeaturedGuides');

const BASE_URL = 'https://seadays.app';
const DEFAULT_FAVICON =
  'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';

const INDEX_STYLES = PORTS_DIRECTORY_PAGE_SHELL_STYLES;

const RUNTIME_GUARD_SCRIPT = buildDirectoryRuntimeImageGuardScript();

function extractRatingsFromExisting(indexPath) {
  const map = new Map();
  if (!fs.existsSync(indexPath)) return map;
  const html = fs.readFileSync(indexPath, 'utf8');
  const re =
    /href="\/ports\/([^"]+)\/"[^>]*class="seo-grid-card directory-card"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = re.exec(html))) {
    const slug = match[1];
    const body = match[2];
    const num = body.match(/(\d+(?:\.\d+)?)\s*\/\s*5/);
    if (num) map.set(slug, Number(num[1]));
  }
  return map;
}

function main() {
  const repoRoot = path.join(__dirname, '..');
  const indexPath = path.join(repoRoot, 'ports', 'index.html');
  const appRoot = getAppRepoRoot();
  const publicGuides = loadPublicPortGuidesFile(repoRoot) || { byAppPortId: {} };
  const knownAffiliatePortIds = loadKnownAffiliatePortIds(appRoot);
  const viatorConfig = getViatorConfigFromEnv();
  const cruiseContentOverrides = loadLandingCruiseContentOverrides();
  const portSlugToReviewKey = buildPortSlugToReviewKeyMap(appRoot, APP_ALL_PORTS);
  const existingRatings = extractRatingsFromExisting(indexPath);

  const fullPortRawList = APP_ALL_PORTS.map((p) => {
    const slug = String(p.slug || '').trim();
    const country = p.country || '';
    const label = String(p.name || '').trim();
    const portName =
      country && label.toLowerCase().endsWith(`, ${String(country).toLowerCase()}`)
        ? label.slice(0, -2 - String(country).length).trim()
        : label || slug;
    const base = {
      id: slug,
      slug,
      portName,
      country,
      region: p.region || '',
      description: '',
      highlights: [],
      rating: existingRatings.get(slug) || null,
      reviewCount: null,
    };
    return applyPortContentOverride(base, cruiseContentOverrides.ports[slug]);
  });

  const seoPorts = buildSeoPortRecords(fullPortRawList);
  const slugToAppPortId = buildSlugToAppPortIdMap(
    seoPorts,
    portSlugToReviewKey,
    publicGuides.byAppPortId || {}
  );

  applyHasBookableExperiencesToSeoPorts(seoPorts, {
    appRoot,
    slugToAppPortId,
    knownAffiliatePortIds,
    viatorConfig,
  });

  const featuredGuideCardsHtml = resolvePortsDirectoryFeaturedGuideCardsHtml({
    repoRoot,
    seoPorts,
  });

  writePortsDirectoryIndexFromCatalogue({
    repoRoot,
    seoPorts,
    slugToAppPortId,
    publicGuidesByAppPortId: publicGuides.byAppPortId || {},
    featuredGuideCardsHtml,
    indexStyles: INDEX_STYLES,
    analyticsHeadHtml: getAnalyticsHeadHtml(),
    runtimeGuardScript: RUNTIME_GUARD_SCRIPT,
    baseUrl: BASE_URL,
    defaultFavicon: DEFAULT_FAVICON,
  });
  const { directoryPorts, aliasToCanonical } = resolveDirectoryPorts(seoPorts);
  console.log(
    `[regenerate-ports-index] wrote ports/index.html — ${directoryPorts.length} directory ports ` +
      `(${Object.keys(aliasToCanonical).length} aliases hidden from browse; individual URLs unchanged)`
  );
  console.log(
    '[regenerate-ports-index] hidden aliases:',
    Object.entries(aliasToCanonical)
      .map(([a, c]) => `${a}→${c}`)
      .join(', ')
  );
}

main();

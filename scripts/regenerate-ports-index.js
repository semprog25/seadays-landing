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
const { buildPortsIndexHtml, resolveDirectoryPorts } = require('./lib/portsDirectoryIndex');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const {
  loadPublicPortGuidesFile,
  buildSlugToAppPortIdMap,
} = require('./lib/publicPortGuideAdapter');
const {
  loadKnownAffiliatePortIds,
  resolvePortAffiliateCta,
  getViatorConfigFromEnv,
} = require('./lib/viatorAffiliate');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');
const { getAnalyticsHeadHtml } = require('./lib/analyticsSnippet');
const { loadLandingCruiseContentOverrides, applyPortContentOverride } = require('./lib/landingCruiseContentOverrides');

const BASE_URL = 'https://seadays.app';
const DEFAULT_FAVICON =
  'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';

/** Minimal index styles shared with directory pages (SeaDays dark theme). */
const INDEX_STYLES = `
* { margin: 0; padding: 0; box-sizing: border-box; }
:root { --dark-bg: #0a0a0a; --neon-red: #FF0033; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: var(--dark-bg); color: white; line-height: 1.6; overflow-x: hidden; }
.starfield { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 0; background: linear-gradient(180deg, #0a0a0a 0%, #1a1a1a 100%); overflow: hidden; }
.star { position: absolute; width: 2px; height: 2px; background: rgba(255,255,255,0.5); border-radius: 50%; animation: twinkle 3s infinite ease-in-out; }
@keyframes twinkle { 0%, 100% { opacity: 0.2; } 50% { opacity: 1; } }
.grid-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; z-index: 1; background-image: linear-gradient(rgba(255, 0, 51, 0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 0, 51, 0.02) 1px, transparent 1px); background-size: 100px 100px; opacity: 0.4; pointer-events: none; }
.content-layer { position: relative; z-index: 10; }
.header { position: absolute; top: 0; left: 0; right: 0; padding: 20px 40px; display: flex; justify-content: flex-end; align-items: center; z-index: 100; }
.header-nav { display: flex; gap: 30px; align-items: center; }
.header-nav a { color: rgba(255, 255, 255, 0.7); text-decoration: none; font-weight: 500; font-size: 15px; }
.header-nav a:hover { color: white; }
.container { max-width: 1200px; margin: 0 auto; padding: 0 20px; }
.footer { padding: 60px 0 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); text-align: center; background: #050505; }
.footer-content { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 40px; margin-bottom: 40px; text-align: left; }
.footer-section h4 { margin-bottom: 20px; font-size: 18px; }
.footer-section ul { list-style: none; }
.footer-section li { margin-bottom: 12px; }
.footer-section a { color: rgba(255, 255, 255, 0.5); text-decoration: none; }
.footer-section a:hover { color: var(--neon-red); }
.footer-bottom { padding-top: 30px; border-top: 1px solid rgba(255, 255, 255, 0.05); color: rgba(255, 255, 255, 0.3); font-size: 14px; }
img { transition: filter 0.35s ease, transform 0.35s ease; }
img.img-loading { filter: blur(8px); transform: scale(1.03); }
`;

const RUNTIME_GUARD_SCRIPT = `<script>
(function(){
  var FB='https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';
  function safeImage(src){
    if(!src||!src.startsWith('https://'))return FB;
    if(src.includes('cdn.seadays.app'))return FB;
    if(src.split('?')[0].toLowerCase().endsWith('.svg'))return FB;
    return src;
  }
  function applyGuard(){
    document.querySelectorAll('img[data-img-source]').forEach(function(el){
      var orig=el.getAttribute('src')||'';
      var safe=safeImage(orig);
      if(safe!==orig){el.dataset.originalSrc=orig;el.src=safe;}
    });
  }
  if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',applyGuard);}
  else{applyGuard();}
})();
</script>`;

function extractFeaturedGuidesFromExisting(indexPath) {
  if (!fs.existsSync(indexPath)) return '';
  const html = fs.readFileSync(indexPath, 'utf8');
  const m = html.match(
    /<div class="featured-guides-grid">([\s\S]*?)<\/div>\s*<\/section>\s*<article class="seo-prose">/
  );
  return m ? m[1].trim() : '';
}

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
  const featuredGuideCardsHtml = extractFeaturedGuidesFromExisting(indexPath);

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

  for (const port of seoPorts) {
    const appPortId = slugToAppPortId[port.slug] || '';
    const portGuide = (appPortId && publicGuides.byAppPortId[appPortId]) || null;
    if (portGuide?.portInfo?.description && !port.description) {
      port.description = portGuide.portInfo.description;
    }
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
    port.hasBookableExperiences = Boolean(affiliate.show);
  }

  const html = buildPortsIndexHtml({
    ports: seoPorts,
    featuredGuideCardsHtml,
    indexStyles: INDEX_STYLES,
    analyticsHeadHtml: getAnalyticsHeadHtml(),
    runtimeGuardScript: RUNTIME_GUARD_SCRIPT,
    baseUrl: BASE_URL,
    defaultFavicon: DEFAULT_FAVICON,
  });

  fs.writeFileSync(indexPath, html, 'utf8');
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

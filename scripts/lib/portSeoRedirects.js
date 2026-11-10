'use strict';

/**
 * Port URL SEO redirects — standalone (not in dataset) + browse-hidden aliases.
 *
 * Standalone redirects (e.g. koper-croatia) are NOT in appCruiseDataset but must
 * survive generateBlogs orphan cleanup and be rewritten every generation.
 *
 * Dataset aliases remain in the 412 canonical records / are hidden from the 406
 * browse grid; published HTML is a noindex redirect to the preferred slug.
 */

const fs = require('fs');
const path = require('path');
const { buildPortAliasRedirectMap } = require('./portBrowseAliases');
const { getSiteFooterHtml } = require('./siteShell');

const BASE_URL = 'https://seadays.app';

/** Redirect-only folders under /ports/ that are not dataset slugs. */
const PORT_STANDALONE_REDIRECTS = {
  'koper-croatia': {
    targetSlug: 'koper-slovenia',
    label: 'Koper, Slovenia',
  },
};

/**
 * Explicit alias → canonical (includes heuristic-only aliases that must stay stable).
 * Must stay aligned with resolveDirectoryPorts browse-hide set.
 */
const PORT_ALIAS_REDIRECTS = buildPortAliasRedirectMap();

/** One URL that names two different dock towns. No single 301 target. */
const PORT_SPLIT_PAGES = {
  'venice-ravenna-trieste-italy': {
    title: 'Venice cruise calls',
    body:
      'Cruise calls marketed as Venice use different docks. Ships berth at Ravenna or at Trieste, not at one shared Venice pier.',
    links: [
      { slug: 'ravenna-italy', label: 'Ravenna, Italy' },
      { slug: 'trieste-italy', label: 'Trieste, Italy' },
    ],
  },
};

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildPortRedirectHtml({ targetSlug, label }) {
  const target = `/ports/${encodeURI(targetSlug)}/`;
  const canonical = `${BASE_URL}/ports/${encodeURI(targetSlug)}/`;
  const linkLabel = label || targetSlug;
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="robots" content="noindex,follow">' +
    '<link rel="canonical" href="' +
    escapeHtml(canonical) +
    '">' +
    '<meta http-equiv="refresh" content="0;url=' +
    escapeHtml(target) +
    '">' +
    '<title>Redirect</title></head><body>' +
    '<script>window.location.replace("' +
    target.replace(/"/g, '\\"') +
    '");</script>' +
    '<p>Redirecting to <a href="' +
    escapeHtml(target) +
    '">' +
    escapeHtml(linkLabel) +
    '</a>...</p></body></html>\n'
  );
}

function getAliasRedirectTarget(slug) {
  return PORT_ALIAS_REDIRECTS[String(slug || '').trim()] || null;
}

function isPortSplitSlug(slug) {
  return Boolean(PORT_SPLIT_PAGES[String(slug || '').trim()]);
}

function buildPortSplitHtml(slug) {
  const page = PORT_SPLIT_PAGES[slug];
  const canonical = `${BASE_URL}/ports/${encodeURI(slug)}/`;
  const links = (page.links || [])
    .map(
      (link) =>
        `<li><a href="/ports/${escapeHtml(link.slug)}/">${escapeHtml(link.label)}</a></li>`
    )
    .join('');
  return (
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">' +
    '<meta name="robots" content="noindex,follow">' +
    '<link rel="canonical" href="' +
    escapeHtml(canonical) +
    '">' +
    '<title>' +
    escapeHtml(page.title) +
    '</title></head><body>' +
    '<h1>' +
    escapeHtml(page.title) +
    '</h1><p>' +
    escapeHtml(page.body) +
    '</p><ul>' +
    links +
    '</ul>' +
    getSiteFooterHtml() +
    '</body></html>\n'
  );
}

function isPortSeoRedirectSlug(slug) {
  const s = String(slug || '').trim();
  return Boolean(PORT_STANDALONE_REDIRECTS[s] || PORT_ALIAS_REDIRECTS[s] || PORT_SPLIT_PAGES[s]);
}

/** Slugs that must not be deleted by orphan cleanup even when absent from seoPorts. */
function getPreservedPortDirectorySlugs() {
  return new Set(Object.keys(PORT_STANDALONE_REDIRECTS));
}

function aliasRedirectLabel(aliasSlug, targetSlug, seoPortsBySlug) {
  const target = seoPortsBySlug && seoPortsBySlug.get(targetSlug);
  if (target && (target.name || target.portName)) return String(target.name || target.portName);
  return targetSlug
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

/**
 * Write standalone + alias redirect pages. Safe to call after orphan cleanup.
 * @returns {{ written: string[], aliasCount: number, standaloneCount: number }}
 */
function parseStage68StandaloneAliasSlugs() {
  return new Set(
    String(process.env.STAGE68_PUBLICATION_STANDALONE_ALIAS_SLUGS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

/** Landing slugs with live passenger guides — must not be overwritten by alias redirect stubs. */
function collectPassengerEditorialLandingSlugs(publicGuidesPayload) {
  const slugs = new Set();
  const byId = publicGuidesPayload?.byAppPortId || {};
  for (const guide of Object.values(byId)) {
    if (!guide || typeof guide !== 'object') continue;
    const tier = guide.researchImport?.publication_tier;
    const landingSlug = String(guide.researchImport?.landing_slug || '').trim();
    if (tier === 'passenger_editorial' && landingSlug) slugs.add(landingSlug);
  }
  return slugs;
}

function writePortSeoRedirectPages(repoRoot, seoPorts = [], options = {}) {
  const standaloneAliasSlugs = parseStage68StandaloneAliasSlugs();
  const passengerEditorialLandingSlugs =
    options.passengerEditorialLandingSlugs || new Set();
  const bySlug = new Map(
    (Array.isArray(seoPorts) ? seoPorts : []).map((p) => [String(p.slug || ''), p])
  );
  const written = [];

  for (const [slug, meta] of Object.entries(PORT_STANDALONE_REDIRECTS)) {
    const dir = path.join(repoRoot, 'ports', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      buildPortRedirectHtml({
        targetSlug: meta.targetSlug,
        label: meta.label,
      }),
      'utf8'
    );
    written.push(slug);
  }

  for (const slug of Object.keys(PORT_SPLIT_PAGES)) {
    const dir = path.join(repoRoot, 'ports', slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), buildPortSplitHtml(slug), 'utf8');
    written.push(slug);
  }

  for (const [aliasSlug, targetSlug] of Object.entries(PORT_ALIAS_REDIRECTS)) {
    if (standaloneAliasSlugs.has(aliasSlug)) continue;
    if (passengerEditorialLandingSlugs.has(aliasSlug)) continue;
    const dir = path.join(repoRoot, 'ports', aliasSlug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'index.html'),
      buildPortRedirectHtml({
        targetSlug,
        label: aliasRedirectLabel(aliasSlug, targetSlug, bySlug),
      }),
      'utf8'
    );
    written.push(aliasSlug);
  }

  return {
    written,
    standaloneCount: Object.keys(PORT_STANDALONE_REDIRECTS).length,
    aliasCount: Object.keys(PORT_ALIAS_REDIRECTS).length,
  };
}

module.exports = {
  BASE_URL,
  PORT_STANDALONE_REDIRECTS,
  PORT_ALIAS_REDIRECTS,
  PORT_SPLIT_PAGES,
  buildPortRedirectHtml,
  buildPortSplitHtml,
  getAliasRedirectTarget,
  isPortSplitSlug,
  isPortSeoRedirectSlug,
  getPreservedPortDirectorySlugs,
  collectPassengerEditorialLandingSlugs,
  writePortSeoRedirectPages,
};

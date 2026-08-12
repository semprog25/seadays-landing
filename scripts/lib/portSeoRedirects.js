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
const { DIRECTORY_ALIAS_TO_CANONICAL } = require('./portsDirectoryIndex');

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
const PORT_ALIAS_REDIRECTS = {
  ...DIRECTORY_ALIAS_TO_CANONICAL,
  'doha-port-qatar': 'doha-qatar',
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

function isPortSeoRedirectSlug(slug) {
  const s = String(slug || '').trim();
  return Boolean(PORT_STANDALONE_REDIRECTS[s] || PORT_ALIAS_REDIRECTS[s]);
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
function writePortSeoRedirectPages(repoRoot, seoPorts = []) {
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

  for (const [aliasSlug, targetSlug] of Object.entries(PORT_ALIAS_REDIRECTS)) {
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
  buildPortRedirectHtml,
  getAliasRedirectTarget,
  isPortSeoRedirectSlug,
  getPreservedPortDirectorySlugs,
  writePortSeoRedirectPages,
};

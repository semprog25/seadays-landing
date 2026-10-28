'use strict';

/**
 * Generation channels for landing static HTML.
 *
 * Default `node scripts/generateBlogs.js` still regenerates blogs + ships + ports
 * (local/full rebuild), but catalogue orphan deletion is opt-in via
 * `--allow-orphan-cleanup`.
 */

function hasFlag(argv, flag) {
  return Array.isArray(argv) && argv.includes(flag);
}

function parseOnlySlugs(argv = []) {
  const raw = Array.isArray(argv) ? argv.find((a) => String(a).startsWith('--only=')) : '';
  if (!raw) return [];
  return String(raw)
    .slice('--only='.length)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseGenerateMode(argv = process.argv) {
  const sitemapOnly = hasFlag(argv, '--sitemap-only');
  const blogsOnly = hasFlag(argv, '--blogs-only');
  const portsOnly = hasFlag(argv, '--ports-only');
  const shipsOnly = hasFlag(argv, '--ships-only');
  const catalogueOnly = hasFlag(argv, '--catalogue-only');
  const explicitFull = hasFlag(argv, '--full');
  const allowOrphanRequested = hasFlag(argv, '--allow-orphan-cleanup');
  const onlySlugs = parseOnlySlugs(argv);
  const scoped = blogsOnly || portsOnly || shipsOnly || catalogueOnly || sitemapOnly;
  const full = explicitFull || !scoped;

  if (sitemapOnly) {
    return {
      sitemapOnly: true,
      blogs: false,
      ships: false,
      ports: false,
      full: false,
      allowOrphanCleanup: false,
      onlySlugs: [],
      label: 'sitemap-only',
    };
  }

  const blogs = full || blogsOnly;
  const ships = full || catalogueOnly || shipsOnly;
  const ports = full || catalogueOnly || portsOnly;
  const allowOrphanCleanup = Boolean(allowOrphanRequested && (ships || ports));

  const labelParts = [];
  if (full) labelParts.push('full');
  else {
    if (blogsOnly) labelParts.push('blogs');
    if (shipsOnly) labelParts.push('ships');
    if (portsOnly) labelParts.push('ports');
    if (catalogueOnly) labelParts.push('catalogue');
  }
  if (allowOrphanCleanup) labelParts.push('orphan-cleanup');
  if (onlySlugs.length) labelParts.push(`only=${onlySlugs.length}`);

  return {
    sitemapOnly: false,
    blogs,
    ships,
    ports,
    full,
    allowOrphanCleanup,
    onlySlugs,
    label: labelParts.join('+') || 'full',
  };
}

function generateArgsForChannel(channel, { allowOrphanCleanup = false } = {}) {
  switch (String(channel || '').trim()) {
    case 'sitemap':
      return ['--sitemap-only'];
    case 'blogs':
      return ['--blogs-only'];
    case 'ports':
      return ['--ports-only'];
    case 'ships':
      return ['--ships-only'];
    case 'catalogue':
      return ['--catalogue-only'];
    case 'full':
      return allowOrphanCleanup ? ['--full', '--allow-orphan-cleanup'] : ['--full'];
    default:
      throw new Error(`Unknown generation channel: ${channel}`);
  }
}

/**
 * Fail closed: --only= must not run blog/sitemap/orphan paths that touch unrelated files.
 */
function validateTargetedOnlyMode(mode) {
  if (!mode || !mode.onlySlugs || !mode.onlySlugs.length) return;
  if (mode.blogs) {
    throw new Error(
      '[generateBlogs] --only= cannot be combined with blog generation (--full or --blogs-only). Use --ships-only, --ports-only, or --catalogue-only.'
    );
  }
  if (!mode.ships && !mode.ports) {
    throw new Error(
      '[generateBlogs] --only= requires ship and/or port generation (--ships-only, --ports-only, or --catalogue-only).'
    );
  }
  if (mode.allowOrphanCleanup) {
    throw new Error('[generateBlogs] --only= cannot be combined with --allow-orphan-cleanup.');
  }
  if (mode.sitemapOnly) {
    throw new Error('[generateBlogs] --only= cannot be combined with --sitemap-only.');
  }
}

function assertOnlySlugsResolvable(mode, shipSlugSet, portSlugSet) {
  if (!mode || !mode.onlySlugs || !mode.onlySlugs.length) return;
  validateTargetedOnlyMode(mode);
  for (const raw of mode.onlySlugs) {
    const slug = String(raw || '').trim();
    if (!slug) {
      throw new Error('[generateBlogs] --only= contains an empty slug.');
    }
    const isShip = shipSlugSet.has(slug);
    const isPort = portSlugSet.has(slug);
    if (!isShip && !isPort) {
      throw new Error(`[generateBlogs] --only=${slug} is not a known ship or port slug in the catalogue dataset.`);
    }
    if (isShip && !mode.ships) {
      throw new Error(`[generateBlogs] --only=${slug} is a ship slug but --ships-only / catalogue ships are disabled.`);
    }
    if (isPort && !mode.ports) {
      throw new Error(`[generateBlogs] --only=${slug} is a port slug but --ports-only / catalogue ports are disabled.`);
    }
  }
}

function isTargetedCatalogueMode(mode) {
  return Boolean(mode && mode.onlySlugs && mode.onlySlugs.length);
}

function shouldWriteShipDetail(mode, shipSlug) {
  if (!mode.ships) return false;
  if (!isTargetedCatalogueMode(mode)) return true;
  return mode.onlySlugs.includes(String(shipSlug || '').trim());
}

function shouldWritePortDetail(mode, portSlug) {
  if (!mode.ports) return false;
  if (!isTargetedCatalogueMode(mode)) return true;
  return mode.onlySlugs.includes(String(portSlug || '').trim());
}

/**
 * Targeted --only= port writes must not downgrade bookable experiences to the app-download fallback.
 */
function assertTargetedPortAffiliateWritable(mode, affiliate, portSlug) {
  if (!isTargetedCatalogueMode(mode) || !mode.ports) return;
  if (!affiliate || affiliate.privateIsland || !affiliate.show) return;
  if (affiliate.url) return;
  const slug = String(portSlug || '').trim() || 'unknown';
  throw new Error(
    `[generateBlogs] Refusing targeted write for port "${slug}": bookable experiences require a Viator affiliate URL. ` +
      'Set VIATOR_AFFILIATE_PID and VIATOR_AFFILIATE_MCID in the environment (GitHub Actions secrets for CI), or run without --only=.'
  );
}

function commitMessageForChannel(channel) {
  switch (String(channel || '').trim()) {
    case 'sitemap':
      return 'chore: regenerate sitemap [skip ci]';
    case 'blogs':
      return 'chore: regenerate static blog and sitemap [skip ci]';
    case 'ports':
      return 'chore: regenerate port catalogue and sitemap [skip ci]';
    case 'ships':
      return 'chore: regenerate ship catalogue and sitemap [skip ci]';
    case 'catalogue':
      return 'chore: regenerate ships, ports, and sitemap [skip ci]';
    case 'full':
      return 'chore: regenerate static blog, ships, ports, and sitemap [skip ci]';
    default:
      return 'chore: regenerate static site output [skip ci]';
  }
}

module.exports = {
  parseGenerateMode,
  parseOnlySlugs,
  generateArgsForChannel,
  commitMessageForChannel,
  validateTargetedOnlyMode,
  assertOnlySlugsResolvable,
  isTargetedCatalogueMode,
  shouldWriteShipDetail,
  shouldWritePortDetail,
  assertTargetedPortAffiliateWritable,
};

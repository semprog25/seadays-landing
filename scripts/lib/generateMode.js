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
};

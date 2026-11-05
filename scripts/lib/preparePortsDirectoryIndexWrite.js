'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildPortsIndexHtml,
  loadRegionImageManifest,
} = require('./portsDirectoryIndex');
const {
  enrichSeoPortsForDirectoryIndex,
  loadVerifiedPortDestinationUrlBySlug,
} = require('./portsDirectoryImageResolve');

/**
 * Shared ports/index.html write path for regenerate-ports-index.js and
 * generateBlogs.js --ports-only (CI Generate port catalogue channel).
 */
function enrichSeoPortsForDirectoryIndexWrite({
  repoRoot,
  seoPorts,
  slugToAppPortId = {},
  publicGuidesByAppPortId = {},
}) {
  enrichSeoPortsForDirectoryIndex(seoPorts, {
    repoRoot,
    slugToAppPortId,
    publicGuidesByAppPortId,
  });
}

function buildPreparedPortsIndexHtmlOptions({
  repoRoot,
  seoPorts,
  slugToAppPortId = {},
  publicGuidesByAppPortId = {},
  featuredGuideCardsHtml = '',
  indexStyles = '',
  analyticsHeadHtml = '',
  runtimeGuardScript = '',
  baseUrl = 'https://seadays.app',
  defaultFavicon = '',
}) {
  enrichSeoPortsForDirectoryIndexWrite({
    repoRoot,
    seoPorts,
    slugToAppPortId,
    publicGuidesByAppPortId,
  });
  return {
    ports: seoPorts,
    featuredGuideCardsHtml,
    regionImages: loadRegionImageManifest(repoRoot),
    verifiedPortImagesBySlug: loadVerifiedPortDestinationUrlBySlug(repoRoot),
    repoRoot,
    indexStyles,
    analyticsHeadHtml,
    runtimeGuardScript,
    baseUrl,
    defaultFavicon,
  };
}

function buildPreparedPortsIndexHtml(opts) {
  return buildPortsIndexHtml(buildPreparedPortsIndexHtmlOptions(opts));
}

function writePortsDirectoryIndexFromCatalogue({
  repoRoot,
  seoPorts,
  slugToAppPortId = {},
  publicGuidesByAppPortId = {},
  featuredGuideCardsHtml = '',
  indexStyles = '',
  analyticsHeadHtml = '',
  runtimeGuardScript = '',
  baseUrl = 'https://seadays.app',
  defaultFavicon = '',
  transformHtml = (html) => html,
}) {
  const indexPath = path.join(repoRoot, 'ports', 'index.html');
  const html = buildPreparedPortsIndexHtml({
    repoRoot,
    seoPorts,
    slugToAppPortId,
    publicGuidesByAppPortId,
    featuredGuideCardsHtml,
    indexStyles,
    analyticsHeadHtml,
    runtimeGuardScript,
    baseUrl,
    defaultFavicon,
  });
  fs.writeFileSync(indexPath, transformHtml(html), 'utf8');
  return indexPath;
}

module.exports = {
  enrichSeoPortsForDirectoryIndexWrite,
  buildPreparedPortsIndexHtmlOptions,
  buildPreparedPortsIndexHtml,
  writePortsDirectoryIndexFromCatalogue,
};

'use strict';

/**
 * Generation scope derived from the same push context as the banner-only diff gate.
 * Do not set scope via a separate manual toggle.
 */
const { resolveGateMode } = require('../assert-ports-regen-banner-only-diff');

function resolvePortsRegenScopeMode() {
  return resolveGateMode();
}

function isBannerOnlyPortsRegenScope() {
  return resolvePortsRegenScopeMode() === 'banner-only';
}

/**
 * Ports-channel runs that must not dirty blog/, ads.txt, or sitemap.xml.
 */
function isPortsOnlyBannerRegenGeneration(mode) {
  if (!mode || mode.full || mode.sitemapOnly) return false;
  if (!mode.ports || mode.ships || mode.blogs) return false;
  return isBannerOnlyPortsRegenScope();
}

function shouldPreserveGlobalSiteArtifacts(mode, { targetedOnly = false } = {}) {
  if (targetedOnly) return true;
  if (isPortsOnlyBannerRegenGeneration(mode)) return true;
  return false;
}

module.exports = {
  resolvePortsRegenScopeMode,
  isBannerOnlyPortsRegenScope,
  isPortsOnlyBannerRegenGeneration,
  shouldPreserveGlobalSiteArtifacts,
};

'use strict';

/**
 * Batch 02 destination approval — owner visual approval is primary.
 * Separate: licence verification, provider geo contradiction (not missing metadata).
 */

const PROVIDER_GEO_CONTRADICTIONS = Object.freeze({
  'curacao-willemstad-curacao': {
    assignedPort: 'Curaçao (Willemstad)',
    providerImageId: 1450360,
    evidenceUrl: 'https://www.pexels.com/photo/photo-of-beach-during-golden-hour-1450360/',
    providerLocationClaim: 'Maldives',
    summary:
      'Pexels structured location lists Maldives while this port is Curaçao. Owner selection retained; public directory render withheld pending explicit override.',
  },
  'costa-maya-mexico': {
    assignedPort: 'Costa Maya, Mexico',
    providerImageId: 1450352,
    evidenceUrl: 'https://www.pexels.com/photo/photo-of-ocean-1450352/',
    providerLocationClaim: 'Maldives',
    summary:
      'Pexels structured location lists Maldives while this port is Costa Maya, Mexico. Owner selection retained; public directory render withheld pending explicit override.',
  },
});

function getProviderGeoContradiction(slug) {
  if (!slug) return null;
  return PROVIDER_GEO_CONTRADICTIONS[slug] || null;
}

function isExcludedFromPublicDirectoryRender(slug) {
  return Boolean(getProviderGeoContradiction(slug));
}

/** @deprecated Use isExcludedFromPublicDirectoryRender — only contradictions, not missing metadata */
function isProductionGeoBlocked(slug) {
  return isExcludedFromPublicDirectoryRender(slug);
}

module.exports = {
  PROVIDER_GEO_CONTRADICTIONS,
  getProviderGeoContradiction,
  isExcludedFromPublicDirectoryRender,
  isProductionGeoBlocked,
  PRODUCTION_GEO_BLOCK_SLUGS: new Set(Object.keys(PROVIDER_GEO_CONTRADICTIONS)),
};

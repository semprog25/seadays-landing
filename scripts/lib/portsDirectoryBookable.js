'use strict';

const { resolvePortAffiliateCta } = require('./viatorAffiliate');

function applyHasBookableExperiencesToSeoPorts(seoPorts, opts = {}) {
  const {
    appRoot,
    slugToAppPortId = {},
    knownAffiliatePortIds,
    viatorConfig,
  } = opts;
  if (!Array.isArray(seoPorts)) return;
  for (const port of seoPorts) {
    if (!port || !port.slug) continue;
    const appPortId = slugToAppPortId[port.slug] || '';
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
}

module.exports = { applyHasBookableExperiencesToSeoPorts };

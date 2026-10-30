'use strict';

function resolveCatalogAdaptationDisclosure(fields) {
  const kind = fields?.adaptationKind || 'none';
  if (kind === 'none') return null;
  const custom = String(fields?.adaptationNote || '').trim();
  if (custom) return custom;
  if (kind === 'presentationCrop') {
    return 'Shown in a 3:2 layout frame from the unchanged Wikimedia file (presentation crop only).';
  }
  return 'Uses a modified image file published on Wikimedia Commons; see the file page for details.';
}

function pickPublicCatalogAttribution(attribution) {
  const out = {
    creator: attribution.creator,
    license: attribution.license,
    licenseUrl: attribution.licenseUrl,
  };
  if (attribution.creatorUrl && String(attribution.creatorUrl).trim()) {
    out.creatorUrl = String(attribution.creatorUrl).trim();
  }
  const kind = attribution.adaptationKind;
  if (kind && kind !== 'none') {
    out.adaptationKind = kind;
    if (attribution.adaptationNote && String(attribution.adaptationNote).trim()) {
      out.adaptationNote = String(attribution.adaptationNote).trim();
    }
  }
  return out;
}

module.exports = {
  resolveCatalogAdaptationDisclosure,
  pickPublicCatalogAttribution,
};

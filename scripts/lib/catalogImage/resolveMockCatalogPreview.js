'use strict';

const { readCatalogImageKvValue, pickCatalogImageDisplayUrl } = require('./readCatalogImageValue');
const {
  isMockCatalogPreviewEnabled,
  shouldSkipMockCatalogPreviewForEntityImage,
} = require('./mockCatalogPreviewConfig');
const {
  MOCK_CATALOG_TEST_ONLY_LABEL,
  PHASE_C_MOCK_RECORD_BY_SLUG,
  PHASE_C_PORT_DESTINATION_HERO_BY_SLUG,
  PHASE_C_PILOT_SHIP_APP_TO_SLUG,
  PHASE_C_PILOT_PORT_APP_TO_SLUG,
} = require('./phaseCMockData');

function resolveCanonicalSlugForMockPreview(kind, appId, slugMaps) {
  const trimmed = String(appId || '').trim();
  if (!trimmed) return null;
  if (kind === 'ship') {
    return (slugMaps?.shipAppIdToSlug ?? PHASE_C_PILOT_SHIP_APP_TO_SLUG)[trimmed] ?? null;
  }
  return (slugMaps?.portAppIdToSlug ?? PHASE_C_PILOT_PORT_APP_TO_SLUG)[trimmed] ?? null;
}

function resolvePortMockRecord(canonicalSlug, surface, recordBySlug) {
  const role = surface === 'portInfrastructure' ? 'portInfrastructure' : 'destinationHero';
  if (role === 'destinationHero') {
    const dest = PHASE_C_PORT_DESTINATION_HERO_BY_SLUG[canonicalSlug];
    if (dest) return dest;
  }
  return recordBySlug[canonicalSlug] ?? null;
}

function buildPreviewHeroFromRecord(raw, kind, canonicalSlug, portPreviewRole) {
  const outcome = readCatalogImageKvValue(raw, {
    expectedKind: kind,
    expectedCanonicalSlug: canonicalSlug,
  });
  const displayUrl = pickCatalogImageDisplayUrl(outcome);
  if (!displayUrl || outcome.kind !== 'verified_record') return null;

  return {
    displayUrl,
    alt: outcome.payload.alt,
    payload: outcome.payload,
    canonicalSlug,
    mockTestOnlyLabel: MOCK_CATALOG_TEST_ONLY_LABEL,
    portPreviewRole,
  };
}

function readMockCatalogPreviewOutcome(kind, canonicalSlug, recordBySlug = PHASE_C_MOCK_RECORD_BY_SLUG) {
  const raw = recordBySlug[canonicalSlug];
  if (!raw) {
    return { kind: 'unavailable', reason: 'mock_missing_kv_entry' };
  }
  return readCatalogImageKvValue(raw, {
    expectedKind: kind,
    expectedCanonicalSlug: canonicalSlug,
  });
}

function resolveMockCatalogPreviewImage(kind, appId, surface, options) {
  const previewEnabled = options?.previewEnabled ?? isMockCatalogPreviewEnabled();
  if (!previewEnabled) return null;
  if (shouldSkipMockCatalogPreviewForEntityImage(options?.entityImage)) return null;

  const canonicalSlug = resolveCanonicalSlugForMockPreview(kind, appId, options?.slugMaps);
  if (!canonicalSlug) return null;

  const recordBySlug = options?.recordBySlug ?? PHASE_C_MOCK_RECORD_BY_SLUG;

  if (kind === 'ship') {
    if (surface === 'portInfrastructure') return null;
    const raw = recordBySlug[canonicalSlug];
    if (!raw) return null;
    return buildPreviewHeroFromRecord(raw, kind, canonicalSlug);
  }

  const role = surface === 'portInfrastructure' ? 'portInfrastructure' : 'destinationHero';
  const raw = resolvePortMockRecord(canonicalSlug, surface, recordBySlug);
  if (!raw) return null;
  return buildPreviewHeroFromRecord(raw, kind, canonicalSlug, role);
}

function resolveMockCatalogPreviewHero(kind, appId, options) {
  const surface = options?.surface ?? 'detailHero';
  return resolveMockCatalogPreviewImage(kind, appId, surface, options);
}

function resolveMockCatalogPreviewPortInfrastructure(appId, options) {
  return resolveMockCatalogPreviewImage('port', appId, 'portInfrastructure', options);
}

module.exports = {
  resolveCanonicalSlugForMockPreview,
  readMockCatalogPreviewOutcome,
  resolveMockCatalogPreviewHero,
  resolveMockCatalogPreviewPortInfrastructure,
  resolveMockCatalogPreviewImage,
};

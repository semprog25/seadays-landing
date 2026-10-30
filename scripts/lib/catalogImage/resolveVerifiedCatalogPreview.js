'use strict';

const {
  readCatalogImagePublicGetOutcome,
  pickCatalogImageDisplayUrl,
} = require('./readCatalogImageValue');
const {
  isVerifiedCatalogPreviewEnabled,
  shouldSkipVerifiedCatalogPreviewForEntityImage,
} = require('./verifiedCatalogPreviewConfig');
const {
  VERIFIED_CATALOG_TEST_ONLY_LABEL,
  D3B_PILOT_SHIP_APP_TO_SLUG,
  D3B_PILOT_PORT_APP_TO_SLUG,
  readVerifiedCatalogGetEnvelope,
  resolvePilotCatalogReadPlan,
  getRawKvRecord,
} = require('./phaseD3BVerifiedFixtures');

function resolveCanonicalSlugForVerifiedPreview(kind, appId, slugMaps) {
  const trimmed = String(appId || '').trim();
  if (!trimmed) return null;
  if (kind === 'ship') {
    return (slugMaps?.shipAppIdToSlug ?? D3B_PILOT_SHIP_APP_TO_SLUG)[trimmed] ?? null;
  }
  return (slugMaps?.portAppIdToSlug ?? D3B_PILOT_PORT_APP_TO_SLUG)[trimmed] ?? null;
}

function readFirstVerifiedEnvelopeForRole(kind, appId, role, options) {
  const canonicalSlug = resolveCanonicalSlugForVerifiedPreview(kind, appId, options?.slugMaps);
  if (!canonicalSlug) {
    return {
      envelope: null,
      kvKey: null,
      canonicalSlug: null,
      outcome: { kind: 'unavailable', reason: 'missing_slug_mapping' },
    };
  }

  const plan = resolvePilotCatalogReadPlan(kind, role, appId, canonicalSlug);
  for (const candidate of plan) {
    if (options?.strictCanonicalOnly && !candidate.strictRoleBinding) continue;
    const shipKeyBinding = candidate.kvKey.startsWith('ship:image:') ? 'canonicalSlugHero' : undefined;
    const envelope = readVerifiedCatalogGetEnvelope(candidate.kvKey, shipKeyBinding);
    const entity = getRawKvRecord(candidate.kvKey)?.entity;
    const outcome = readCatalogImagePublicGetOutcome(envelope, {
      expectedKind: kind,
      expectedCanonicalSlug: canonicalSlug,
      entity,
    });
    if (outcome.kind === 'verified_record') {
      return { envelope, kvKey: candidate.kvKey, canonicalSlug, outcome };
    }
  }

  return { envelope: null, kvKey: null, canonicalSlug, outcome: { kind: 'unavailable', reason: 'no_verified_fixture' } };
}

function buildPreviewHeroFromVerifiedOutcome(outcome, canonicalSlug, catalogPreviewRole) {
  const displayUrl = pickCatalogImageDisplayUrl(outcome);
  if (!displayUrl || outcome.kind !== 'verified_record') return null;

  return {
    displayUrl,
    alt: outcome.payload.alt,
    payload: outcome.payload,
    canonicalSlug,
    catalogPreviewRole,
    verifiedTestOnlyLabel: VERIFIED_CATALOG_TEST_ONLY_LABEL,
  };
}

function resolveVerifiedCatalogPreviewImage(kind, appId, surface, options) {
  const previewEnabled = options?.previewEnabled ?? isVerifiedCatalogPreviewEnabled();
  if (!previewEnabled) return null;
  if (shouldSkipVerifiedCatalogPreviewForEntityImage(options?.entityImage)) return null;

  const role =
    kind === 'ship'
      ? 'hero'
      : surface === 'portInfrastructure'
        ? 'portInfrastructure'
        : 'destinationHero';

  const read = readFirstVerifiedEnvelopeForRole(kind, appId, role, {
    slugMaps: options?.slugMaps,
    strictCanonicalOnly: options?.strictCanonicalOnly !== false,
  });

  if (read.outcome.kind !== 'verified_record') return null;

  const portPreviewRole = kind === 'port' ? role : undefined;
  return buildPreviewHeroFromVerifiedOutcome(read.outcome, read.canonicalSlug, portPreviewRole);
}

function resolveVerifiedCatalogPreviewHero(kind, appId, options) {
  const surface = options?.surface ?? 'detailHero';
  return resolveVerifiedCatalogPreviewImage(kind, appId, surface, options);
}

function resolveVerifiedCatalogPreviewPortInfrastructure(appId, options) {
  return resolveVerifiedCatalogPreviewImage('port', appId, 'portInfrastructure', options);
}

module.exports = {
  resolveCanonicalSlugForVerifiedPreview,
  readFirstVerifiedEnvelopeForRole,
  resolveVerifiedCatalogPreviewHero,
  resolveVerifiedCatalogPreviewPortInfrastructure,
  resolveVerifiedCatalogPreviewImage,
};

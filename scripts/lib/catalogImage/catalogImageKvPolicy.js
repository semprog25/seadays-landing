'use strict';

function defaultRoleForKvSlot(slot) {
  if (slot === 'shipHero') return 'hero';
  if (slot === 'portDestination') return 'destinationHero';
  if (slot === 'portInfrastructure') return 'portInfrastructure';
  return null;
}

const ID_SEGMENT_RE = /^[a-z0-9][a-z0-9-]{0,126}$/i;

function isValidIdSegment(segment) {
  return ID_SEGMENT_RE.test(segment);
}

function buildShipHeroCanonicalKvKey(canonicalSlug) {
  return `ship:image:${canonicalSlug}`;
}

function buildPortDestinationCanonicalKvKey(canonicalSlug) {
  return `port:image:destination:${canonicalSlug}`;
}

function buildPortInfrastructureCanonicalKvKey(canonicalSlug) {
  return `port:image:infrastructure:${canonicalSlug}`;
}

function buildLegacyShipAppIdKvKey(appId) {
  return `ship:image:${appId}`;
}

function buildLegacyPortAppIdKvKey(appId) {
  return `port:image:${appId}`;
}

function parseCatalogImageKvKey(rawKey) {
  const key = String(rawKey || '').trim();
  if (!key) return { ok: false, reason: 'empty' };

  const portDestination = key.match(/^port:image:destination:([^/]+)$/);
  if (portDestination) {
    const identifier = portDestination[1];
    if (!isValidIdSegment(identifier)) return { ok: false, reason: 'invalid_segment' };
    return {
      ok: true,
      parsed: {
        slot: 'portDestinationCanonical',
        kind: 'port',
        expectedRole: defaultRoleForKvSlot('portDestination'),
        identifier,
        rawKey: key,
      },
    };
  }

  const portInfrastructure = key.match(/^port:image:infrastructure:([^/]+)$/);
  if (portInfrastructure) {
    const identifier = portInfrastructure[1];
    if (!isValidIdSegment(identifier)) return { ok: false, reason: 'invalid_segment' };
    return {
      ok: true,
      parsed: {
        slot: 'portInfrastructureCanonical',
        kind: 'port',
        expectedRole: defaultRoleForKvSlot('portInfrastructure'),
        identifier,
        rawKey: key,
      },
    };
  }

  const legacyPort = key.match(/^port:image:([^/]+)$/);
  if (legacyPort) {
    const identifier = legacyPort[1];
    if (!isValidIdSegment(identifier)) return { ok: false, reason: 'invalid_segment' };
    return {
      ok: true,
      parsed: {
        slot: 'legacyPortAppId',
        kind: 'port',
        expectedRole: null,
        identifier,
        rawKey: key,
      },
    };
  }

  const shipSegment = key.match(/^ship:image:([^/]+)$/);
  if (shipSegment) {
    const identifier = shipSegment[1];
    if (!isValidIdSegment(identifier)) return { ok: false, reason: 'invalid_segment' };
    return {
      ok: true,
      parsed: {
        slot: 'shipImageAmbiguous',
        kind: 'ship',
        expectedRole: null,
        identifier,
        rawKey: key,
      },
    };
  }

  return { ok: false, reason: 'unknown_pattern' };
}

function resolveShipKvKeyBinding(parsed, intent) {
  if (parsed.slot !== 'shipImageAmbiguous') return parsed;
  if (intent === 'canonicalSlugHero') {
    return {
      ...parsed,
      slot: 'shipHeroCanonical',
      expectedRole: defaultRoleForKvSlot('shipHero'),
    };
  }
  return {
    ...parsed,
    slot: 'legacyShipAppId',
    expectedRole: null,
  };
}

function planCatalogImageReadKeys(input) {
  if (input.kind === 'ship' && input.role === 'hero') {
    return [
      { kvKey: buildShipHeroCanonicalKvKey(input.canonicalSlug), slot: 'shipHeroCanonical', strictRoleBinding: true },
      { kvKey: buildLegacyShipAppIdKvKey(input.appId), slot: 'legacyShipAppId', strictRoleBinding: false },
    ];
  }

  if (input.kind === 'port' && input.role === 'destinationHero') {
    return [
      {
        kvKey: buildPortDestinationCanonicalKvKey(input.canonicalSlug),
        slot: 'portDestinationCanonical',
        strictRoleBinding: true,
      },
      { kvKey: buildLegacyPortAppIdKvKey(input.appId), slot: 'legacyPortAppId', strictRoleBinding: false },
    ];
  }

  if (input.kind === 'port' && input.role === 'portInfrastructure') {
    return [
      {
        kvKey: buildPortInfrastructureCanonicalKvKey(input.canonicalSlug),
        slot: 'portInfrastructureCanonical',
        strictRoleBinding: true,
      },
    ];
  }

  return [];
}

module.exports = {
  buildShipHeroCanonicalKvKey,
  buildPortDestinationCanonicalKvKey,
  buildPortInfrastructureCanonicalKvKey,
  buildLegacyShipAppIdKvKey,
  buildLegacyPortAppIdKvKey,
  parseCatalogImageKvKey,
  resolveShipKvKeyBinding,
  planCatalogImageReadKeys,
};

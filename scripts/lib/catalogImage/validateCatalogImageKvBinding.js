'use strict';

const { parseCatalogImageKvKey, resolveShipKvKeyBinding } = require('./catalogImageKvPolicy');
const { validateCatalogImageRecordV1, isHttpsUrl } = require('./validateCatalogImageRecord');
const { readCatalogImageKvValue } = require('./readCatalogImageValue');

function validateCatalogImageKvBinding(rawValue, options) {
  const parsedKey = parseCatalogImageKvKey(options.kvKey);
  if (!parsedKey.ok) {
    return {
      ok: false,
      issues: [{ code: 'malformed_record', message: `Unrecognized KV key: ${options.kvKey}` }],
    };
  }
  let parsed = parsedKey.parsed;
  if (parsed.slot === 'shipImageAmbiguous') {
    if (!options.shipKeyBinding) {
      return {
        ok: false,
        issues: [
          {
            code: 'malformed_record',
            message: 'ship:image keys require shipKeyBinding (canonicalSlugHero or legacyAppId)',
          },
        ],
      };
    }
    parsed = resolveShipKvKeyBinding(parsed, options.shipKeyBinding);
  }
  return validateCatalogImageKvBindingForParsedKey(rawValue, parsed, options);
}

function validateCatalogImageKvBindingForParsedKey(rawValue, parsed, options) {
  const rejectLegacy =
    options.rejectLegacyPlainUrlOnStrictKeys !== false &&
    parsed.slot !== 'legacyShipAppId' &&
    parsed.slot !== 'legacyPortAppId';

  if (rejectLegacy && typeof rawValue === 'string' && !rawValue.trim().startsWith('{')) {
    return {
      ok: false,
      issues: [
        {
          code: 'invalid_role',
          message: 'Plain URL legacy values are not allowed on role-specific canonical keys',
        },
      ],
    };
  }

  if (
    (parsed.slot === 'legacyShipAppId' || parsed.slot === 'legacyPortAppId') &&
    typeof rawValue === 'string' &&
    !rawValue.trim().startsWith('{')
  ) {
    if (!isHttpsUrl(rawValue)) {
      return {
        ok: false,
        issues: [{ code: 'invalid_url', message: 'Legacy catalogue URL must be https' }],
      };
    }
    return { ok: true, issues: [] };
  }

  const requireRole = parsed.expectedRole !== null;
  const base = validateCatalogImageRecordV1(rawValue, {
    expectedKind: parsed.kind,
    expectedCanonicalSlug:
      parsed.slot === 'legacyShipAppId' || parsed.slot === 'legacyPortAppId'
        ? undefined
        : parsed.identifier,
    expectedRole: parsed.expectedRole ?? undefined,
    requireRole,
  });

  if (!base.ok) return base;

  if (parsed.expectedRole && base.record?.role && base.record.role !== parsed.expectedRole) {
    return {
      ok: false,
      issues: [
        {
          code: 'role_mismatch',
          message: `Record role ${base.record.role} does not match key slot ${parsed.expectedRole}`,
        },
      ],
    };
  }

  return base;
}

function readCatalogImageKvValueForKey(rawValue, kvKey, shipKeyBinding) {
  const binding = validateCatalogImageKvBinding(rawValue, { kvKey, shipKeyBinding });
  if (!binding.ok) {
    return { kind: 'unavailable', reason: 'kv_binding_failed' };
  }

  const parsedKey = parseCatalogImageKvKey(kvKey);
  if (!parsedKey.ok) {
    return { kind: 'unavailable', reason: 'invalid_kv_key' };
  }
  let parsed = parsedKey.parsed;
  if (parsed.slot === 'shipImageAmbiguous') {
    if (!shipKeyBinding) {
      return { kind: 'unavailable', reason: 'ship_key_binding_required' };
    }
    parsed = resolveShipKvKeyBinding(parsed, shipKeyBinding);
  }

  return readCatalogImageKvValue(rawValue, {
    expectedKind: parsed.kind,
    expectedCanonicalSlug:
      parsed.slot === 'legacyShipAppId' || parsed.slot === 'legacyPortAppId'
        ? undefined
        : parsed.identifier,
    expectedRole: parsed.expectedRole ?? undefined,
    requireRole: parsed.expectedRole !== null,
  });
}

module.exports = {
  validateCatalogImageKvBinding,
  readCatalogImageKvValueForKey,
};

'use strict';

const {
  validateCatalogImageRecordV1,
  isCatalogImageRecordDisplayable,
  isHttpsUrl,
} = require('./validateCatalogImageRecord');

function tryParseJsonObject(value) {
  const trimmed = value.trim();
  if (!trimmed.startsWith('{')) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    return null;
  }
}

function readCatalogImageKvValue(rawValue, options) {
  if (rawValue === null || rawValue === undefined) {
    return { kind: 'unavailable', reason: 'null_value' };
  }

  if (typeof rawValue === 'string') {
    const parsed = tryParseJsonObject(rawValue);
    if (parsed) {
      return readCatalogImageKvValue(parsed, options);
    }
    if (rawValue.startsWith('data:')) {
      return { kind: 'unavailable', reason: 'legacy_data_url_rejected' };
    }
    if (!isHttpsUrl(rawValue)) {
      return { kind: 'unavailable', reason: 'legacy_non_https_rejected' };
    }
    return { kind: 'legacy_url', url: rawValue };
  }

  if (typeof rawValue === 'object') {
    const validation = validateCatalogImageRecordV1(rawValue, options);
    if (!validation.ok || !validation.record) {
      return { kind: 'unavailable', reason: 'invalid_record' };
    }
    if (!isCatalogImageRecordDisplayable(validation.record)) {
      return { kind: 'unavailable', reason: `status_${validation.record.status}` };
    }
    return {
      kind: 'verified_record',
      payload: {
        url: validation.record.media.url,
        alt: validation.record.media.alt,
        attribution: validation.record.attribution,
        commons: validation.record.commons,
        entity: validation.record.entity,
      },
    };
  }

  return { kind: 'unavailable', reason: 'unsupported_value_type' };
}

function pickCatalogImageDisplayUrl(outcome) {
  if (outcome.kind === 'legacy_url') return outcome.url;
  if (outcome.kind === 'verified_record') return outcome.payload.url;
  return null;
}

function readCatalogImageGetResponse(body, options) {
  if (!body?.success) {
    return { kind: 'unavailable', reason: 'api_not_successful' };
  }
  return readCatalogImagePublicGetOutcome(body, options);
}

/**
 * D2H public GET: verified metadata lives on `display`; `value` is the legacy URL string.
 */
function readCatalogImagePublicGetOutcome(body, options) {
  if (!body?.success) {
    return { kind: 'unavailable', reason: 'api_not_successful' };
  }

  if (body.display?.url) {
    if (!isHttpsUrl(body.display.url)) {
      return { kind: 'unavailable', reason: 'invalid_display_url' };
    }
    const attr = body.display.attribution || {};
    const commons = body.display.commons || {};
    if (!attr.creator || !attr.license || !attr.licenseUrl || !commons.pageUrl) {
      return { kind: 'unavailable', reason: 'incomplete_public_display' };
    }
    return {
      kind: 'verified_record',
      payload: {
        url: body.display.url,
        alt: body.display.alt,
        attribution: body.display.attribution,
        commons: body.display.commons,
        entity: options?.entity,
      },
    };
  }

  return readCatalogImageKvValue(body.value ?? null, options);
}

module.exports = {
  readCatalogImageKvValue,
  pickCatalogImageDisplayUrl,
  readCatalogImageGetResponse,
  readCatalogImagePublicGetOutcome,
};

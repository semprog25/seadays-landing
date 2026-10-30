'use strict';

const { readCatalogImageKvValueForKey } = require('./validateCatalogImageKvBinding');
const { pickCatalogImageDisplayUrl } = require('./readCatalogImageValue');

function recordStatusFromRaw(raw) {
  let parsed = raw;
  if (typeof raw === 'string' && raw.trim().startsWith('{')) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  if (!parsed || typeof parsed !== 'object') return undefined;
  const status = parsed.status;
  if (status === 'draft' || status === 'verified' || status === 'rejected' || status === 'removed') {
    return status;
  }
  return undefined;
}

const { pickPublicCatalogAttribution } = require('./catalogImageAdaptationDisclosure');

function sanitizePublicDisplay(outcome) {
  if (outcome.kind !== 'verified_record') return undefined;
  return {
    url: outcome.payload.url,
    alt: outcome.payload.alt,
    attribution: pickPublicCatalogAttribution(outcome.payload.attribution),
    commons: outcome.payload.commons,
  };
}

/** D2H public GET envelope — local fixture reader only; no network I/O. */
function buildCatalogImageGetResponse(params) {
  if (params.rawValue === null || params.rawValue === undefined) {
    return { success: true, value: null };
  }

  const outcome = readCatalogImageKvValueForKey(
    params.rawValue,
    params.kvKey,
    params.shipKeyBinding,
  );

  const display = sanitizePublicDisplay(outcome);
  const status = recordStatusFromRaw(params.rawValue);
  const recordStatus = status === 'removed' || status === 'rejected' ? undefined : status;
  const legacyValue =
    outcome.kind === 'legacy_url' || outcome.kind === 'verified_record'
      ? pickCatalogImageDisplayUrl(outcome)
      : null;

  return {
    success: true,
    value: legacyValue,
    ...(display ? { display } : {}),
    ...(recordStatus ? { recordStatus } : {}),
  };
}

module.exports = {
  buildCatalogImageGetResponse,
};

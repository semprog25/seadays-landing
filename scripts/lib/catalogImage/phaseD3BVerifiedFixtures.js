'use strict';

const fs = require('fs');
const path = require('path');

const { buildCatalogImageGetResponse } = require('./buildCatalogImageGetResponse');
const { planCatalogImageReadKeys } = require('./catalogImageKvPolicy');

const FIXTURE_DIR = path.join(__dirname, '../../../data/catalog-image-verified-fixtures');

const VERIFIED_CATALOG_TEST_ONLY_LABEL =
  'VERIFIED CATALOG FIXTURE PREVIEW — local test only; not from production KV';

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(FIXTURE_DIR, name), 'utf8'));
}

const D3B_KV_RECORDS_BY_KEY = loadJson('kv-records-by-key.json');
const D3B_PILOT_MAPS = loadJson('pilot-maps.json');

function getRawKvRecord(kvKey) {
  if (!Object.prototype.hasOwnProperty.call(D3B_KV_RECORDS_BY_KEY, kvKey)) {
    return undefined;
  }
  return D3B_KV_RECORDS_BY_KEY[kvKey];
}

function readVerifiedCatalogGetEnvelope(kvKey, shipKeyBinding) {
  const rawValue = getRawKvRecord(kvKey);
  if (rawValue === undefined) {
    return { success: true, value: null };
  }
  return buildCatalogImageGetResponse({ kvKey, rawValue, shipKeyBinding });
}

function listPilotVerifiedGetEnvelopes() {
  const rows = [];
  for (const kvKey of Object.keys(D3B_KV_RECORDS_BY_KEY)) {
    const shipKeyBinding = kvKey.startsWith('ship:image:') ? 'canonicalSlugHero' : undefined;
    rows.push({
      kvKey,
      envelope: readVerifiedCatalogGetEnvelope(kvKey, shipKeyBinding),
    });
  }
  return rows;
}

function resolvePilotCatalogReadPlan(kind, role, appId, canonicalSlug) {
  return planCatalogImageReadKeys({ kind, role, canonicalSlug, appId });
}

module.exports = {
  VERIFIED_CATALOG_TEST_ONLY_LABEL,
  D3B_KV_RECORDS_BY_KEY,
  D3B_PILOT_SHIP_APP_TO_SLUG: D3B_PILOT_MAPS.shipAppIdToSlug,
  D3B_PILOT_PORT_APP_TO_SLUG: D3B_PILOT_MAPS.portAppIdToSlug,
  getRawKvRecord,
  readVerifiedCatalogGetEnvelope,
  listPilotVerifiedGetEnvelopes,
  resolvePilotCatalogReadPlan,
};

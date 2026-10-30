'use strict';

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data/catalog-image-mock');

function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), 'utf8'));
}

const MOCK_CATALOG_TEST_ONLY_LABEL =
  'MOCK / TEST ONLY — local preview only; not from production KV';

const PHASE_C_MOCK_RECORD_BY_SLUG = loadJson('records-by-slug.json');
const PHASE_C_PORT_DESTINATION_HERO_BY_SLUG = loadJson('port-destination-heroes.json');
const PHASE_C_PILOT_MAPS = loadJson('pilot-maps.json');

module.exports = {
  MOCK_CATALOG_TEST_ONLY_LABEL,
  PHASE_C_MOCK_RECORD_BY_SLUG,
  PHASE_C_PORT_DESTINATION_HERO_BY_SLUG,
  PHASE_C_PILOT_SHIP_APP_TO_SLUG: PHASE_C_PILOT_MAPS.shipAppIdToSlug,
  PHASE_C_PILOT_PORT_APP_TO_SLUG: PHASE_C_PILOT_MAPS.portAppIdToSlug,
};

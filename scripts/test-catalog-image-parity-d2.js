'use strict';

const fs = require('fs');
const path = require('path');
const { readCatalogImageKvValue } = require('./lib/catalogImage/readCatalogImageValue');
const { validateCatalogImageRecordV1 } = require('./lib/catalogImage/validateCatalogImageRecord');

const FIXTURES = JSON.parse(
  fs.readFileSync(path.join(__dirname, '../data/catalog-image-parity-fixtures.json'), 'utf8'),
);

function expectedRoleForKey(kvKey, shipKeyBinding) {
  if (kvKey.startsWith('port:image:destination:')) return 'destinationHero';
  if (kvKey.startsWith('port:image:infrastructure:')) return 'portInfrastructure';
  if (shipKeyBinding === 'canonicalSlugHero') return 'hero';
  return undefined;
}

let failed = 0;

for (const testCase of FIXTURES.cases) {
  const raw = testCase.rawLegacyUrl ?? testCase.record;

  if (testCase.record) {
    const expectedRole = expectedRoleForKey(testCase.kvKey, testCase.shipKeyBinding);
    const validation = validateCatalogImageRecordV1(testCase.record, {
      expectedRole,
      requireRole: Boolean(expectedRole),
    });
    if (validation.ok !== testCase.expectBindingOk) {
      console.error('FAIL record validation', testCase.id, validation.issues);
      failed += 1;
    }
  }

  if (testCase.rawLegacyUrl && testCase.expectBindingOk) {
    const read = readCatalogImageKvValue(raw, {});
    const displayable = read.kind === 'verified_record' || read.kind === 'legacy_url';
    if (displayable !== testCase.expectDisplay) {
      console.error('FAIL legacy read outcome', testCase.id, read.kind);
      failed += 1;
    }
  } else if (testCase.record && testCase.expectBindingOk && testCase.expectDisplay) {
    const expectedRole = expectedRoleForKey(testCase.kvKey, testCase.shipKeyBinding);
    const read = readCatalogImageKvValue(testCase.record, {
      expectedRole,
      requireRole: Boolean(expectedRole),
    });
    const displayable = read.kind === 'verified_record';
    if (displayable !== testCase.expectDisplay) {
      console.error('FAIL verified read outcome', testCase.id, read.kind);
      failed += 1;
    }
  }
}

if (failed > 0) {
  console.error(`catalog-image-parity-d2: ${failed} failures`);
  process.exit(1);
}

console.log(`catalog-image-parity-d2: ${FIXTURES.cases.length} cases PASS`);

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { validateCatalogImageRecordV1 } = require('./lib/catalogImage/validateCatalogImageRecord');
const {
  readCatalogImageKvValue,
  readCatalogImagePublicGetOutcome,
} = require('./lib/catalogImage/readCatalogImageValue');
const { buildCatalogImageGetResponse } = require('./lib/catalogImage/buildCatalogImageGetResponse');
const { validateCatalogImageKvBinding } = require('./lib/catalogImage/validateCatalogImageKvBinding');
const {
  isVerifiedCatalogPreviewEnabled,
  shouldSkipVerifiedCatalogPreviewForEntityImage,
} = require('./lib/catalogImage/verifiedCatalogPreviewConfig');
const {
  D3B_KV_RECORDS_BY_KEY,
  D3B_PILOT_SHIP_APP_TO_SLUG,
  D3B_PILOT_PORT_APP_TO_SLUG,
  listPilotVerifiedGetEnvelopes,
  getRawKvRecord,
} = require('./lib/catalogImage/phaseD3BVerifiedFixtures');
const {
  resolveVerifiedCatalogPreviewHero,
  resolveVerifiedCatalogPreviewPortInfrastructure,
  readFirstVerifiedEnvelopeForRole,
} = require('./lib/catalogImage/resolveVerifiedCatalogPreview');
const { buildCatalogAttributionHtml } = require('./lib/catalogImage/buildCatalogPreviewFigure');
const { PILOTS } = require('./buildCatalogVerifiedPreviewPages');

function assertNegative(label, condition) {
  if (!condition) {
    console.error('FAIL negative', label);
    process.exitCode = 1;
    return false;
  }
  return true;
}

function main() {
  assert.strictEqual(isVerifiedCatalogPreviewEnabled(), false, 'verified preview must default OFF');

  for (const row of listPilotVerifiedGetEnvelopes()) {
    assert.ok(row.envelope.success, `envelope success ${row.kvKey}`);
    if (row.envelope.display) {
      assert.strictEqual(row.envelope.recordStatus, 'verified', row.kvKey);
      assert.ok(row.envelope.display.url.startsWith('https://'), row.kvKey);
      assert.ok(!row.envelope.display.review, `${row.kvKey} must not expose review on GET`);
    }
  }

  for (const appId of Object.keys(D3B_PILOT_SHIP_APP_TO_SLUG)) {
    const hero = resolveVerifiedCatalogPreviewHero('ship', appId, { previewEnabled: true });
    assert.ok(hero, `ship hero ${appId}`);
    assert.ok(buildCatalogAttributionHtml(hero.payload).includes('Wikimedia Commons'));
  }

  for (const appId of Object.keys(D3B_PILOT_PORT_APP_TO_SLUG)) {
    const hero = resolveVerifiedCatalogPreviewHero('port', appId, { previewEnabled: true });
    const terminal = resolveVerifiedCatalogPreviewPortInfrastructure(appId, { previewEnabled: true });
    assert.ok(hero, `port hero ${appId}`);
    assert.ok(terminal, `port terminal ${appId}`);
    assert.strictEqual(hero.catalogPreviewRole, 'destinationHero');
    assert.strictEqual(terminal.catalogPreviewRole, 'portInfrastructure');
    assert.notStrictEqual(hero.displayUrl, terminal.displayUrl);
  }

  assert.strictEqual(shouldSkipVerifiedCatalogPreviewForEntityImage('https://example.com/x.jpg'), true);
  assert.strictEqual(
    resolveVerifiedCatalogPreviewHero('ship', 'wonder-seas', {
      previewEnabled: true,
      entityImage: 'https://example.com/x.jpg',
    }),
    null,
  );

  const hamburgDest = getRawKvRecord('port:image:destination:hamburg-germany');
  assert.ok(hamburgDest.media.url.includes('Elbphilharmonie'), 'Hamburg destination hero must stay city landmark');
  const barcelonaDest = getRawKvRecord('port:image:destination:barcelona-spain');
  assert.ok(barcelonaDest.media.url.includes('Barcelona_desde_El_Carmel'), 'Barcelona destination hero (D5B proposed Carmel skyline)');
  const miamiDest = getRawKvRecord('port:image:destination:miami-fl-united-states');
  assert.ok(miamiDest.media.url.includes('Miami_Sunset'), 'Miami sunset skyline destination hero');
  const miamiInfra = getRawKvRecord('port:image:infrastructure:miami-fl-united-states');
  assert.ok(miamiInfra.commons.file.includes('Port of Miami by Don Ramey Logan'), 'Miami infra commons file name');

  const draftBody = buildCatalogImageGetResponse({
    kvKey: 'port:image:destination:hamburg-germany',
    rawValue: { ...hamburgDest, status: 'draft' },
  });
  assertNegative('draft hides display', draftBody.display === undefined && draftBody.value === null);

  const wrongRoleBinding = validateCatalogImageKvBinding(
    { ...hamburgDest, role: 'portInfrastructure' },
    { kvKey: 'port:image:destination:hamburg-germany' },
  );
  assertNegative('wrong role on destination key', wrongRoleBinding.ok === false);

  const badUrlRecord = { ...hamburgDest, media: { ...hamburgDest.media, url: 'http://insecure.example/x.jpg' } };
  const badUrlEnvelope = buildCatalogImageGetResponse({
    kvKey: 'port:image:destination:hamburg-germany',
    rawValue: badUrlRecord,
  });
  assertNegative('invalid http media', badUrlEnvelope.display === undefined);

  const missingLicense = {
    ...hamburgDest,
    attribution: { ...hamburgDest.attribution, licenseUrl: '' },
  };
  const missingLicenseEnvelope = buildCatalogImageGetResponse({
    kvKey: 'port:image:destination:hamburg-germany',
    rawValue: missingLicense,
  });
  assertNegative('missing license', missingLicenseEnvelope.display === undefined);

  const legacyOnCanonical = buildCatalogImageGetResponse({
    kvKey: 'port:image:destination:hamburg-germany',
    rawValue: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/example.jpg/800px-example.jpg',
  });
  assertNegative('legacy string on canonical key', legacyOnCanonical.display === undefined);

  const unavailableSlug = readFirstVerifiedEnvelopeForRole('ship', 'unknown-ship', 'hero', {});
  assertNegative('missing mapping', unavailableSlug.outcome.kind === 'unavailable');

  const emptySource = {};
  assert.strictEqual(readCatalogImageKvValue(null, {}).kind, 'unavailable');

  const guardPath = path.join(__dirname, '../.github/ci-generation-release-guard.json');
  assert.ok(fs.existsSync(guardPath), 'PR #43 guard file must remain present');

  const productionPaths = PILOTS.map((p) => path.join(__dirname, '..', p.sourceRel));
  const beforeHashes = productionPaths.map((p) => fs.readFileSync(p, 'utf8'));

  process.env.SEADAYS_VERIFIED_CATALOG_PREVIEW = 'true';
  delete require.cache[require.resolve('./lib/catalogImage/verifiedCatalogPreviewConfig')];
  delete require.cache[require.resolve('./buildCatalogVerifiedPreviewPages')];
  const { writePilotOutputs } = require('./buildCatalogVerifiedPreviewPages');
  writePilotOutputs(true);
  writePilotOutputs(false);

  for (let i = 0; i < productionPaths.length; i++) {
    const after = fs.readFileSync(productionPaths[i], 'utf8');
    assert.strictEqual(after, beforeHashes[i], `production file must not change: ${productionPaths[i]}`);
  }

  const previewRoot = path.join(__dirname, '../qa-evidence/wikimedia-catalog-phase-d3b/preview-on');
  for (const pilot of PILOTS) {
    const html = fs.readFileSync(path.join(previewRoot, pilot.sourceRel), 'utf8');
    assert.ok(html.includes('class="catalog-verified-preview-banner"'), `${pilot.slug} banner`);
    assert.ok(html.includes('catalog-attribution'), `${pilot.slug} attribution`);
    assert.ok(html.includes('aspect-ratio: 3 / 2') || html.includes('catalog-preview-frame'), `${pilot.slug} frame`);
    if (pilot.kind === 'port') {
      assert.ok(html.includes('catalog-verified-terminal-block'), `${pilot.slug} terminal block`);
    }
    if (pilot.slug === 'miami-fl-united-states') {
      assert.ok(html.includes('Port of Miami by Don Ramey Logan.jpg'), `${pilot.slug} infra filename in attribution`);
    }
  }

  delete process.env.SEADAYS_VERIFIED_CATALOG_PREVIEW;

  if (process.exitCode) {
    console.error('test-catalog-verified-preview: FAIL');
    process.exit(1);
  }
  console.log('test-catalog-verified-preview: PASS');
}

main();

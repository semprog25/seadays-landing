#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const { validateCatalogImageRecordV1 } = require('./lib/catalogImage/validateCatalogImageRecord');
const { readCatalogImageKvValue } = require('./lib/catalogImage/readCatalogImageValue');
const {
  isMockCatalogPreviewEnabled,
  shouldSkipMockCatalogPreviewForEntityImage,
} = require('./lib/catalogImage/mockCatalogPreviewConfig');
const {
  PHASE_C_MOCK_RECORD_BY_SLUG,
  PHASE_C_PILOT_PORT_APP_TO_SLUG,
  PHASE_C_PILOT_SHIP_APP_TO_SLUG,
} = require('./lib/catalogImage/phaseCMockData');
const {
  resolveMockCatalogPreviewHero,
  resolveMockCatalogPreviewPortInfrastructure,
  readMockCatalogPreviewOutcome,
} = require('./lib/catalogImage/resolveMockCatalogPreview');
const { buildCatalogAttributionHtml } = require('./lib/catalogImage/buildCatalogPreviewFigure');
const { PILOTS } = require('./buildCatalogMockPreviewPages');

function main() {
  assert.strictEqual(isMockCatalogPreviewEnabled(), false, 'preview must default OFF');

  for (const slug of Object.values(PHASE_C_MOCK_RECORD_BY_SLUG)) {
    const v = validateCatalogImageRecordV1(slug, {
      expectedKind: slug.entity.kind,
      expectedCanonicalSlug: slug.entity.canonicalSlug,
    });
    assert.ok(v.ok, `record invalid: ${slug.entity.canonicalSlug}`);
  }

  for (const appId of Object.keys(PHASE_C_PILOT_SHIP_APP_TO_SLUG)) {
    const hero = resolveMockCatalogPreviewHero('ship', appId, { previewEnabled: true });
    assert.ok(hero, `ship hero ${appId}`);
    assert.ok(hero.displayUrl.startsWith('https://'));
    assert.ok(buildCatalogAttributionHtml(hero.payload).includes('Wikimedia Commons'));
  }

  for (const appId of Object.keys(PHASE_C_PILOT_PORT_APP_TO_SLUG)) {
    const hero = resolveMockCatalogPreviewHero('port', appId, { previewEnabled: true });
    const terminal = resolveMockCatalogPreviewPortInfrastructure(appId, { previewEnabled: true });
    assert.ok(hero, `port hero ${appId}`);
    assert.ok(terminal, `port terminal ${appId}`);
    assert.strictEqual(hero.portPreviewRole, 'destinationHero');
    assert.strictEqual(terminal.portPreviewRole, 'portInfrastructure');
    assert.notStrictEqual(hero.displayUrl, terminal.displayUrl);
  }

  assert.strictEqual(shouldSkipMockCatalogPreviewForEntityImage('https://example.com/x.jpg'), true);
  assert.strictEqual(
    resolveMockCatalogPreviewHero('ship', 'wonder-seas', {
      previewEnabled: true,
      entityImage: 'https://example.com/x.jpg',
    }),
    null,
  );

  const slug = PHASE_C_PILOT_SHIP_APP_TO_SLUG['wonder-seas'];
  const empty = {};
  assert.strictEqual(readMockCatalogPreviewOutcome('ship', slug, empty).kind, 'unavailable');

  const guardPath = path.join(__dirname, '../.github/ci-generation-release-guard.json');
  assert.ok(fs.existsSync(guardPath), 'PR #43 guard file must remain present');

  const productionPaths = PILOTS.map((p) => path.join(__dirname, '..', p.sourceRel));
  const beforeHashes = productionPaths.map((p) => fs.readFileSync(p, 'utf8'));

  process.env.SEADAYS_MOCK_CATALOG_PREVIEW = 'true';
  delete require.cache[require.resolve('./lib/catalogImage/mockCatalogPreviewConfig')];
  delete require.cache[require.resolve('./buildCatalogMockPreviewPages')];
  const { writePilotOutputs } = require('./buildCatalogMockPreviewPages');
  writePilotOutputs(true);

  for (let i = 0; i < productionPaths.length; i++) {
    const after = fs.readFileSync(productionPaths[i], 'utf8');
    assert.strictEqual(after, beforeHashes[i], `production file must not change: ${productionPaths[i]}`);
  }

  const previewRoot = path.join(__dirname, '../qa-evidence/wikimedia-catalog-phase-c2/preview-on');
  for (const pilot of PILOTS) {
    const html = fs.readFileSync(path.join(previewRoot, pilot.sourceRel), 'utf8');
    assert.ok(html.includes('class="catalog-mock-preview-banner"'), `${pilot.slug} banner element`);
    assert.ok(html.includes('aspect-ratio: 3 / 2') || html.includes('catalog-preview-frame'), `${pilot.slug} frame css`);
    assert.ok(html.includes('catalog-attribution'), `${pilot.slug} attribution`);
    if (pilot.kind === 'port') {
      assert.ok(html.includes('catalog-mock-terminal-block'), `${pilot.slug} terminal block`);
      assert.ok(html.includes('Destination hero (city / landmark photography)'), `${pilot.slug} destination role label`);
    }
  }
  const barcelonaHtml = fs.readFileSync(path.join(previewRoot, 'ports/barcelona-spain/index.html'), 'utf8');
  assert.ok(barcelonaHtml.includes('Barcelona_Skyline.jpg'), 'barcelona destination hero url');
  const miamiHtml = fs.readFileSync(path.join(previewRoot, 'ports/miami-fl-united-states/index.html'), 'utf8');
  assert.ok(miamiHtml.includes('Miami_Sunset'), 'miami destination hero url');

  delete process.env.SEADAYS_MOCK_CATALOG_PREVIEW;
  console.log('test-catalog-mock-preview: PASS');
}

main();

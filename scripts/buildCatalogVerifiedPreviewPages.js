#!/usr/bin/env node
'use strict';

/**
 * Builds local-only verified-catalogue pilot preview HTML under qa-evidence (never writes ships/ or ports/).
 * Set SEADAYS_VERIFIED_CATALOG_PREVIEW=true to emit preview-on; otherwise preview-off copies only.
 */

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { VERIFIED_CATALOG_TEST_ONLY_LABEL } = require('./lib/catalogImage/phaseD3BVerifiedFixtures');
const { isVerifiedCatalogPreviewEnabled } = require('./lib/catalogImage/verifiedCatalogPreviewConfig');
const {
  resolveVerifiedCatalogPreviewHero,
  resolveVerifiedCatalogPreviewPortInfrastructure,
} = require('./lib/catalogImage/resolveVerifiedCatalogPreview');
const {
  buildCatalogVerifiedBannerHtml,
  buildCatalogPreviewFigureHtml,
  CATALOG_PREVIEW_STYLE,
} = require('./lib/catalogImage/buildCatalogPreviewFigure');

const ROOT = path.join(__dirname, '..');
const EVIDENCE = path.join(ROOT, 'qa-evidence/wikimedia-catalog-phase-d3b');

const PILOTS = [
  { kind: 'ship', appId: 'wonder-seas', slug: 'wonder-of-the-seas', sourceRel: 'ships/wonder-of-the-seas/index.html' },
  { kind: 'ship', appId: 'cosma', slug: 'aidacosma', sourceRel: 'ships/aidacosma/index.html' },
  { kind: 'ship', appId: 'symphony-seas', slug: 'symphony-of-the-seas', sourceRel: 'ships/symphony-of-the-seas/index.html' },
  { kind: 'port', appId: 'hamburg', slug: 'hamburg-germany', sourceRel: 'ports/hamburg-germany/index.html' },
  { kind: 'port', appId: 'barcelona', slug: 'barcelona-spain', sourceRel: 'ports/barcelona-spain/index.html' },
  { kind: 'port', appId: 'miami', slug: 'miami-fl-united-states', sourceRel: 'ports/miami-fl-united-states/index.html' },
];

function sha256(text) {
  return crypto.createHash('sha256').update(text, 'utf8').digest('hex');
}

function injectPreviewStyle(html) {
  if (html.includes('.catalog-preview-frame {')) return html;
  const marker = '</style>';
  const idx = html.indexOf(marker);
  if (idx === -1) {
    return html.replace('</head>', `<style>${CATALOG_PREVIEW_STYLE}</style></head>`);
  }
  return html.slice(0, idx) + CATALOG_PREVIEW_STYLE + html.slice(idx);
}

function replacePortHero(html, heroFigure) {
  const licensedHero = /<figure class="seo-hero">[\s\S]*?<\/figure>/;
  if (licensedHero.test(html)) {
    return html.replace(licensedHero, heroFigure);
  }
  const afterLead = /(<p class="lead">[\s\S]*?<\/p>)/;
  if (afterLead.test(html)) {
    return html.replace(afterLead, `$1\n${heroFigure}`);
  }
  return html.replace(
    /(<nav class="(?:seo-breadcrumbs|pg-breadcrumbs)"[^>]*>[\s\S]*?<\/nav>)/,
    `$1\n${heroFigure}`,
  );
}

function injectShipHero(html, heroFigure) {
  if (/<figure class="seo-hero catalog-mock-figure">/.test(html)) return html;
  return html.replace(
    /(<nav class="seo-breadcrumbs"[^>]*>[\s\S]*?<\/nav>)/,
    `$1\n${heroFigure}`,
  );
}

function injectPortTerminalBlock(html, terminalFigure) {
  const block =
    `<div class="catalog-verified-terminal-block" id="catalog-verified-terminal-preview">` +
    `<h3>Cruise port &amp; terminal (verified catalogue fixture preview)</h3>` +
    terminalFigure +
    `</div>`;
  const marker = '<section class="pg-section" id="getting-there">';
  if (!html.includes(marker)) return html;
  return html.replace(marker, `${block}\n${marker}`);
}

function injectVerifiedBanner(html) {
  const banner = buildCatalogVerifiedBannerHtml(VERIFIED_CATALOG_TEST_ONLY_LABEL);
  if (html.includes('class="catalog-verified-preview-banner"')) return html;
  return html.replace(/(<main class="seo-detail[^"]*">)/, `$1\n${banner}`);
}

function buildPreviewHtml(sourceHtml, pilot, previewEnabled) {
  if (!previewEnabled) return sourceHtml;

  let html = injectPreviewStyle(sourceHtml);
  html = injectVerifiedBanner(html);

  const hero = resolveVerifiedCatalogPreviewHero(pilot.kind, pilot.appId, {
    previewEnabled: true,
    surface: 'detailHero',
  });
  assert.ok(hero, `missing verified hero for ${pilot.slug}`);

  const heroFigure = buildCatalogPreviewFigureHtml(hero, {
    roleLabel:
      pilot.kind === 'port' ? 'Destination hero (city / landmark photography)' : 'Ship detail hero (verified catalogue fixture preview)',
  });

  html = pilot.kind === 'port' ? replacePortHero(html, heroFigure) : injectShipHero(html, heroFigure);

  if (pilot.kind === 'port') {
    const terminal = resolveVerifiedCatalogPreviewPortInfrastructure(pilot.appId, { previewEnabled: true });
    assert.ok(terminal, `missing verified terminal image for ${pilot.slug}`);
    const terminalFigure = buildCatalogPreviewFigureHtml(terminal, {
      roleLabel: 'Port infrastructure (cruise terminal / berths)',
    });
    html = injectPortTerminalBlock(html, terminalFigure);
  }

  return html;
}

function writePilotOutputs(previewEnabled) {
  const outRoot = path.join(EVIDENCE, previewEnabled ? 'preview-on' : 'preview-off');
  const manifest = [];

  for (const pilot of PILOTS) {
    const sourcePath = path.join(ROOT, pilot.sourceRel);
    const sourceHtml = fs.readFileSync(sourcePath, 'utf8');
    const productionHash = sha256(sourceHtml);
    const outHtml = buildPreviewHtml(sourceHtml, pilot, previewEnabled);
    const outPath = path.join(outRoot, pilot.sourceRel);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, outHtml, 'utf8');

    manifest.push({
      slug: pilot.slug,
      kind: pilot.kind,
      sourceRel: pilot.sourceRel,
      previewEnabled,
      productionSha256: productionHash,
      outputSha256: sha256(outHtml),
      unchangedFromProduction: productionHash === sha256(outHtml),
    });
  }

  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(
    path.join(EVIDENCE, previewEnabled ? 'preview-on-manifest.json' : 'preview-off-manifest.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), previewEnabled, pilots: manifest }, null, 2),
    'utf8',
  );

  return manifest;
}

function main() {
  const previewEnabled = isVerifiedCatalogPreviewEnabled();
  const offManifest = writePilotOutputs(false);
  const onManifest = previewEnabled ? writePilotOutputs(true) : null;

  for (const row of offManifest) {
    assert.strictEqual(row.unchangedFromProduction, true, `${row.sourceRel} must match production when preview off`);
  }

  if (previewEnabled) {
    for (const row of onManifest) {
      assert.strictEqual(row.unchangedFromProduction, false, `${row.sourceRel} must differ when preview on`);
    }
  }

  console.log(
    JSON.stringify({
      previewEnabled,
      evidenceDir: EVIDENCE,
      previewOff: offManifest.length,
      previewOn: onManifest ? onManifest.length : 0,
    }),
  );
}

if (require.main === module) {
  main();
}

module.exports = { PILOTS, buildPreviewHtml, writePilotOutputs };

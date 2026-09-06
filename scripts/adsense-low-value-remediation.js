#!/usr/bin/env node
'use strict';

/**
 * AdSense low-value remediation (no full CMS regenerate required):
 * - noindex thin/template ship detail pages below editorial quality bar
 * - leave enriched ship pages indexable
 * - noindex press kit (brand assets, not publisher content)
 * - rebuild sitemap excluding noindex pages
 *
 * Usage: node scripts/adsense-low-value-remediation.js
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  isShipDetailIndexable,
  replaceRobotsMeta,
} = require('./lib/adsenseIndexability');

const repoRoot = path.join(__dirname, '..');

function applyShipIndexability() {
  const overrides = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data/landing-cruise-content-overrides.json'), 'utf8')
  );
  const ships = overrides.ships || {};
  const shipsDir = path.join(repoRoot, 'ships');
  let indexed = 0;
  let noindexed = 0;
  let skipped = 0;

  for (const entry of fs.readdirSync(shipsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const slug = entry.name;
    const htmlPath = path.join(shipsDir, slug, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    let html = fs.readFileSync(htmlPath, 'utf8');
    if (/noindex/i.test(html) && /refresh|window\.location\.replace/i.test(html)) {
      skipped += 1;
      continue;
    }
    const ov = ships[slug] || {};
    const ship = {
      slug,
      description: ov.description || '',
      confidenceScore: ov.confidenceScore,
      hasContentOverride: Boolean(ov.description),
    };
    const indexable = isShipDetailIndexable(ship);
    const robots = indexable ? 'index, follow' : 'noindex, follow';
    const next = replaceRobotsMeta(html, robots);
    if (next !== html) fs.writeFileSync(htmlPath, next, 'utf8');
    if (indexable) indexed += 1;
    else noindexed += 1;
  }

  return { indexed, noindexed, skipped };
}

function noindexPressKit() {
  const pressPath = path.join(repoRoot, 'press/index.html');
  if (!fs.existsSync(pressPath)) return false;
  const html = fs.readFileSync(pressPath, 'utf8');
  const next = replaceRobotsMeta(html, 'noindex, follow');
  if (next !== html) fs.writeFileSync(pressPath, next, 'utf8');
  return true;
}

const ships = applyShipIndexability();
const press = noindexPressKit();
console.log('[adsense-remediation] ships indexed:', ships.indexed, 'noindexed:', ships.noindexed, 'skipped:', ships.skipped);
console.log('[adsense-remediation] press noindex applied:', press);

const feature = spawnSync(process.execPath, [path.join(__dirname, 'buildFeatureLandingPages.js')], {
  cwd: repoRoot,
  stdio: 'inherit',
});
if (feature.status !== 0) process.exit(feature.status || 1);

const sitemap = spawnSync(process.execPath, [path.join(__dirname, 'generateBlogs.js'), '--sitemap-only'], {
  cwd: repoRoot,
  stdio: 'inherit',
  env: process.env,
});
if (sitemap.status !== 0) process.exit(sitemap.status || 1);
console.log('[adsense-remediation] done');

#!/usr/bin/env node
'use strict';

/**
 * Apply PR57 port-guide output changes onto committed port HTML without full regen.
 * Preserves robots, canonicals, Viator blocks, and other published head/body chrome.
 */

const fs = require('fs');
const path = require('path');
const { PORT_GUIDE_STYLES, buildTerminalsSection } = require('./lib/portGuideSections');
const { buildSlugToAppPortIdMap } = require('./lib/publicPortGuideAdapter');
const { cleanPortCopy } = require('./lib/portCopyHygiene');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');

const repoRoot = path.join(__dirname, '..');

const WIDE_GRID_OLD =
  /(\s+\.seo-detail-wide \.pg-facts,\s*\n\s*\.seo-detail-wide \.pg-quick,\s*\n\s*)\.seo-detail-wide \.pg-terminal-grid,\s*\n\s*\.seo-detail-wide \.pg-qa-grid \{ grid-template-columns: repeat\(auto-fit, minmax\(240px, 1fr\)\); \}/;

const WIDE_GRID_NEW = `$1.seo-detail-wide .pg-qa-grid { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
  .seo-detail-wide .pg-terminal-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: stretch; }`;

const PORT_JUMP_OLD =
  /\.port-jump \{ position: sticky; top: 58px; z-index: 4; display: flex; gap: 14px; overflow-x: auto; margin: 0 0 18px; padding: 8px 0; background: rgba\(10,10,10,0\.94\); \}/;

const PORT_JUMP_NEW = `.port-jump { display: flex; gap: 14px; overflow-x: auto; -webkit-overflow-scrolling: touch; margin: 0 0 18px; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }`;

const GETTING_THERE_RE = /<section class="pg-section" id="getting-there"[\s\S]*?<\/section>/i;

function loadGuides() {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8'));
  } catch {
    return { byAppPortId: {} };
  }
}

function loadTerminals() {
  try {
    return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'public-port-terminals.json'), 'utf8'));
  } catch {
    return { byPortId: {} };
  }
}

function extractPortGuideStylesBlock() {
  const start = PORT_GUIDE_STYLES.indexOf('.pg-terminal-grid');
  const end = PORT_GUIDE_STYLES.indexOf('.pg-quick {');
  if (start < 0 || end < 0) throw new Error('PORT_GUIDE_STYLES terminal block not found');
  return PORT_GUIDE_STYLES.slice(start, end).trim();
}

function patchPortGuideTerminalCss(html) {
  let out = html;
  if (WIDE_GRID_OLD.test(out)) out = out.replace(WIDE_GRID_OLD, WIDE_GRID_NEW);
  const anchor = '.pg-terminal-grid, .pg-qa-grid {';
  const idx = out.indexOf(anchor);
  const endIdx = idx >= 0 ? out.indexOf('.pg-quick {', idx) : -1;
  if (idx >= 0 && endIdx > idx) {
    out = `${out.slice(0, idx)}${extractPortGuideStylesBlock()}\n${out.slice(endIdx)}`;
  } else if (PORT_JUMP_OLD.test(out)) {
    out = out.replace(PORT_JUMP_OLD, PORT_JUMP_NEW);
  }
  out = out.replace(
    /\.pg-section \{ margin: 40px 0 28px; \}/,
    '.pg-section { margin: 40px 0 28px; scroll-margin-top: 72px; }'
  );
  return out;
}

function extractGettingThereLogistics(html) {
  const section = html.match(GETTING_THERE_RE);
  if (!section) return '';
  const m = section[0].match(/<p class="pg-prose">([\s\S]*?)<\/p>/);
  return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
}

function patchGettingThereSection(html, terminals, opts) {
  if (!terminals.length) return html;
  if (!GETTING_THERE_RE.test(html)) return html;
  const logistics = extractGettingThereLogistics(html);
  const gate = (s) => cleanPortCopy(s);
  const newSection = buildTerminalsSection(terminals, {
    logistics,
    portAppId: opts.portAppId,
    gate,
  });
  if (!newSection) return html;
  return html.replace(GETTING_THERE_RE, newSection);
}

function main() {
  const appRoot = getAppRepoRoot(repoRoot);
  const guides = loadGuides();
  const terminals = loadTerminals();
  const seoPorts = buildSeoPortRecords(APP_ALL_PORTS, repoRoot);
  const portSlugToReviewKey = buildPortSlugToReviewKeyMap(appRoot);
  const slugToAppPortId = buildSlugToAppPortIdMap(seoPorts, portSlugToReviewKey, guides.byAppPortId || {});

  let cssPatched = 0;
  let terminalsPatched = 0;
  let skipped = 0;

  for (const ent of fs.readdirSync(path.join(repoRoot, 'ports'), { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(repoRoot, 'ports', ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const before = fs.readFileSync(file, 'utf8');
    if (!isPublishedPortPage(before)) {
      skipped += 1;
      continue;
    }
    const appPortId = slugToAppPortId[ent.name] || '';
    const portTerminals = (appPortId && terminals.byPortId && terminals.byPortId[appPortId]) || [];
    let html = patchPortGuideTerminalCss(before);
    if (portTerminals.length) {
      html = patchGettingThereSection(html, portTerminals, { portAppId: appPortId });
      if (html !== before) terminalsPatched += 1;
    }
    if (html !== before) {
      fs.writeFileSync(file, html, 'utf8');
      cssPatched += 1;
    }
  }

  console.log(
    `[patch-port-guide-pr57] css/terminal updates on ${cssPatched} pages, terminals rebuilt on ${terminalsPatched}, skipped ${skipped}`
  );
}

function isPublishedPortPage(html) {
  return (
    html.includes('class="seo-detail') &&
    /<h1>/.test(html) &&
    !/http-equiv=["']refresh/i.test(html)
  );
}

if (require.main === module) main();

module.exports = {
  patchPortGuideTerminalCss,
  patchGettingThereSection,
  isPublishedPortPage,
};

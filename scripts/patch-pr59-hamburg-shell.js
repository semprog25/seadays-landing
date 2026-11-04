#!/usr/bin/env node
'use strict';

/**
 * Apply PR59 Things-to-do visual + terminal CSS onto production-shell Hamburg HTML.
 * Starts from origin/main page chrome (analytics, footer guard, Save CTA path).
 * Does not touch other ports.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { PORT_GUIDE_STYLES, buildThingsToDoSection } = require('./lib/portGuideSections');
const {
  patchPortGuideTerminalCss,
  patchGettingThereSection,
} = require('./patch-port-guide-pr57-published');
const { rewriteHtml } = require('./rewrite-download-ctas');
const { buildSlugToAppPortIdMap } = require('./lib/publicPortGuideAdapter');
const { buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { allPorts: APP_ALL_PORTS } = require('./lib/appCruiseDataset');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');

const repoRoot = path.join(__dirname, '..');
const SLUG = 'hamburg-germany';
const file = path.join(repoRoot, 'ports', SLUG, 'index.html');
const THINGS_RE = /<section class="pg-section" id="things-to-do"[\s\S]*?<\/section>/i;

function loadGuides() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8'));
}

function loadTerminals() {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'public-port-terminals.json'), 'utf8'));
}

function extractPr59VisualCss() {
  const start = PORT_GUIDE_STYLES.indexOf('.pg-things-layout');
  const end = PORT_GUIDE_STYLES.indexOf('.pg-facts {', start);
  if (start < 0 || end < 0) throw new Error('PR59 CSS slice missing in PORT_GUIDE_STYLES');
  return PORT_GUIDE_STYLES.slice(start, end).trim();
}

function injectRelatedPortsEditorialCss(html) {
  if (html.includes('#related-ports .seo-cross-list a { color: #79D8FF')) return html;
  const block = `#related-ports.seo-cross-block { margin-top: 32px; }
#related-ports .seo-cross-list a { color: #79D8FF; font-weight: 650; text-decoration: underline; text-decoration-color: rgba(121,216,255,0.45); text-underline-offset: 3px; }
#related-ports .seo-cross-list a:hover { color: #a8e8ff; text-decoration-color: rgba(168,232,255,0.75); }
#related-ports .seo-cross-list a:focus-visible { outline: 2px solid #79D8FF; outline-offset: 3px; border-radius: 4px; }
`;
  const anchor = '.seo-hero-img {';
  const idx = html.indexOf(anchor);
  if (idx < 0) throw new Error('seo-hero-img style anchor missing');
  return `${html.slice(0, idx)}${block}${html.slice(idx)}`;
}

function injectPr59VisualCss(html) {
  const block = extractPr59VisualCss();
  if (html.includes('.pg-things-layout')) {
    return html;
  }
  const anchor = '.pg-terminal-card-photo figcaption a';
  const idx = html.indexOf(anchor);
  if (idx < 0) throw new Error('terminal figcaption anchor not found in Hamburg styles');
  const lineEnd = html.indexOf('\n', idx);
  return `${html.slice(0, lineEnd + 1)}\n${block}\n${html.slice(lineEnd + 1)}`;
}

function assertShellMarkers(html) {
  const required = [
    'google-adsense-account',
    'gtag(',
    'seadays-contextual-cta',
    'safeImage',
    'seadays-web-phamburg',
    'noindex, follow',
    'application/ld+json',
  ];
  for (const needle of required) {
    if (!html.includes(needle)) throw new Error(`shell marker missing after patch: ${needle}`);
  }
  if (/\.port-jump \{[^}]*position:\s*sticky/s.test(html)) {
    throw new Error('sticky port-jump regressed');
  }
  const termSection = html.match(/<section class="pg-section" id="getting-there"[\s\S]*?<\/section>/i);
  const termHtml = termSection ? termSection[0] : '';
  const photos = (termHtml.match(/class="[^"]*pg-terminal-card--has-photo/g) || []).length;
  if (photos !== 4) throw new Error(`expected 4 terminal photos, got ${photos}`);
}

function main() {
  let html = execSync(`git show origin/main:ports/${SLUG}/index.html`, {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  const guides = loadGuides();
  const guide = guides.byAppPortId && guides.byAppPortId.hamburg;
  if (!guide) throw new Error('hamburg guide missing');
  const thingsSection = buildThingsToDoSection(guide);
  if (!thingsSection || !THINGS_RE.test(html)) throw new Error('things-to-do section build/replace failed');
  html = html.replace(THINGS_RE, thingsSection);

  html = patchPortGuideTerminalCss(html);
  html = injectPr59VisualCss(html);
  html = injectRelatedPortsEditorialCss(html);

  const appRoot = getAppRepoRoot(repoRoot);
  const terminals = loadTerminals();
  const seoPorts = buildSeoPortRecords(APP_ALL_PORTS, repoRoot);
  const portSlugToReviewKey = buildPortSlugToReviewKeyMap(appRoot);
  const slugToAppPortId = buildSlugToAppPortIdMap(seoPorts, portSlugToReviewKey, guides.byAppPortId || {});
  const appPortId = slugToAppPortId[SLUG] || 'hamburg';
  const portTerminals = (terminals.byPortId && terminals.byPortId[appPortId]) || [];
  html = patchGettingThereSection(html, portTerminals, { portAppId: appPortId });

  html = rewriteHtml(html, `ports/${SLUG}/index.html`);
  assertShellMarkers(html);
  fs.writeFileSync(file, html, 'utf8');
  console.log(`[patch-pr59-hamburg-shell] wrote ${path.relative(repoRoot, file)} with production shell + PR59 visuals`);
}

if (require.main === module) main();

module.exports = { main };

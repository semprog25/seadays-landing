#!/usr/bin/env node
'use strict';

/**
 * Surgical ship guide hero binding from local-verified-records (image fields only).
 */

const fs = require('fs');
const path = require('path');
const { loadVerifiedShipHeroBySlug, shipImageUrlLooksGeneric } = require('./lib/portsDirectoryImageResolve');
const { buildLicensedHero } = require('./lib/seoShipPortPages');

const REPO = path.join(__dirname, '..');

function escapeRegex(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function patchShipGuideHtml(slug, html, guide) {
  const url = guide.url;
  if (html.includes(url)) {
    const hasFigure = html.includes('<figure class="seo-hero">') && html.includes(url);
    const noPlanner =
      !html.includes('Websitehomebucket/Cruise%20planner.jpg') ||
      !/<img class="seo-visual-img"[^>]+Cruise%20planner/.test(html);
    if (hasFigure && noPlanner) return { html, changed: false, reason: 'already_bound' };
  }

  let next = html;
  next = next.replace(
    /<meta property="og:image" content="[^"]*">/,
    `<meta property="og:image" content="${url}">`
  );
  next = next.replace(
    /<meta property="twitter:image" content="[^"]*">/,
    `<meta property="twitter:image" content="${url}">`
  );

  const licensed = buildLicensedHero({ hero: guide }, `${slug} cruise ship`);
  if (!licensed.html) throw new Error(`no licensed hero html for ${slug}`);

  if (next.includes('<figure class="seo-hero">')) {
    next = next.replace(/<figure class="seo-hero">[\s\S]*?<\/figure>\s*/, licensed.html);
  } else {
    next = next.replace(
      /(<nav class="seo-breadcrumbs"[\s\S]*?<\/nav>\s*)/,
      `$1${licensed.html}\n      `
    );
  }

  next = next.replace(
    /<img class="seo-visual-img"[\s\S]*?onerror="[^"]*">/,
    '<div class="seo-visual-art"><span></span><span></span><span></span></div>'
  );

  return { html: next, changed: next !== html, reason: 'patched' };
}

function main() {
  const verified = loadVerifiedShipHeroBySlug(REPO);
  const slugs = Object.keys(verified).sort();
  let changed = 0;
  let skipped = 0;
  const changedSlugs = [];

  for (const slug of slugs) {
    const entry = verified[slug];
    const guide = entry?.guide;
    if (!guide?.url) continue;
    const filePath = path.join(REPO, 'ships', slug, 'index.html');
    if (!fs.existsSync(filePath)) continue;
    const before = fs.readFileSync(filePath, 'utf8');
  if (!shipImageUrlLooksGeneric(before.match(/<figure class="seo-hero">[\s\S]*?<\/figure>/)?.[0] || '') && before.includes('<figure class="seo-hero">') && before.includes(guide.url)) {
      skipped += 1;
      continue;
    }
    const result = patchShipGuideHtml(slug, before, guide);
    if (result.changed) {
      fs.writeFileSync(filePath, result.html, 'utf8');
      changed += 1;
      changedSlugs.push(slug);
    } else {
      skipped += 1;
    }
  }

  const manifestPath = path.join(REPO, 'qa-evidence/ship-detail-hero-20261125/changed-slugs.json');
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(
    manifestPath,
    JSON.stringify({ correctedSlugs: changedSlugs, correctedCount: changed, skipped, verifiedHarvest: slugs.length }, null, 2) + '\n',
    'utf8'
  );
  console.log('OK apply-ship-detail-verified-hero-publication', { corrected: changed, skipped, verified: slugs.length });
}

main();
#!/usr/bin/env node
'use strict';

/**
 * Read-only estimate: which port/ship pages would flip to index after apply-publish-gate
 * with current HTML on disk. Does not write files.
 */

const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('./lib/publishGate');
const { isPortSeoRedirectSlug } = require('./lib/portSeoRedirects');
const {
  loadOverrides,
  loadGuidesByAppPortId,
  shipEligibleForIndexRestore,
  portEligibleForIndexRestore,
} = require('./lib/publishGateRestoreEligibility');

const repoRoot = path.join(__dirname, '..');

function listPages(kind) {
  const dir = path.join(repoRoot, kind === 'ship' ? 'ships' : 'ports');
  const pages = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    pages.push({
      file,
      slug: ent.name,
      kind,
      html: fs.readFileSync(file, 'utf8'),
    });
  }
  return pages;
}

function isNoindex(html) {
  return /<meta\s+name=["']robots["']\s+content=["'][^"']*noindex/i.test(String(html || '').slice(0, 4000));
}

function main() {
  const shipOverrides = loadOverrides(repoRoot, 'ships');
  const portOverrides = loadOverrides(repoRoot, 'ports');
  const guidesById = loadGuidesByAppPortId(repoRoot);
  const pages = [...listPages('port'), ...listPages('ship')];
  const results = evaluatePublishGate(pages);
  const byFile = new Map(results.map((row) => [row.file, row]));
  const wouldRestore = [];
  const stillNoindex = [];

  for (const page of pages) {
    const row = byFile.get(page.file);
    const fail = row && row.issues.length > 0;
    const refresh = /http-equiv=["']refresh/i.test(page.html.slice(0, 2500));
    const noindex = isNoindex(page.html);
    let restore = false;
    if (!fail && noindex && !refresh) {
      if (
        page.kind === 'port' &&
        !isPortSeoRedirectSlug(page.slug) &&
        portEligibleForIndexRestore(page.slug, page.html, repoRoot, guidesById, portOverrides)
      ) {
        restore = true;
      } else if (page.kind === 'ship' && shipEligibleForIndexRestore(page.slug, shipOverrides)) {
        restore = true;
      }
    }
    const url = `https://seadays.app/${page.kind === 'ship' ? 'ships' : 'ports'}/${page.slug}/`;
    if (restore) wouldRestore.push({ url, kind: page.kind, slug: page.slug, issues: row.issues });
    else if (noindex) stillNoindex.push({ url, kind: page.kind, slug: page.slug, issues: row.issues });
  }

  const sample = (slug) => wouldRestore.find((r) => r.slug === slug) || stillNoindex.find((r) => r.slug === slug);

  console.log(
    JSON.stringify(
      {
        wouldRestoreCount: wouldRestore.length,
        stillNoindexCount: stillNoindex.length,
        samples: {
          barcelona: sample('barcelona-spain'),
          miami: sample('miami-fl-united-states'),
          marigot: sample('marigot-st-maarten'),
          carnivalBreeze: sample('carnival-breeze'),
          acapulco: sample('acapulco-mexico'),
          charcot: sample('le-commandant-charcot'),
          skyPrincess: sample('sky-princess'),
        },
        sitemapImpactEstimate:
          'After approved CI apply-publish-gate (or full channel), sitemap would gain up to wouldRestoreCount port+ship detail URLs currently omitted by filterSitemapXml; blog count unchanged.',
      },
      null,
      2
    )
  );
}

main();

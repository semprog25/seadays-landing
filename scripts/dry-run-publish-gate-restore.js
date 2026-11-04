#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('./lib/publishGate');
const { replaceRobotsMeta } = require('./lib/adsenseIndexability');
const { isPortSeoRedirectSlug } = require('./lib/portSeoRedirects');
const { buildRestoreContext, mayRestorePageToIndex } = require('./lib/publishGateRestoreEligibility');
const { isRestoreApplyEnabled } = require('./lib/publishGateIndexRestoreManifest');

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
  const ctx = buildRestoreContext(repoRoot);
  const pages = [...listPages('port'), ...listPages('ship')];
  const results = evaluatePublishGate(pages);
  const byFile = new Map(results.map((row) => [row.file, row]));
  let wouldRestore = 0;

  for (const page of pages) {
    const row = byFile.get(page.file);
    const gateIssues = row ? row.issues : ['missing'];
    if (
      isNoindex(page.html) &&
      mayRestorePageToIndex(page, { ...ctx, gateIssues, html: page.html })
    ) {
      wouldRestore += 1;
    }
  }

  console.log(
    JSON.stringify(
      {
        restoreApplyEnabled: isRestoreApplyEnabled(),
        approvedManifestPresent: Boolean(ctx.manifest),
        wouldRestoreCount: wouldRestore,
        scheduledBlogsChannelSafe: !isRestoreApplyEnabled() || !ctx.manifest,
      },
      null,
      2
    )
  );
}

main();

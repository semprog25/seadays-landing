#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { getPreservedPortDirectorySlugs, isPortSeoRedirectSlug } = require('./lib/portSeoRedirects');

function listIndexDirs(absDir) {
  if (!fs.existsSync(absDir)) return [];
  return fs.readdirSync(absDir).filter((name) => {
    const full = path.join(absDir, name);
    try {
      return fs.statSync(full).isDirectory() && fs.existsSync(path.join(full, 'index.html'));
    } catch {
      return false;
    }
  });
}

async function main() {
  const repoRoot = path.join(__dirname, '..');
  const ds = await import(pathToFileURL(path.join(__dirname, 'lib/appCruiseDataset.js')).href);
  const allPorts = Array.isArray(ds.allPorts) ? ds.allPorts : [];
  const allShips = Array.isArray(ds.allShips) ? ds.allShips : [];
  const portSlugs = allPorts.map((p) => String(p.slug || '').trim()).filter(Boolean);
  const shipSlugs = allShips
    .filter((s) => !s.status || s.status === 'active')
    .map((s) => String(s.slug || '').trim())
    .filter(Boolean);

  const portDirs = listIndexDirs(path.join(repoRoot, 'ports'));
  const shipDirs = listIndexDirs(path.join(repoRoot, 'ships'));
  const blogDirs = listIndexDirs(path.join(repoRoot, 'blog'));
  const preserved = [...getPreservedPortDirectorySlugs()];

  if (portSlugs.length !== 412) {
    throw new Error(`Expected 412 canonical ports in appCruiseDataset, got ${portSlugs.length}`);
  }

  const missingPorts = portSlugs.filter(
    (slug) => !isPortSeoRedirectSlug(slug) && !portDirs.includes(slug)
  );
  if (missingPorts.length) {
    throw new Error(`Missing generated port pages: ${missingPorts.slice(0, 20).join(', ')}`);
  }

  const missingShips = shipSlugs.filter((slug) => !shipDirs.includes(slug));
  if (missingShips.length) {
    throw new Error(`Missing generated ship pages: ${missingShips.slice(0, 20).join(', ')}`);
  }

  for (const slug of preserved) {
    if (!portDirs.includes(slug)) {
      throw new Error(`Preserved redirect missing: ports/${slug}/`);
    }
  }

  if (blogDirs.length < 100) {
    throw new Error(`Expected a full blog catalogue on disk, found ${blogDirs.length} article folders`);
  }

  console.log(
    `inventory OK: datasetPorts=${portSlugs.length} portDirs=${portDirs.length} ` +
      `activeShips=${shipSlugs.length} shipDirs=${shipDirs.length} blogDirs=${blogDirs.length}`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

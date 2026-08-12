#!/usr/bin/env node
'use strict';

/**
 * Smoke test: port SEO redirects survive orphan cleanup + rewrite.
 * Run: node scripts/test-port-seo-redirects.js
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  PORT_ALIAS_REDIRECTS,
  PORT_STANDALONE_REDIRECTS,
  writePortSeoRedirectPages,
  getPreservedPortDirectorySlugs,
  isPortSeoRedirectSlug,
} = require('./lib/portSeoRedirects');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function removeOrphanPorts(repoRoot, seoPortSlugs) {
  const allowed = new Set(seoPortSlugs);
  for (const slug of getPreservedPortDirectorySlugs()) allowed.add(slug);
  const base = path.join(repoRoot, 'ports');
  for (const name of fs.readdirSync(base)) {
    const full = path.join(base, name);
    if (!fs.statSync(full).isDirectory()) continue;
    if (!allowed.has(name)) fs.rmSync(full, { recursive: true, force: true });
  }
}

function main() {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-port-seo-'));
  const portsRoot = path.join(tmp, 'ports');
  fs.mkdirSync(portsRoot);

  // Fake canonical pages
  for (const slug of ['koper-slovenia', 'chennai-india', 'kochi-india', 'doha-qatar']) {
    fs.mkdirSync(path.join(portsRoot, slug));
    fs.writeFileSync(path.join(portsRoot, slug, 'index.html'), '<html>full</html>');
  }
  // Stale orphan that SHOULD be deleted
  fs.mkdirSync(path.join(portsRoot, 'stale-orphan-port'));
  fs.writeFileSync(path.join(portsRoot, 'stale-orphan-port', 'index.html'), 'x');

  const seoPorts = [
    { slug: 'koper-slovenia', name: 'Koper, Slovenia' },
    { slug: 'chennai-india', name: 'Chennai, India' },
    { slug: 'chennai-port-india', name: 'Chennai Port, India' },
    { slug: 'kochi-india', name: 'Kochi, India' },
    { slug: 'cochin-india', name: 'Cochin, India' },
    { slug: 'cochin-port-india', name: 'Cochin Port, India' },
    { slug: 'mumbai-india', name: 'Mumbai, India' },
    { slug: 'mumbai-port-india', name: 'Mumbai Port, India' },
    { slug: 'visakhapatnam-india', name: 'Visakhapatnam, India' },
    { slug: 'vizag-india', name: 'Vizag, India' },
    { slug: 'doha-qatar', name: 'Doha, Qatar' },
    { slug: 'doha-port-qatar', name: 'Doha Port, Qatar' },
  ];

  writePortSeoRedirectPages(tmp, seoPorts);
  removeOrphanPorts(
    tmp,
    seoPorts.map((p) => p.slug)
  );
  // Critical: rewrite AFTER orphan cleanup (mirrors generateBlogs order)
  writePortSeoRedirectPages(tmp, seoPorts);

  assert(fs.existsSync(path.join(portsRoot, 'koper-croatia', 'index.html')), 'koper-croatia survives');
  assert(!fs.existsSync(path.join(portsRoot, 'stale-orphan-port')), 'true orphans still removed');

  const koperHtml = fs.readFileSync(path.join(portsRoot, 'koper-croatia', 'index.html'), 'utf8');
  assert(/noindex,follow/.test(koperHtml), 'koper noindex');
  assert(/ports\/koper-slovenia\//.test(koperHtml), 'koper canonical target');
  assert(/location\.replace\("\/ports\/koper-slovenia\/"\)/.test(koperHtml), 'koper JS redirect');

  for (const [alias, target] of Object.entries(PORT_ALIAS_REDIRECTS)) {
    const html = fs.readFileSync(path.join(portsRoot, alias, 'index.html'), 'utf8');
    assert(/noindex,follow/.test(html), `${alias} noindex`);
    assert(html.includes(`/ports/${target}/`), `${alias} → ${target}`);
    assert(isPortSeoRedirectSlug(alias), `${alias} flagged as redirect slug`);
  }

  assert(Object.keys(PORT_STANDALONE_REDIRECTS).length === 1, 'exactly one standalone redirect');
  assert(Object.keys(PORT_ALIAS_REDIRECTS).length === 6, 'exactly six alias redirects');

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('OK port SEO redirects survive orphan cleanup');
}

main();

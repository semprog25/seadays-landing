#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { evaluatePublishGate } = require('./lib/publishGate');
const { AUDIT_PORT_NOINDEX, AUDIT_SHIP_HIDE_OVERVIEW } = require('./lib/auditHoldback');

const root = path.join(__dirname, '..');

function readPages(kind) {
  const dir = path.join(root, kind === 'ship' ? 'ships' : 'ports');
  const pages = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(dir, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    pages.push({ file, slug: ent.name, kind, html: fs.readFileSync(file, 'utf8') });
  }
  return pages;
}

function robots(html) {
  const m = String(html || '').slice(0, 4000).match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  return m ? m[1].toLowerCase() : '';
}

function main() {
  const pages = [...readPages('port'), ...readPages('ship')];
  const results = evaluatePublishGate(pages);
  const bySlug = new Map(results.map((row) => [`${row.kind}:${row.slug}`, row]));
  const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const locs = new Set([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));

  let indexedPorts = 0;
  let indexedShips = 0;
  let failing = 0;
  const indexedFailures = [];

  for (const page of pages) {
    const row = bySlug.get(`${page.kind}:${page.slug}`);
    const indexable = robots(page.html).startsWith('index');
    const url = `https://seadays.app/${page.kind === 'ship' ? 'ships' : 'ports'}/${page.slug}/`;
    if (row.issues.length) failing += 1;
    if (indexable) {
      if (page.kind === 'port') indexedPorts += 1;
      else indexedShips += 1;
      // Structural gate checks assume Phase 1 port markup. Pre-Phase-1 pages
      // stay indexed until that rewrite; audit-list pages are noindexed above.
      const phase1Port = page.kind === 'port' && /<details class="pg-terminal-card"/.test(page.html);
      if ((page.kind === 'ship' || phase1Port) && row.issues.length) {
        indexedFailures.push(`${page.slug}: ${row.issues.join(', ')}`);
      }
    } else if (locs.has(url)) {
      indexedFailures.push(`${url} is noindex but still in the sitemap`);
    }
  }

  assert.deepStrictEqual(indexedFailures.slice(0, 12), [], indexedFailures.slice(0, 8).join('\n'));

  const hamburg = pages.find((p) => p.slug === 'hamburg-germany');
  assert.ok(robots(hamburg.html).startsWith('index'), 'hamburg stays indexed');
  const wind = pages.find((p) => p.slug === 'wind-star');
  assert.ok(wind.html.includes('5,736'));
  assert.ok(wind.html.includes('134 m'));
  assert.ok(!wind.html.includes('36,000'));
  const gemini = pages.find((p) => p.slug === 'celebrity-xpedition');
  assert.ok(gemini.html.includes('National Geographic Gemini'));
  assert.ok(gemini.html.includes('Lindblad Expeditions'));
  assert.ok(!gemini.html.includes('32,000'));
  const marigot = pages.find((p) => p.slug === 'marigot-st-maarten');
  if (marigot.html.includes('Saint-Martin')) {
    assert.ok(!/St\. Maarten/.test(marigot.html));
  }
  const rostock = pages.find((p) => p.slug === 'rostock-germany');
  assert.ok(/noindex/i.test(rostock.html));
  if (/<details class="pg-terminal-card"/.test(rostock.html) || /http-equiv=["']refresh/i.test(rostock.html)) {
    assert.ok(/warnemunde-berlin-germany/.test(rostock.html));
  }
  const barcelona = pages.find((p) => p.slug === 'barcelona-spain');
  if (barcelona.html.includes('<details class="pg-terminal-card"')) {
    assert.ok(barcelona.html.includes('0.4 km from city center'));
    assert.ok(barcelona.html.includes('Terminal E'));
    assert.ok(!barcelona.html.includes('4.5 km'));
  }
  const canaveral = pages.find((p) => p.slug === 'port-canaveral-fl-united-states');
  if (canaveral.html.includes('<details class="pg-terminal-card"')) {
    assert.ok(canaveral.html.includes('Cruise Terminal 2'));
    assert.ok(canaveral.html.includes('9050 Discovery Rd'));
    assert.ok(!/e\.g\. Disney/i.test(canaveral.html));
  }
  const vigo = pages.find((p) => p.slug === 'vigo-spain');
  if (vigo.html.includes('<details class="pg-terminal-card"')) {
    assert.ok(!vigo.html.includes('Atlantic Vigo'));
    assert.ok(vigo.html.includes('Alberto Durán'));
  }
  const pride = pages.find((p) => p.slug === 'pride-of-america');
  assert.ok(!pride.html.includes('<h2>Overview</h2>'));
  assert.ok(!pride.html.includes('Genießen'));
  const charcot = pages.find((p) => p.slug === 'le-commandant-charcot');
  assert.ok(/noindex/i.test(charcot.html), 'charcot spec held back');
  assert.ok(!locs.has('https://seadays.app/ships/le-commandant-charcot/'));

  const acapulco = pages.find((p) => p.slug === 'acapulco-mexico');
  assert.ok(/noindex/i.test(acapulco.html), 'audit noindex/rewrite port held back');
  assert.ok(!locs.has('https://seadays.app/ports/acapulco-mexico/'));
  const alicante = pages.find((p) => p.slug === 'alicante-spain');
  assert.ok(robots(alicante.html).startsWith('index'), 'audit keep port stays indexed');
  assert.ok(locs.has('https://seadays.app/ports/alicante-spain/'));
  for (const slug of AUDIT_PORT_NOINDEX) {
    const page = pages.find((p) => p.kind === 'port' && p.slug === slug);
    assert.ok(page, `audit port missing: ${slug}`);
    assert.ok(/noindex/i.test(page.html), `${slug} audit noindex`);
    assert.ok(!locs.has(`https://seadays.app/ports/${slug}/`), `${slug} still in sitemap`);
  }
  const legend = pages.find((p) => p.slug === 'star-legend');
  assert.ok(legend.html.includes('<h2>Overview</h2>'));
  assert.ok(legend.html.includes('Windstar Cruises'));
  const spirit = pages.find((p) => p.slug === 'wind-spirit');
  assert.ok(spirit.html.includes('<h2>Overview</h2>'));
  assert.ok(spirit.html.includes('5,736'));
  for (const slug of AUDIT_SHIP_HIDE_OVERVIEW) {
    const page = pages.find((p) => p.kind === 'ship' && p.slug === slug);
    assert.ok(page, `audit ship missing: ${slug}`);
    assert.ok(!page.html.includes('<h2>Overview</h2>'), `${slug} overview still visible`);
  }

  const checklist = fs.readFileSync(path.join(root, 'data/content-quality-checklist.csv'), 'utf8');
  const checklistRows = checklist.trim().split(/\n/).length - 1;
  assert.strictEqual(checklistRows, 699, `checklist rows ${checklistRows}`);
  assert.ok(checklist.includes('https://seadays.app/ports/acapulco-mexico/'));
  assert.ok(checklist.includes('overview hidden'));
  assert.ok(checklist.includes('verified Windstar'));

  const phase1Pages = pages.some((p) => p.kind === 'port' && /<details class="pg-terminal-card"/.test(p.html));
  if (phase1Pages) {
    const heat = pages.filter((p) => p.kind === 'port' && /Hydrate and pace walking in heat/i.test(p.html));
    assert.strictEqual(heat.length, 0);
    const cvs = pages.filter((p) => /cvs Celebrity Edge/.test(p.html));
    assert.strictEqual(cvs.length, 0, 'cvs title still on a port or ship page');
  }

  console.log(
    `publish gate ok (indexed ports ${indexedPorts}, indexed ships ${indexedShips}, failing ${failing}, sitemap ${locs.size})`
  );
}

main();

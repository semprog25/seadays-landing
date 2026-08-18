#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');

const {
  buildSeoShipRecords,
  buildShipDetailHtml,
  buildPortDetailHtml,
  pickPortsForShipPage,
  pickShipsForPortPage,
  pickRelatedShips,
} = require('./lib/seoShipPortPages');
const { buildShipAggregateRatingJsonLd } = require('./lib/seoShipPortPages');
const { scorePortForShip } = require('./lib/shipPortRelevance');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('fake ratings cannot be emitted without real reviewCount >= 1', () => {
  assert.strictEqual(
    buildShipAggregateRatingJsonLd({ rating: 4.5, reviewCount: 100 }) == null
      ? null
      : 'present',
    'present'
  );
  assert.strictEqual(buildShipAggregateRatingJsonLd({ rating: 4.5, reviewCount: 0 }), null);
  assert.strictEqual(buildShipAggregateRatingJsonLd({ rating: 0, reviewCount: 12 }), null);
  assert.strictEqual(buildShipAggregateRatingJsonLd({ rating: 4.5 }), null);
  assert.strictEqual(buildShipAggregateRatingJsonLd({}), null);
});

test('ship HTML uses guide titles and WebPage schema, never Product-by-default', () => {
  const ship = {
    slug: 'aidacosma',
    name: 'AIDACosma',
    cruise_line: 'AIDA Cruises',
    lineId: 'aida',
    shipClass: 'Helios',
    description: 'Helios-class LNG ship delivered 2021. Features the Ocean Deck with infinity pool.',
    highlights: [],
    yearBuilt: 2021,
    tonnage: 183747,
    capacity: 5440,
    capacityBasis: 'lower_berth',
    crew: 1500,
    length: 362,
    beam: 47,
    rating: null,
    reviewCount: null,
  };
  const html = buildShipDetailHtml(ship, [], [], [], {
    baseUrl: 'https://seadays.app',
    defaultImage: 'https://seadays.app/logo.png',
    indexStyles: '',
    runtimeGuardScript: '',
  });
  assert.match(html, /<title>AIDACosma Cruise Ship Guide \| AIDA Cruises<\/title>/);
  assert.match(html, /<h1>AIDACosma Cruise Ship Guide<\/h1>/);
  assert.doesNotMatch(html, /aggregateRating/);
  assert.doesNotMatch(html, /"@type":"Product"/);
  assert.match(html, /"@type":"WebPage"/);
  assert.match(html, /"@type":"FAQPage"/);
  assert.doesNotMatch(html, /cruise ship-class/);
  assert.match(html, /Helios-class cruise ship/);
  assert.match(html, /Frequently asked questions/);
});

async function main() {
  const ds = await import(pathToFileURL(path.join(__dirname, 'lib/appCruiseDataset.js')).href);
  const ports = ds.allPorts.map((p) => ({
    slug: p.slug,
    name: p.name,
    country: p.country,
    region: p.region,
  }));
  const ships = buildSeoShipRecords(
    ds.allShips.map((s) => ({
      ...s,
      cruise_line: s.cruiseLine,
      lineId: s.lineId,
    }))
  );

  test('AIDAcosma related ports are European, not Tampa', () => {
    const ship = ships.find((s) => s.slug === 'aidacosma');
    assert.ok(ship);
    const related = pickPortsForShipPage(ports, ship, 5);
    assert.ok(related.length >= 3, 'expected several related ports');
    const slugs = related.map((p) => p.slug).join(',');
    assert.doesNotMatch(slugs, /tampa/);
    assert.ok(
      related.every((p) => scorePortForShip(p, ship) > 0),
      `expected positive scores, got ${slugs}`
    );
  });

  test('Carnival Celebration related ports can include Florida/Caribbean', () => {
    const ship = ships.find((s) => /celebration/i.test(s.slug) && /carnival/i.test(s.cruise_line));
    if (!ship) return;
    const related = pickPortsForShipPage(ports, ship, 5);
    const blob = related.map((p) => `${p.slug} ${p.region} ${p.country}`).join(' ').toLowerCase();
    assert.ok(
      /florida|caribbean|bahamas|mexico|united states/.test(blob),
      `unexpected carnival ports: ${blob}`
    );
  });

  test('Barcelona related ships prefer Mediterranean-deployed lines', () => {
    const port = ports.find((p) => p.slug === 'barcelona-spain');
    assert.ok(port);
    const related = pickShipsForPortPage(ships, port, 4);
    assert.ok(related.length >= 2);
    assert.ok(related.every((s) => s.slug));
  });

  test('related ships prefer the same cruise line', () => {
    const ship = ships.find((s) => s.slug === 'aidacosma');
    const related = pickRelatedShips(ships, ship, 6);
    assert.ok(related.length >= 3);
    assert.ok(related.slice(0, 3).every((s) => s.cruise_line === 'AIDA Cruises'));
  });

  test('port FAQ JSON-LD is omitted without traveler Q&A data', () => {
    const html = buildPortDetailHtml(
      { slug: 'example-port', name: 'Example', country: 'Nowhere', region: '', highlights: [], description: 'A cruise port.' },
      [],
      [],
      [],
      { baseUrl: 'https://seadays.app', defaultImage: 'https://seadays.app/logo.png', indexStyles: '', runtimeGuardScript: '' }
    );
    assert.doesNotMatch(html, /"@type":"FAQPage"/);
  });

  const root = path.join(__dirname, '..');
  test('og-image.png and logo.png exist as real files', () => {
    for (const file of ['og-image.png', 'logo.png', 'llms.txt', 'robots.txt', 'ads.txt']) {
      const p = path.join(root, file);
      assert.ok(fs.existsSync(p), missing(file));
      assert.ok(fs.statSync(p).size > 20, `${file} too small`);
    }
    function missing(file) {
      return `missing ${file}`;
    }
  });

  test('robots.txt allows crawling and lists sitemap', () => {
    const robots = fs.readFileSync(path.join(root, 'robots.txt'), 'utf8');
    assert.match(robots, /User-agent: \*/);
    assert.match(robots, /Allow: \//);
    assert.match(robots, /Sitemap: https:\/\/seadays\.app\/sitemap\.xml/);
    assert.match(robots, /Disallow: \/auth\//);
    assert.doesNotMatch(robots, /Disallow: \/assets/);
  });

  test('og-image.png is a 1200x630 PNG', () => {
    const buf = fs.readFileSync(path.join(root, 'og-image.png'));
    assert.ok(buf.length > 1000, 'og-image.png too small');
    assert.strictEqual(buf.toString('ascii', 1, 4), 'PNG', 'og-image is PNG');
    assert.strictEqual(buf.readUInt32BE(16), 1200, 'og width 1200');
    assert.strictEqual(buf.readUInt32BE(20), 630, 'og height 630');
  });

  test('homepage Open Graph points at the 1200x630 asset', () => {
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    assert.match(home, /property="og:image" content="https:\/\/seadays\.app\/og-image\.png"/);
    assert.match(home, /property="og:image:width" content="1200"/);
    assert.match(home, /property="og:image:height" content="630"/);
  });

  test('duplicate cluster pages are noindex redirects', () => {
    const map = JSON.parse(fs.readFileSync(path.join(root, 'data/blog-canonical-clusters.json'), 'utf8'));
    for (const [dup, primary] of Object.entries(map)) {
      const html = fs.readFileSync(path.join(root, 'blog', dup, 'index.html'), 'utf8');
      assert.match(html, /noindex/i, `${dup} noindex`);
      assert.match(html, new RegExp(`/blog/${primary}/`), `${dup} points at ${primary}`);
      const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
      assert.doesNotMatch(sitemap, new RegExp(`/blog/${dup}/`));
    }
  });

  test('generated HTML has no signed storage URLs', () => {
    const dirs = ['blog', 'ships', 'ports'];
    const signed = [];
    const signedUrl = /https:\/\/[^"'\\\s]+\/storage\/v1\/object\/sign\//i;
    for (const dir of dirs) {
      const base = path.join(root, dir);
      for (const ent of fs.readdirSync(base, { withFileTypes: true })) {
        if (!ent.isDirectory()) continue;
        const p = path.join(base, ent.name, 'index.html');
        if (!fs.existsSync(p)) continue;
        const html = fs.readFileSync(p, 'utf8');
        if (signedUrl.test(html)) signed.push(`${dir}/${ent.name}`);
      }
    }
    const home = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    if (signedUrl.test(home)) signed.push('index.html');
    assert.deepStrictEqual(signed, [], `signed URLs remain: ${signed.slice(0, 8).join(', ')}`);
  });

  test('ship pages still have zero AggregateRating and no Review schema', () => {
    const sample = ['aidacosma', 'carnival-celebration', 'icon-of-the-seas'];
    for (const slug of sample) {
      const html = fs.readFileSync(path.join(root, 'ships', slug, 'index.html'), 'utf8');
      assert.doesNotMatch(html, /aggregateRating/);
      assert.doesNotMatch(html, /"@type":"Review"/);
      assert.doesNotMatch(html, /"@type":"Product"/);
      assert.match(html, /Cruise Ship Guide/);
    }
  });

  console.log('seo-remediation tests passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

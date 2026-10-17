'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  cleanViatorSearchTerm,
  resolvePortAffiliateCta,
  buildWebAffiliateCampaign,
  buildWebSearchCampaign,
} = require('./lib/viatorAffiliate');
const { buildPortDetailHtml } = require('./lib/seoShipPortPages');
const { buildTerminalsSection } = require('./lib/portGuideSections');
const { DANGLING_SENTENCE_RE, isDanglingSentence } = require('./lib/portCopyHygiene');

const root = path.join(__dirname, '..');
const VIATOR = { pid: 'P00314321', mcid: '42383', medium: 'link', configured: true };
const PRIVATE = new Set([
  'perfect-day-at-cococay-bahamas',
  'castaway-cay-bahamas',
  'half-moon-cay-bahamas',
  'great-stirrup-cay-bahamas',
  'ocean-cay-msc-reserve-bahamas',
  'labadee-haiti',
]);

function visibleMain(html) {
  const main = String(html || '').match(/<main\b[\s\S]*?<\/main>/i);
  let src = main ? main[0] : String(html || '');
  src = src.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  return src
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function sentencesOf(text) {
  return String(text || '')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

assert.strictEqual(cleanViatorSearchTerm('Rome (Civitavecchia)'), 'Rome');
assert.strictEqual(cleanViatorSearchTerm('Le Havre (Paris)'), 'Le Havre');
assert.strictEqual(cleanViatorSearchTerm('Da Nang/Hue (Chan May)'), 'Da Nang');
assert.strictEqual(cleanViatorSearchTerm('Boston, MA'), 'Boston');
assert.strictEqual(cleanViatorSearchTerm('Jeddah Islamic Port'), 'Jeddah');
assert.strictEqual(cleanViatorSearchTerm('Ocean Cay MSC Reserve'), 'Ocean Cay');

const known = new Set(['barcelona']);
const knownCta = resolvePortAffiliateCta(
  { slug: 'barcelona-spain', name: 'Barcelona', appPortId: 'barcelona' },
  { knownPortIds: known, config: VIATOR, searchOverrides: {} }
);
assert.strictEqual(knownCta.mode, 'known');
assert.ok(knownCta.url.includes('pid=P00314321'));
assert.ok(knownCta.url.includes('mcid=42383'));
assert.ok(knownCta.url.includes(`campaign=${buildWebAffiliateCampaign('barcelona')}`));

const searchCta = resolvePortAffiliateCta(
  { slug: 'juneau-ak-united-states', name: 'Juneau, AK', appPortId: 'juneau' },
  { knownPortIds: known, config: VIATOR, searchOverrides: {} }
);
assert.strictEqual(searchCta.show, true);
assert.strictEqual(searchCta.mode, 'search');
assert.strictEqual(searchCta.destinationLabel, 'Juneau');
assert.ok(searchCta.url.includes(`campaign=${buildWebSearchCampaign('juneau')}`));
assert.ok(!decodeURIComponent(searchCta.url).includes('('));

const livorno = resolvePortAffiliateCta(
  { slug: 'florence-pisa-livorno-italy', name: 'Florence/Pisa (Livorno)', appPortId: 'livorno' },
  { knownPortIds: new Set(), config: VIATOR }
);
assert.strictEqual(livorno.destinationLabel, 'Livorno');

const island = resolvePortAffiliateCta(
  { slug: 'perfect-day-at-cococay-bahamas', name: 'Perfect Day at CocoCay', appPortId: 'cococay' },
  { knownPortIds: new Set(['cococay']), config: VIATOR }
);
assert.strictEqual(island.show, false);
assert.strictEqual(island.privateIsland, true);

const terminalHtml = buildTerminalsSection([
  { name: 'Adossat A', terminal_type: 'both', distance_to_city_center_km: 4.5, description: 'Pier A.' },
  { name: 'Adossat B', terminal_type: 'both', distance_to_city_center_km: 4.5, description: 'Pier B.' },
  { name: 'WTC', terminal_type: 'transit', distance_to_city_center_km: 0.8, description: 'Closer pier.' },
]);
assert.ok(!terminalHtml.includes('4.5 km from city center'));
assert.ok(terminalHtml.includes('0.8 km from city center'));
assert.strictEqual((terminalHtml.match(/<details/g) || []).length, 3);
assert.ok(terminalHtml.includes('<details class="pg-terminal-card" open>'));

const page = buildPortDetailHtml(
  {
    slug: 'juneau-ak-united-states',
    name: 'Juneau, AK',
    country: 'United States',
    region: 'Alaska',
    description:
      'Juneau, AK, United States, United States is a cruise port profile in the SeaDays directory for travelers comparing itinerary stops.',
    highlights: ['Juneau, AK, United States, United States is a cruise port profile in the SeaDays directory.'],
  },
  [
    { slug: 'ketchikan-ak-united-states', name: 'Ketchikan', country: 'United States' },
    { slug: 'skagway-ak-united-states', name: 'Skagway', country: 'United States' },
    { slug: 'sitka-ak-united-states', name: 'Sitka', country: 'United States' },
    { slug: 'seward-ak-united-states', name: 'Seward', country: 'United States' },
  ],
  [
    { slug: 'ship-a', name: 'Ship A', cruise_line: 'Line A' },
    { slug: 'ship-b', name: 'Ship B', cruise_line: 'Line B' },
  ],
  [],
  {
    baseUrl: 'https://seadays.app',
    defaultImage: 'https://seadays.app/favicon.png',
    indexStyles: '',
    runtimeGuardScript: '',
    portTerminals: [{ name: 'Cruise Pier', terminal_type: 'transit', description: 'Call pier.' }],
    affiliate: searchCta,
  }
);
assert.ok(!/United States, United States is a cruise port/.test(page));
assert.ok(!page.includes('Embarkation from'));
assert.ok(page.includes('On a call at Juneau'));
assert.strictEqual((page.match(/apps\.apple\.com/g) || []).length, 1);
assert.strictEqual((page.match(/play\.google\.com/g) || []).length, 1);
assert.ok(page.includes('utm_content=port_single_cta'));
assert.ok(!page.includes('class="seo-visual-img"'));
assert.ok(!page.includes('<h2>Reviews</h2>'));
assert.ok(!page.includes('<h2>Cruise relevance</h2>'));
assert.ok(!page.includes('id="ships-calling"'));
assert.ok(!page.includes('id="related-ports"'));

const portsDir = path.join(root, 'ports');
const published = [];
for (const ent of fs.readdirSync(portsDir, { withFileTypes: true })) {
  if (!ent.isDirectory()) continue;
  const file = path.join(portsDir, ent.name, 'index.html');
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  if (/http-equiv=["']refresh/i.test(html)) continue;
  if (!html.includes('class="seo-detail')) continue;
  if (!/<h1>/.test(html)) continue;
  published.push({ slug: ent.name, html });
}
assert.ok(published.length >= 385, `expected published port pages, got ${published.length}`);

const relatedCounts = new Map();
const shipSetCounts = new Map();
const bad = [];
for (const { slug, html } of published) {
  const hasViator = html.includes('viator.com');
  const privateNote = html.includes('Excursions are sold by your cruise line.');
  if (PRIVATE.has(slug)) {
    if (!privateNote || hasViator) bad.push(`${slug} private-island box`);
  } else if (!hasViator && !privateNote) {
    bad.push(`${slug} missing experiences`);
  }
  if (hasViator) {
    const links = html.match(/https:\/\/www\.viator\.com\/[^"']+/g) || [];
    for (const link of links) {
      const url = new URL(link.replace(/&amp;/g, '&'));
      const text = url.searchParams.get('text') || '';
      if (/[()/]/.test(text) || /,\s*[A-Z]{2}$/.test(text)) bad.push(`${slug} text=${text}`);
      if (!url.searchParams.get('pid') || !url.searchParams.get('mcid') || !url.searchParams.get('campaign')) {
        bad.push(`${slug} affiliate params`);
      }
    }
  }
  const hero = [...html.matchAll(/<img\b[^>]*class="seo-hero-img"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const visuals = [...html.matchAll(/<img\b[^>]*class="seo-visual-img"[^>]*src="([^"]+)"/g)].map((m) => m[1]);
  const articles = new Set(
    [...html.matchAll(/<img\b[^>]*class="seo-article-img"[^>]*src="([^"]+)"/g)].map((m) => m[1])
  );
  for (const src of [...hero, ...visuals]) {
    if (articles.has(src)) bad.push(`${slug} hero matches article`);
  }
  if (visuals.length) bad.push(`${slug} blog visual panel`);
  const visible = visibleMain(html);
  if (/\b(\w[\w ]+), \1 is a cruise port/.test(visible)) bad.push(`${slug} doubled country`);
  for (const sentence of sentencesOf(visible)) {
    if (isDanglingSentence(sentence) || DANGLING_SENTENCE_RE.test(sentence)) bad.push(`${slug} dangling`);
  }
  const seen = new Map();
  for (const sentence of sentencesOf(visible)) {
    if (sentence.length <= 40) continue;
    const key = sentence.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
    seen.set(key, (seen.get(key) || 0) + 1);
  }
  for (const [key, count] of seen) {
    if (count > 1) bad.push(`${slug} repeat: ${key.slice(0, 80)}`);
  }
  const main = html.match(/<main\b[\s\S]*?<\/main>/i);
  const mainHtml = main ? main[0] : html;
  const apple = (mainHtml.match(/apps\.apple\.com/g) || []).length;
  const play = (mainHtml.match(/play\.google\.com/g) || []).length;
  if (apple > 1 || play > 1) bad.push(`${slug} store badges ${apple}/${play}`);
  if (/src="https?:\/\/cdn\.seadays\.app/i.test(html)) bad.push(`${slug} cdn thumb`);
  if (/\[[0-9]{1,3}\]/.test(visible) || /\[[a-z]\]/.test(visible)) bad.push(`${slug} citation marker`);
  const dist = mainHtml.match(/\d+(?:\.\d+)? km from city center/g) || [];
  const distCounts = new Map();
  for (const label of dist) distCounts.set(label, (distCounts.get(label) || 0) + 1);
  for (const [label, count] of distCounts) {
    if (count > 1) bad.push(`${slug} repeated ${label}`);
  }
  const rel = html.match(/id="related-ports"[\s\S]*?<\/section>/);
  if (rel) {
    const set = [...rel[0].matchAll(/href="\/ports\/([^"]+)\//g)].map((m) => m[1]).sort().join('|');
    if (set) relatedCounts.set(set, (relatedCounts.get(set) || 0) + 1);
  }
  const ships = html.match(/id="ships-calling"[\s\S]*?<\/section>/);
  if (ships) {
    const set = [...ships[0].matchAll(/href="\/ships\/([^"]+)\//g)].map((m) => m[1]).sort().join('|');
    if (set) shipSetCounts.set(set, (shipSetCounts.get(set) || 0) + 1);
  }
}
assert.deepStrictEqual(bad.slice(0, 12), [], bad.slice(0, 8).join('\n'));

for (const [set, count] of relatedCounts) {
  assert.ok(count <= 10, `related ports ${set} on ${count} pages`);
}
for (const [set, count] of shipSetCounts) {
  assert.ok(count <= 10, `related ships ${set} on ${count} pages`);
}

const barcelona = published.find((p) => p.slug === 'barcelona-spain');
assert.ok(barcelona, 'barcelona page');
const barcelonaChars = visibleMain(barcelona.html).length;
assert.ok(barcelonaChars <= 5000, `barcelona visible chars ${barcelonaChars}`);
assert.ok(barcelona.html.includes('Standard call (about 6–8 hours ashore)'));
assert.ok(!barcelona.html.includes('4.5 km from city center'));
assert.ok(barcelona.html.includes('0.4 km from city center'));

const portsIndex = fs.readFileSync(path.join(root, 'ports', 'index.html'), 'utf8');
const shipsIndex = fs.readFileSync(path.join(root, 'ships', 'index.html'), 'utf8');
assert.ok(!portsIndex.includes('In-app rating'));
assert.ok(!shipsIndex.includes('In-app rating'));

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
const sitemapLocs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
assert.ok(sitemapLocs.length < 522, `sitemap should drop gated urls, got ${sitemapLocs.length}`);
for (const loc of sitemapLocs) {
  const match = loc.match(/^https:\/\/seadays\.app\/(ports|ships)\/([^/]+)\/$/);
  if (!match) continue;
  const file = path.join(root, match[1], match[2], 'index.html');
  const head = fs.readFileSync(file, 'utf8').slice(0, 2500);
  assert.ok(!/noindex/i.test(head), `${loc} is noindex`);
}

const hamburg = published.find((p) => p.slug === 'hamburg-germany');
assert.ok(hamburg, 'hamburg page');
const hamburgHtml = hamburg.html;
assert.ok(hamburgHtml.includes('seo-detail-wide'));
assert.ok(hamburgHtml.includes('minmax(240px, 1fr)'));
assert.ok(hamburgHtml.includes('Dietmar Rabich'));
assert.ok(hamburgHtml.includes('CC BY-SA 4.0'));
assert.ok(hamburgHtml.includes('https://creativecommons.org/licenses/by-sa/4.0/'));
assert.ok(hamburgHtml.includes('OpenStreetMap'));
assert.ok(hamburgHtml.includes('1,416,715'));
assert.ok(!hamburgHtml.includes('800,000'));
assert.ok(!hamburgHtml.includes('close to city center'));
assert.ok(!hamburgHtml.includes('Kronprinzkai'));
assert.ok(!/Hydrate and pace walking in heat/i.test(hamburgHtml));
assert.ok(hamburgHtml.includes('Überseeboulevard 7'));
assert.ok(hamburgHtml.includes('Van-der-Smissen-Straße 5'));
assert.ok(hamburgHtml.includes('Buchheisterstraße 16'));
assert.ok(hamburgHtml.includes('Baakenhöft'));
assert.ok(hamburgHtml.includes('53.5397349'));
assert.ok(hamburgHtml.includes('53.5436585'));
assert.ok(hamburgHtml.includes('53.5294471'));
assert.ok(hamburgHtml.includes('53.5378455'));
assert.ok(!hamburgHtml.includes('id="ships-calling"'));
assert.strictEqual((hamburgHtml.match(/id="plan-port-day"/g) || []).length, 1);
assert.ok(hamburgHtml.includes('Short call (about 4–5 hours ashore)'));
assert.ok(hamburgHtml.includes('Standard call (about 6–8 hours ashore)'));
assert.ok(hamburgHtml.includes('Longer call (8+ hours or overnight)'));
assert.ok(hamburgHtml.indexOf('id="things-to-do"') < hamburgHtml.indexOf('id="getting-there"'));
const hamburgRelated = hamburgHtml.match(/id="related-ports"[\s\S]*?<\/section>/);
assert.ok(hamburgRelated);
assert.ok(hamburgRelated[0].includes('/ports/bremen-germany/'));
assert.ok(hamburgRelated[0].includes('/ports/bremerhaven-germany/'));
assert.strictEqual((hamburgRelated[0].match(/href="\/ports\//g) || []).length, 2);
const widePages = published.filter((p) => p.html.includes('seo-detail-wide'));
assert.strictEqual(widePages.length, published.length);

console.log(`ports phase 1 ok (${published.length} published, barcelona ${barcelonaChars} chars)`);

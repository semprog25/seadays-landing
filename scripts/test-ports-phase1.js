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
const {
  PORT_GUIDE_STYLES,
  buildThingsToDoSection,
  buildTerminalsSection,
  buildBookableExperiencesBanner,
} = require('./lib/portGuideSections');
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
  // Collapsed <details> body is not user-visible; keep summary text only.
  src = src.replace(/<details(?![^>]*\bopen\b)[^>]*>[\s\S]*?<\/details>/gi, (block) => {
    const sum = block.match(/<summary[^>]*>([\s\S]*?)<\/summary>/i);
    return sum ? `<details><summary>${sum[1]}</summary></details>` : '';
  });
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

const kusadasi = resolvePortAffiliateCta(
  { slug: 'ephesus-kusadasi-turkey', name: 'Ephesus (Kusadasi)', appPortId: 'kusadasi' },
  { knownPortIds: new Set(), config: VIATOR }
);
assert.strictEqual(kusadasi.destinationLabel, 'Kusadasi');

const civitavecchia = resolvePortAffiliateCta(
  { slug: 'rome-civitavecchia-italy', name: 'Rome (Civitavecchia), Italy', appPortId: 'civitavecchia' },
  { knownPortIds: new Set(['civitavecchia']), config: VIATOR }
);
assert.strictEqual(civitavecchia.portId, 'civitavecchia');
assert.strictEqual(civitavecchia.mode, 'known');
assert.strictEqual(civitavecchia.destinationLabel, 'Civitavecchia');
assert.ok(civitavecchia.url.includes('text=Civitavecchia'), 'civitavecchia viator search text');
assert.ok(civitavecchia.url.includes('pid=P00314321'));
assert.ok(civitavecchia.url.includes('mcid=42383'));
assert.ok(civitavecchia.url.includes('medium=link'));
assert.ok(civitavecchia.url.includes(`campaign=${buildWebAffiliateCampaign('civitavecchia')}`));
assert.ok(!civitavecchia.url.includes('text=Rome'), 'must not use Rome search text');

const civitavecchiaBanner = buildBookableExperiencesBanner(
  { show: true, url: civitavecchia.url, destinationLabel: 'Civitavecchia' },
  'Rome'
);
assert.ok(civitavecchiaBanner.includes('<h2>Explore experiences in Civitavecchia</h2>'), 'banner matches Viator search label');
assert.ok(!civitavecchiaBanner.includes('Explore experiences in Rome</h2>'), 'banner must not keep city label when search differs');

const barcelonaBanner = buildBookableExperiencesBanner(
  { show: true, url: 'https://www.viator.com/searchResults/all?text=Barcelona', destinationLabel: 'Barcelona' },
  'Barcelona'
);
assert.ok(barcelonaBanner.includes('<h2>Explore experiences in Barcelona</h2>'), 'unchanged when labels match');

const unchangedSample = [
  { slug: 'hamburg-germany', name: 'Hamburg, Germany', appPortId: 'hamburg', label: 'Hamburg' },
  { slug: 'barcelona-spain', name: 'Barcelona, Spain', appPortId: 'barcelona', label: 'Barcelona' },
  { slug: 'santorini-greece', name: 'Santorini, Greece', appPortId: 'santorini', label: 'Santorini' },
  { slug: 'skjolden-norway', name: 'Skjolden, Norway', appPortId: 'skjolden', label: 'Skjolden' },
];
for (const sample of unchangedSample) {
  const cta = resolvePortAffiliateCta(sample, {
    knownPortIds: new Set([sample.appPortId]),
    config: VIATOR,
  });
  assert.strictEqual(cta.destinationLabel, sample.label, `${sample.slug} search label unchanged`);
  assert.ok(cta.url.includes(`text=${sample.label}`), `${sample.slug} viator text param`);
}

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

assert.ok(PORT_GUIDE_STYLES.includes('#79D8FF'), 'editorial link color token');
const thingsSample = buildThingsToDoSection({
  thingsToDo: {
    intro: 'Intro line.',
    shortCall: 'Short body.',
    topThings: ['One', 'Two'],
    practicalTip: 'Tip line.',
  },
});
assert.ok(thingsSample.includes('pg-call-plan-card'));
assert.ok(thingsSample.includes('pg-cruise-tip'));
assert.ok(thingsSample.includes('Short body.'));
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
  const robotsHead = String(html || '').slice(0, 4000).match(/<meta\s+name=["']robots["']\s+content=["']([^"']+)["']/i);
  const indexable = robotsHead && robotsHead[1].toLowerCase().startsWith('index');
  if (indexable && /Visa-free for US citizens and many others/i.test(html)) {
    bad.push(`${slug} definitive canada visa boilerplate`);
  }
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

const halifax = published.find((p) => p.slug === 'halifax-ns-canada');
assert.ok(halifax, 'halifax page');
assert.ok(halifax.html.includes('id="guest-reviews"'));
assert.ok(halifax.html.includes('href="#guest-reviews"'));
assert.ok(halifax.html.includes('viator.com'));
assert.ok(halifax.html.includes('campaign=seadays-web-phalifax'));
assert.ok(halifax.html.includes('Secure checkout · Partner handled'));
assert.ok(!halifax.html.includes('Continue in SeaDays →'));

const barcelona = published.find((p) => p.slug === 'barcelona-spain');
assert.ok(barcelona, 'barcelona page');
const barcelonaMain = barcelona.html.match(/<main\b[\s\S]*?<\/main>/i);
const barcelonaMainHtml = barcelonaMain ? barcelonaMain[0] : barcelona.html;
const barcelonaChars = visibleMain(barcelona.html).length;
assert.ok(barcelonaChars <= 5200, `barcelona visible chars ${barcelonaChars}`);
assert.ok(barcelonaMainHtml.includes('id="things-to-do"'), 'barcelona things-to-do');
assert.ok(barcelonaMainHtml.includes('id="getting-there"'), 'barcelona terminals section');
assert.ok(barcelonaMainHtml.includes('id="plan-port-day"'), 'barcelona plan port day');
const barcelonaTerminals = barcelonaMainHtml.match(/id="getting-there"[\s\S]*?<\/section>/i);
assert.ok(barcelonaTerminals, 'barcelona getting-there section');
const barcelonaTerminalCards =
  (barcelonaTerminals[0].match(/<details class="pg-terminal-card"/g) || []).length +
  (barcelonaTerminals[0].match(/<article class="pg-terminal-card/g) || []).length;
assert.strictEqual(barcelonaTerminalCards, 4, 'barcelona active terminal cards');
assert.ok(barcelonaMainHtml.includes('Moll Adossat Terminal E (Helix)'), 'barcelona terminal E');
assert.ok(barcelonaMainHtml.includes('pg-terminal-transition-notice'), 'barcelona WTC transition notice');
assert.ok(!barcelonaMainHtml.includes('World Trade Center (WTC) Cruise Pier</summary>'), 'WTC not active terminal card');
assert.ok(!barcelonaTerminals[0].includes('Moll Adossat Terminal C</summary>'), 'legacy terminal C not active card');
assert.ok(barcelonaTerminals[0].includes('id="port-terminal-map"'), 'barcelona terminal map');
const barcelonaPinCount = (barcelonaTerminals[0].match(/"lat":/g) || []).length;
assert.strictEqual(barcelonaPinCount, 4, 'barcelona map pin count');
assert.ok(barcelonaMainHtml.includes('pg-terminal-card--has-photo'), 'barcelona terminal B photo card');
assert.ok(barcelona.html.includes('pg-call-plan-card') || barcelona.html.includes('Standard call'));
assert.ok(!barcelona.html.includes('4.5 km from city center'));
assert.ok(barcelona.html.includes('0.4 km from city center'));
assert.ok(!barcelona.html.includes('id="ships-calling"'), 'barcelona no ships block');
assert.ok(!barcelona.html.includes('id="related-ports"'), 'barcelona no related ports block');

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
assert.ok(hamburgHtml.includes('#79D8FF'), 'hamburg editorial link color');
assert.ok(hamburgHtml.includes('#related-ports'), 'related ports block');
assert.ok(hamburgHtml.includes('#related-ports .seo-cross-list a { color: #79D8FF'), 'related ports editorial links');
assert.ok(hamburgHtml.includes('align-items: stretch'), 'terminal grid stretch alignment');
assert.ok(hamburgHtml.includes('pg-terminal-card--has-photo'), 'hamburg photo terminal cards');
assert.ok(hamburgHtml.includes('pg-call-plan-card'));
assert.ok(hamburgHtml.includes('pg-cruise-tip'));
assert.ok(hamburgHtml.includes('pg-top-things-heading'));
assert.ok(hamburgHtml.includes('Short call'));
assert.ok(hamburgHtml.includes('Standard call'));
assert.ok(hamburgHtml.includes('Longer call'));
assert.ok(hamburgHtml.includes('About 4–5 hours ashore'));
assert.ok(hamburgHtml.includes('blog-hero'), 'hamburg keeps production page shell CSS');
assert.ok(hamburgHtml.includes('google-adsense-account'), 'hamburg adsense meta');
assert.ok(hamburgHtml.includes('seadays-contextual-cta'), 'hamburg save CTA block');
assert.ok(hamburgHtml.includes('safeImage'), 'hamburg footer image guard');
assert.ok(hamburgHtml.includes('campaign=seadays-web-phamburg'), 'hamburg viator campaign');
assert.ok(!/\.port-jump \{[^}]*position:\s*sticky/s.test(hamburgHtml), 'no sticky port-jump regression');
const hamburgTerminals = hamburgHtml.match(/id="getting-there"[\s\S]*?<\/section>/i);
assert.ok(hamburgTerminals, 'hamburg terminals section');
assert.strictEqual(
  (hamburgTerminals[0].match(/class="[^"]*pg-terminal-card--has-photo/g) || []).length,
  4,
  'four terminal photos'
);
assert.ok(hamburgHtml.indexOf('id="things-to-do"') < hamburgHtml.indexOf('id="getting-there"'));
const hamburgRelated = hamburgHtml.match(/id="related-ports"[\s\S]*?<\/section>/);
assert.ok(hamburgRelated);
assert.ok(hamburgRelated[0].includes('/ports/bremen-germany/'));
assert.ok(hamburgRelated[0].includes('/ports/bremerhaven-germany/'));
assert.strictEqual((hamburgRelated[0].match(/href="\/ports\//g) || []).length, 2);
const widePages = published.filter((p) => p.html.includes('seo-detail-wide'));
assert.strictEqual(widePages.length, published.length);

const viatorBanner = buildBookableExperiencesBanner(
  {
    show: true,
    url: 'https://www.viator.com/searchResults/all?text=Barcelona&pid=P00314321&mcid=42383&medium=link&campaign=seadays-web-pbarcelona',
    destinationLabel: 'Barcelona',
  },
  'Barcelona'
);
assert.ok(viatorBanner.includes('Explore Shore Experiences'));
assert.ok(!viatorBanner.includes('Top Rated'));
assert.ok(viatorBanner.includes('viator.com'));
assert.ok(viatorBanner.includes('pid=P00314321'));
assert.ok(viatorBanner.includes('mcid=42383'));
assert.ok(viatorBanner.includes('campaign=seadays-web-pbarcelona'));
assert.ok(viatorBanner.includes('rel="noopener noreferrer sponsored"'));
assert.ok(viatorBanner.includes('pg-affiliate-note'));

const fallbackBanner = buildBookableExperiencesBanner(
  { show: true, url: null, destinationLabel: 'Juneau', reason: 'not_configured', mode: 'search' },
  'Juneau'
);
assert.ok(fallbackBanner.includes('Explore Shore Experiences'));
assert.ok(!fallbackBanner.includes('Top Rated'));
assert.ok(!fallbackBanner.includes('viator.com'));
assert.ok(!fallbackBanner.includes('Book shore excursions, tours'));
assert.ok(!fallbackBanner.includes('with our partner'));
assert.ok(!fallbackBanner.includes('pg-affiliate-note'));
assert.ok(fallbackBanner.includes('Continue in SeaDays'));
assert.ok(fallbackBanner.includes('/download'));

const privateBanner = buildBookableExperiencesBanner(
  { show: false, url: null, privateIsland: true, mode: 'private_island' },
  'Perfect Day'
);
assert.strictEqual(privateBanner, '');

console.log(`ports phase 1 ok (${published.length} published, barcelona ${barcelonaChars} chars)`);

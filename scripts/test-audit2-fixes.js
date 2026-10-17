'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { getSiteFooterHtml } = require('./lib/siteShell');
const {
  loadWikipediaAttribution,
  stripWikiCitationMarkers,
  rewriteCdnThumbnailUrl,
  wikipediaAttributionHtml,
} = require('./lib/portCopyHygiene');

const ROOT = path.join(__dirname, '..');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('minimum age is 16 on terms, privacy, gdpr, and FAQ', () => {
  for (const rel of ['terms.html', 'privacy.html', 'gdpr.html', 'faq.html']) {
    const html = read(rel);
    assert.match(html, /at least 16/);
    assert.doesNotMatch(html, /at least 13|under 13|under 16 \(or applicable/i);
  }
  assert.doesNotMatch(read('gdpr.html'), /COPPA/);
  assert.doesNotMatch(read('gdpr.html'), /parental consent/i);
});

test('privacy and FAQ do not promise encryption at rest, audits, or employee access limits', () => {
  for (const rel of ['privacy.html', 'faq.html']) {
    const html = read(rel);
    assert.match(html, /in transit/);
    assert.match(html, /do not claim encryption at rest/i);
    assert.doesNotMatch(html, /encryption of data in transit and at rest/i);
    assert.doesNotMatch(html, /regular security audits/i);
    assert.doesNotMatch(html, /limited employee access/i);
  }
  assert.match(read('privacy.html'), /HTTPS\/TLS/);
});

test('privacy lists the same processors as the GDPR page', () => {
  const privacy = read('privacy.html');
  for (const name of [
    'Supabase',
    'Google Firebase Analytics',
    'Sign in with Apple',
    'GitHub Pages',
    'Google Analytics 4',
    'Google AdSense',
    'Sentry',
    'RevenueCat',
    'Google AdMob',
  ]) {
    assert.match(privacy, new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(privacy, /anonymized and does not include personal information/i);
  assert.doesNotMatch(privacy, /payment processors/i);
  assert.match(read('cookies.html'), /Supabase auth, only on sign-in and admin pages/);
});

test('privacy and GDPR name the controller and link the Impressum', () => {
  for (const rel of ['privacy.html', 'gdpr.html']) {
    const html = read(rel);
    assert.match(html, /Sharan Gangadharan, Lincolnstraße 27, 20359 Hamburg, Deutschland/);
    assert.match(html, /mailto:info@semprog\.de/);
    assert.match(html, /href="\/impressum\.html"/);
  }
  assert.doesNotMatch(read('manage-app-data.html'), /gdpr@seadays\.app/);
  assert.doesNotMatch(read('delete-account.html'), /gdpr@seadays\.app/);
  assert.match(read('manage-app-data.html'), /info@semprog\.de/);
});

test('terms drop cruise-line and payment-processor integration claims', () => {
  const terms = read('terms.html');
  assert.match(terms, /Purchases go through the Apple App Store or Google Play/);
  assert.match(terms, /not affiliated with any cruise line/);
  assert.doesNotMatch(terms, /integrates with third-party services \(cruise lines, payment processors/i);
  assert.match(terms, /Last Updated: October 17, 2026/);
  assert.match(read('privacy.html'), /Last Updated: October 17, 2026/);
  assert.match(read('cookies.html'), /Last Updated: October 17, 2026/);
});

test('data export is by request and paid plans share one description', () => {
  const help = read('help.html');
  assert.match(help, /Request Data Download/);
  assert.match(help, /usually within 48 hours/);
  assert.doesNotMatch(help, /export all your cruise data/i);
  assert.doesNotMatch(help, /unlimited cruises/i);
  const phrase = 'more saved trips and ad-free browsing';
  for (const rel of ['help.html', 'faq.html', 'terms.html', 'index.html']) {
    assert.match(read(rel), new RegExp(phrase));
  }
  assert.doesNotMatch(read('faq.html'), /additional planning tools/);
});

test('ad privacy path is Profile, Settings, Privacy and Data', () => {
  for (const rel of ['privacy.html', 'cookies.html', 'manage-app-data.html']) {
    assert.match(read(rel), /Profile → Settings → Privacy &amp; Data → Ad privacy options/);
  }
});

test('CO2 tip, port weight, phone, and LED comparisons match the calculator', () => {
  const html = read('co2/index.html');
  assert.match(html, /More port calls add a little to the estimate; they don't lower it/);
  assert.match(html, /each port adds about 0\.005 tonnes/);
  assert.match(html, /tons \/ 0\.0000124/);
  assert.match(html, /tons \/ 0\.0000036/);
  assert.match(html, /12\.4 g of CO₂ \(US EPA 2024\)/);
  assert.match(html, /9 W LED/);
  assert.match(html, /0\.05 tonne port-call allowance/);
  assert.match(html, /no published emissions study/);
  assert.match(html, /https:\/\/www\.epa\.gov\/energy\/greenhouse-gas-equivalencies-calculator-calculations-and-references/);
  assert.match(html, /https:\/\/www\.epa\.gov\/ghgemissions\/assumptions-and-references-household-carbon-footprint-calculator/);
  assert.match(html, /3\.94 × 10⁻⁴ metric tons/);
  assert.match(html, /75,800 times/);
  assert.match(html, /261,000 hours/);
  assert.doesNotMatch(html, /port-heavy itinerary at a similar distance can produce a slightly lower/);
  assert.match(html, /Last updated/);
  assert.doesNotMatch(html, /18,800 times/);
});

test('sitemap lists the indexable utility pages and keeps press out', () => {
  const xml = read('sitemap.xml');
  for (const loc of [
    'https://seadays.app/security.html',
    'https://seadays.app/meet-saili/',
    'https://seadays.app/delete-account.html',
    'https://seadays.app/manage-app-data.html',
    'https://seadays.app/download/',
  ]) {
    assert.match(xml, new RegExp(loc.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.doesNotMatch(xml, /https:\/\/seadays\.app\/press\//);
  const generator = read('scripts/generateBlogs.js');
  assert.match(generator, /loc: '\/security\.html'/);
  assert.match(generator, /loc: '\/meet-saili\/'/);
  assert.match(generator, /loc: '\/download\/'/);
  assert.doesNotMatch(generator, /loc: '\/press\/'/);
});

test('related thumbnails are not served from cdn.seadays.app', () => {
  assert.equal(
    rewriteCdnThumbnailUrl('https://cdn.seadays.app/portside/example.jpg'),
    'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/portside/example.jpg'
  );
  const hits = [];
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.html')) {
        const html = fs.readFileSync(full, 'utf8');
        if (/src=["']https?:\/\/cdn\.seadays\.app/i.test(html)) hits.push(path.relative(ROOT, full));
      }
    }
  }
  walk(ROOT);
  assert.deepStrictEqual(hits, []);
});

test('footer blog link matches the homepage section and the passport spells SeaDays', () => {
  const footer = getSiteFooterHtml();
  assert.match(footer, /href="\/#blog">From the blog<\/a>/);
  assert.doesNotMatch(footer, /SeaStories/);
  assert.match(read('index.html'), /passport-livecard-appname">SeaDays</);
  assert.doesNotMatch(read('index.html'), /passport-livecard-appname">Seadays</);
});

test('overlapping port descriptions attribute Wikipedia and drop citation markers', () => {
  const attribution = loadWikipediaAttribution(ROOT);
  const slugs = Object.keys(attribution);
  assert.equal(slugs.length, 97);
  const missing = [];
  const marked = [];
  for (const slug of slugs) {
    const html = read(path.join('ports', slug, 'index.html'));
    const expected = wikipediaAttributionHtml(attribution[slug]);
    if (!html.includes(expected)) missing.push(slug);
    const visible = html.replace(/<script[\s\S]*?<\/script>/gi, '');
    if (/\[\d{1,3}\]/.test(visible)) marked.push(slug);
  }
  assert.deepStrictEqual(missing, []);
  assert.deepStrictEqual(marked, []);
  assert.equal(stripWikiCitationMarkers('Oslo[12][13] is here[a].'), 'Oslo is here.');
});

console.log('audit2 fixes tests passed');

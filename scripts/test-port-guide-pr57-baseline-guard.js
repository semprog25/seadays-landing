'use strict';

/**
 * PR57 published HTML must keep main-line robots, Viator, canonicals, and consent chrome.
 * Compares working-tree ports/** to origin/main for bounded regression detection.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const {
  extractRobotsContent,
  extractBookableExperiencesSection,
  extractCanonicalHref,
  BOOKABLE_SECTION_RE,
} = require('./lib/publishedPortHtmlPreserve');

const REPRESENTATIVE = [
  'hamburg-germany',
  'aalborg-denmark',
  'barcelona-spain',
  'vizag-india',
  'halifax-ns-canada',
  'molde-norway',
];

function readMainPortHtml(slug) {
  return execSync(`git show origin/main:ports/${slug}/index.html`, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function listPublishedPortSlugs() {
  const slugs = [];
  for (const ent of fs.readdirSync(path.join(root, 'ports'), { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(root, 'ports', ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    if (!html.includes('class="seo-detail') || !/<h1>/.test(html)) continue;
    if (/http-equiv=["']refresh/i.test(html)) continue;
    slugs.push(ent.name);
  }
  return slugs;
}

function extractViatorHrefs(html) {
  return [...String(html || '').matchAll(/href="(https:\/\/www\.viator\.com[^"]+)"/g)].map((m) => m[1]);
}

function extractLdJsonBlocks(html) {
  return [...String(html || '').matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => m[1].trim()
  );
}

function cmpSnippet(html, pattern) {
  const m = String(html || '').match(pattern);
  return m ? m[0] : '';
}

let robotsDrift = 0;
let viatorLost = 0;
let canonicalDrift = 0;
let bookableDrift = 0;
let ldDrift = 0;
let unauthorizedIndex = 0;

const slugs = listPublishedPortSlugs();
assert.ok(slugs.length >= 385, `expected published ports, got ${slugs.length}`);

for (const slug of slugs) {
  let mainHtml;
  try {
    mainHtml = readMainPortHtml(slug);
  } catch {
    continue;
  }
  const branchHtml = fs.readFileSync(path.join(root, 'ports', slug, 'index.html'), 'utf8');
  const mainRobots = extractRobotsContent(mainHtml);
  const branchRobots = extractRobotsContent(branchHtml);
  if (mainRobots !== branchRobots) {
    robotsDrift += 1;
    if (/noindex/i.test(mainRobots) && /index,\s*follow/i.test(branchRobots)) unauthorizedIndex += 1;
  }
  const mainCanon = extractCanonicalHref(mainHtml);
  const branchCanon = extractCanonicalHref(branchHtml);
  if (mainCanon && branchCanon && mainCanon !== branchCanon) canonicalDrift += 1;

  const mainBook = extractBookableExperiencesSection(mainHtml);
  const branchBook = extractBookableExperiencesSection(branchHtml);
  if (mainBook && mainBook !== branchBook) bookableDrift += 1;

  for (const href of extractViatorHrefs(mainHtml)) {
    if (!branchHtml.includes(href)) viatorLost += 1;
  }

  const mainLd = extractLdJsonBlocks(mainHtml).join('\n');
  const branchLd = extractLdJsonBlocks(branchHtml).join('\n');
  if (mainLd && mainLd !== branchLd) ldDrift += 1;

  const cmp = cmpSnippet(mainHtml, /meta[^>]+content-security-policy/i);
  const branchCmp = cmpSnippet(branchHtml, /meta[^>]+content-security-policy/i);
  if (cmp && cmp !== branchCmp) {
    assert.fail(`${slug} CSP meta changed`);
  }
}

assert.strictEqual(unauthorizedIndex, 0, `unauthorized noindex→index: ${unauthorizedIndex}`);
assert.strictEqual(robotsDrift, 0, `robots drift on ${robotsDrift} pages`);
assert.strictEqual(viatorLost, 0, `lost viator hrefs: ${viatorLost}`);
assert.strictEqual(bookableDrift, 0, `bookable-experiences drift on ${bookableDrift} pages`);
assert.strictEqual(canonicalDrift, 0, `canonical drift on ${canonicalDrift} pages`);
assert.strictEqual(ldDrift, 0, `json-ld drift on ${ldDrift} pages`);

const shipsDiff = execSync('git diff origin/main --name-only -- ships/', { cwd: root, encoding: 'utf8' }).trim();
assert.strictEqual(shipsDiff, '', 'ships/** must have zero diff vs main');

for (const slug of REPRESENTATIVE) {
  const html = fs.readFileSync(path.join(root, 'ports', slug, 'index.html'), 'utf8');
  assert.ok(!/\.port-jump \{ position: sticky/.test(html), `${slug} sticky port-jump`);
  if (slug === 'hamburg-germany') {
    assert.ok(html.includes('pg-terminal-card--has-photo'), 'hamburg photo card');
    const article = html.match(
      /<article class="pg-terminal-card pg-terminal-card--has-photo"[\s\S]*?<\/article>/
    );
    assert.ok(article, 'hamburg photo article');
    const slice = article[0];
    assert.ok(
      slice.indexOf('pg-terminal-card-photo') < slice.indexOf('pg-terminal-card-title'),
      'photo before title'
    );
    assert.ok(html.includes('Dietmar Rabich') || html.includes('Wikimedia'), 'hafencity attribution');
  }
  if (slug === 'aalborg-denmark') {
    assert.ok(html.includes('viator.com'), 'aalborg viator preserved');
  }
}

console.log('test-port-guide-pr57-baseline-guard: OK');

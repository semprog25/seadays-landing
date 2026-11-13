#!/usr/bin/env node
'use strict';

const path = require('path');
const assert = require('assert');
const {
  classifyChangedFiles,
  resolveGenerationPlan,
} = require('./lib/ciClassifyGeneration');
const {
  resolveGateModeFromPushFiles,
  VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST,
} = require('./assert-ports-regen-banner-only-diff');

const PR129_RECOVERY_FILES = [
  '.github/workflows/generate-ports.yml',
  'scripts/apply-publish-gate.js',
  'scripts/assert-ports-regen-banner-only-diff.js',
  'scripts/ci-run-channel.sh',
  'scripts/generateBlogs.js',
  'scripts/lib/portsRegenScope.js',
  'scripts/test-ports-regen-banner-scope.js',
];

const CHANNEL_FIX_PUSH_FILES = [
  'scripts/lib/ciClassifyGeneration.js',
  'scripts/assert-ports-regen-banner-only-diff.js',
  '.github/workflows/generate-ports.yml',
  'scripts/test-ci-classify-generation.js',
];

const MORMUGAO_STYLE_RECOVERY_PUSH_FILES = [
  'scripts/lib/publishedPortHtmlPreserve.js',
  'scripts/assert-ports-regen-banner-only-diff.js',
  'scripts/test-mormugao-approved-meta-regen.js',
  'scripts/test-published-port-html-preserve.js',
  'scripts/test-ci-classify-generation.js',
  'scripts/test-ports-regen-banner-scope.js',
  'scripts/test-batch02-mormugao-publication-release.js',
  '.github/workflows/generate-ports.yml',
];

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('landing HTML/CSS/asset pushes skip generation', () => {
  const plan = classifyChangedFiles([
    'index.html',
    'about.html',
    'faq.html',
    'help.html',
    'privacy.html',
    'assets/logo.svg',
    'co2/index.html',
    'press/index.html',
    'CNAME',
  ]);
  assert.strictEqual(plan.skip, true);
  assert.strictEqual(plan.channel, 'skip');
  assert.strictEqual(plan.allowOrphanCleanup, false);
});

test('blog template/script changes select blogs-only', () => {
  const plan = classifyChangedFiles(['scripts/lib/adsenseArticleSlot.js', 'blog-article.html']);
  assert.strictEqual(plan.channel, 'blogs');
  assert.strictEqual(plan.blogs, true);
  assert.strictEqual(plan.ports, false);
  assert.strictEqual(plan.needsViator, false);
  assert.strictEqual(plan.allowOrphanCleanup, false);
});

test('port data/scripts select ports-only', () => {
  const plan = classifyChangedFiles(['data/public-port-guides.json', 'scripts/lib/portSeoRedirects.js']);
  assert.strictEqual(plan.channel, 'ports');
  assert.strictEqual(plan.ports, true);
  assert.strictEqual(plan.blogs, false);
  assert.strictEqual(plan.needsViator, true);
});

test('shared ship/port templates select catalogue, not blogs', () => {
  const plan = classifyChangedFiles(['scripts/lib/appCruiseDataset.js']);
  assert.strictEqual(plan.channel, 'catalogue');
  assert.strictEqual(plan.ships, true);
  assert.strictEqual(plan.ports, true);
  assert.strictEqual(plan.blogs, false);
  assert.strictEqual(plan.allowOrphanCleanup, false);
});

test('generateBlogs.js changes select full without orphan cleanup', () => {
  const plan = classifyChangedFiles(['scripts/generateBlogs.js']);
  assert.strictEqual(plan.channel, 'full');
  assert.strictEqual(plan.blogs, true);
  assert.strictEqual(plan.ships, true);
  assert.strictEqual(plan.ports, true);
  assert.strictEqual(plan.allowOrphanCleanup, false);
});

test('PR #129 recovery push classifies ports under push plan when banner gate is active', () => {
  assert.strictEqual(resolveGateModeFromPushFiles(PR129_RECOVERY_FILES), 'banner-only');
  const plain = classifyChangedFiles(PR129_RECOVERY_FILES);
  assert.strictEqual(plain.channel, 'full', 'plain classify still full without gate hook');
  const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: PR129_RECOVERY_FILES });
  assert.strictEqual(plan.channel, 'ports');
  assert.strictEqual(plan.skip, false);
  assert.strictEqual(plan.needsViator, true);
  assert.strictEqual(plan.blogs, false);
  assert.strictEqual(plan.ships, false);
});

test('proposed channel-fix PR push classifies ports', () => {
  for (const file of CHANNEL_FIX_PUSH_FILES) {
    assert(VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST.has(file), `allowlist missing ${file}`);
  }
  assert.strictEqual(resolveGateModeFromPushFiles(CHANNEL_FIX_PUSH_FILES), 'banner-only');
  const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: CHANNEL_FIX_PUSH_FILES });
  assert.strictEqual(plan.channel, 'ports');
  assert.strictEqual(plan.needsViator, true);
});

test('proposed mormugao style recovery push classifies ports', () => {
  for (const file of MORMUGAO_STYLE_RECOVERY_PUSH_FILES) {
    assert(VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST.has(file), `allowlist missing ${file}`);
  }
  assert.strictEqual(resolveGateModeFromPushFiles(MORMUGAO_STYLE_RECOVERY_PUSH_FILES), 'banner-only');
  const plan = resolveGenerationPlan({
    eventName: 'push',
    changedFiles: MORMUGAO_STYLE_RECOVERY_PUSH_FILES,
  });
  assert.strictEqual(plan.channel, 'ports');
  assert.strictEqual(plan.skip, false);
  assert.strictEqual(plan.needsViator, true);
  assert.strictEqual(plan.blogs, false);
  assert.strictEqual(plan.ships, false);
});

test('banner-only recovery plus unexpected path fails closed on push plan', () => {
  assert.throws(
    () =>
      resolveGenerationPlan({
        eventName: 'push',
        changedFiles: [...PR129_RECOVERY_FILES, 'data/public-port-guides.json'],
      }),
    /fail closed/,
  );
});

const BATCH5_FAQ_COHORT_FILES = [
  'scripts/lib/portGuideSections.js',
  'ports/la-paz-mexico/index.html',
  'ports/long-beach-ca-united-states/index.html',
  'ports/los-angeles-ca-united-states/index.html',
  'ports/portland-me-united-states/index.html',
  'ports/san-diego-ca-united-states/index.html',
  'ports/san-francisco-ca-united-states/index.html',
  'ports/seattle-wa-united-states/index.html',
  'ports/vancouver-bc-canada/index.html',
];

test('FAQ cohort push without push SHAs fails closed', () => {
  const prevBefore = process.env.GITHUB_EVENT_BEFORE;
  const prevSha = process.env.GITHUB_SHA;
  delete process.env.GITHUB_EVENT_BEFORE;
  delete process.env.GITHUB_SHA;
  try {
    assert.throws(
      () =>
        resolveGenerationPlan({
          eventName: 'push',
          changedFiles: BATCH5_FAQ_COHORT_FILES,
        }),
      /GITHUB_EVENT_BEFORE/,
    );
  } finally {
    if (prevBefore !== undefined) process.env.GITHUB_EVENT_BEFORE = prevBefore;
    else delete process.env.GITHUB_EVENT_BEFORE;
    if (prevSha !== undefined) process.env.GITHUB_SHA = prevSha;
    else delete process.env.GITHUB_SHA;
  }
});

test('FAQ cohort push (#156 range) skips catalogue generation when verified', () => {
  const prevBefore = process.env.GITHUB_EVENT_BEFORE;
  const prevSha = process.env.GITHUB_SHA;
  const prevRoot = process.env.PORTS_REGEN_GATE_REPO_ROOT;
  process.env.GITHUB_EVENT_BEFORE = 'ac50a355234946278739a26b861f89be01e6656a';
  process.env.GITHUB_SHA = 'e9df022900cad6b67c251336cd9357f9f2681f24';
  process.env.PORTS_REGEN_GATE_REPO_ROOT = path.join(__dirname, '..');
  try {
    const plan = resolveGenerationPlan({
      eventName: 'push',
      changedFiles: BATCH5_FAQ_COHORT_FILES,
    });
    assert.strictEqual(plan.channel, 'skip');
    assert.strictEqual(plan.skip, true);
  } finally {
    if (prevBefore !== undefined) process.env.GITHUB_EVENT_BEFORE = prevBefore;
    else delete process.env.GITHUB_EVENT_BEFORE;
    if (prevSha !== undefined) process.env.GITHUB_SHA = prevSha;
    else delete process.env.GITHUB_SHA;
    if (prevRoot !== undefined) process.env.PORTS_REGEN_GATE_REPO_ROOT = prevRoot;
    else delete process.env.PORTS_REGEN_GATE_REPO_ROOT;
  }
});

test('FAQ cohort rejects non-FAQ portGuideSections.js diff lines', () => {
  const { assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly } = require('./assert-ports-regen-banner-only-diff');
  const badDiff = [
    '@@ -1,1 +1,2 @@',
    '+  return namedForPort(portName, "hacked transport FAQ");',
  ].join('\n');
  assert.throws(
    () => assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly(badDiff),
    /outside FAQ overrides/,
  );
  const okDiff = [
    '@@ -1,1 +1,3 @@',
    '+const BATCH9_FAQ_DISTANCE_COPY = {',
    "+  'test-port':",
    "+    'short copy.',",
    '+};',
    '+    (portSlug && BATCH9_FAQ_DISTANCE_COPY[portSlug]) ||',
  ].join('\n');
  assert.doesNotThrow(() => assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly(okDiff));
});

test('FAQ cohort attribution drift outside FAQ blocks fails closed', () => {
  const {
    htmlWithFaqPublicationBlocksStripped,
    assertFaqCohortPushTouchesFaqBlocksOnly,
  } = require('./assert-ports-regen-banner-only-diff');
  const faqOnly = `<html><head><script type="application/ld+json">{"@type":"FAQPage","mainEntity":[]}</script></head><body><section class="pg-section" id="traveler-questions"><p>ok</p></section></body></html>`;
  const withHero = faqOnly.replace(
    '<body>',
    '<body><figure class="seo-hero"><figcaption>CC BY-SA 4.0</figcaption></figure>',
  );
  assert.notStrictEqual(
    htmlWithFaqPublicationBlocksStripped(faqOnly),
    htmlWithFaqPublicationBlocksStripped(withHero),
  );
});

test('portGuideSections plus non-port-index path still fails closed', () => {
  assert.throws(
    () =>
      resolveGenerationPlan({
        eventName: 'push',
        changedFiles: ['scripts/lib/portGuideSections.js', 'data/public-port-guides.json'],
      }),
    /fail closed/,
  );
});

test('generateBlogs.js with port directory scripts selects ports-only, not full', () => {
  const plan = classifyChangedFiles([
    'scripts/generateBlogs.js',
    'scripts/lib/portsDirectoryIndex.js',
    'scripts/regenerate-ports-index.js',
  ]);
  assert.strictEqual(plan.channel, 'ports');
  assert.strictEqual(plan.ports, true);
  assert.strictEqual(plan.blogs, false);
  assert.strictEqual(plan.ships, false);
});

test('committed ports/index.html release suppresses push generation', () => {
  const plan = resolveGenerationPlan({
    eventName: 'push',
    changedFiles: [
      'ports/index.html',
      'scripts/generateBlogs.js',
      'scripts/lib/portsDirectoryIndex.js',
      'data/ports-directory-country-images.json',
      'assets/css/site-shell.css',
    ],
  });
  assert.strictEqual(plan.skip, true);
  assert.strictEqual(plan.channel, 'skip');
});

test('public-port-guides dataset change with index does not suppress push', () => {
  const plan = resolveGenerationPlan({
    eventName: 'push',
    changedFiles: ['ports/index.html', 'data/public-port-guides.json'],
  });
  assert.strictEqual(plan.skip, false);
  assert.strictEqual(plan.channel, 'ports');
});

test('daily schedule is blogs-only for CMS pickup', () => {
  const plan = resolveGenerationPlan({ eventName: 'schedule', changedFiles: ['index.html'] });
  assert.strictEqual(plan.channel, 'blogs');
  assert.strictEqual(plan.ports, false);
});

test('manual full rebuild can opt into orphan cleanup', () => {
  const plan = resolveGenerationPlan({
    eventName: 'workflow_dispatch',
    dispatchChannel: 'full',
    allowOrphanCleanup: true,
  });
  assert.strictEqual(plan.channel, 'full');
  assert.strictEqual(plan.allowOrphanCleanup, true);
});

test('generated content paths do not themselves trigger regeneration', () => {
  const plan = classifyChangedFiles([
    'blog/some-slug/index.html',
    'ports/hamburg-germany/index.html',
    'ships/aidacosma/index.html',
    'sitemap.xml',
  ]);
  assert.strictEqual(plan.skip, true);
});

test('exact-path guard suppresses push when manifest exists at HEAD', () => {
  const fs = require('fs');
  const os = require('os');
  const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-guard-classify-'));
  const guardDir = path.join(dir, '.github');
  fs.mkdirSync(guardDir, { recursive: true });
  const exactPaths = [
    '.github/ci-generation-release-guard.json',
    'scripts/generateBlogs.js',
  ];
  fs.writeFileSync(
    path.join(guardDir, 'ci-generation-release-guard.json'),
    JSON.stringify({ profile: 'test', exactPaths }, null, 2),
  );
  const prev = process.cwd();
  process.chdir(dir);
  try {
    const plan = resolveGenerationPlan({
      eventName: 'push',
      changedFiles: exactPaths,
    });
    assert.strictEqual(plan.skip, true);
  } finally {
    process.chdir(prev);
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

console.log('ci-classify tests passed');

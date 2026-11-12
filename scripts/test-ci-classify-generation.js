#!/usr/bin/env node
'use strict';

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

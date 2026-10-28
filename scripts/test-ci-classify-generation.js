#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  classifyChangedFiles,
  resolveGenerationPlan,
} = require('./lib/ciClassifyGeneration');

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

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  evaluatePushReleaseGuard,
  loadReleaseGuard,
} = require('./lib/ciGenerationReleaseGuard');
const { resolveGenerationPlan } = require('./lib/ciClassifyGeneration');

const GUEST_REVIEW_EXACT = [
  '.github/ci-generation-release-guard.json',
  'package.json',
  'ports/halifax-ns-canada/index.html',
  'scripts/generateBlogs.js',
  'scripts/lib/ciClassifyGeneration.js',
  'scripts/lib/ciGenerationReleaseGuard.js',
  'scripts/lib/generateMode.js',
  'scripts/lib/guestReviewsSection.js',
  'scripts/lib/portGuideSections.js',
  'scripts/lib/seoShipPortPages.js',
  'scripts/test-ci-classify-generation.js',
  'scripts/test-ci-generation-release-guard.js',
  'scripts/test-generate-mode.js',
  'scripts/test-generate-only-slugs.js',
  'scripts/test-guest-reviews-section.js',
  'ships/celebrity-solstice/index.html',
];

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

function withTempGuard(body, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-guard-'));
  const guardDir = path.join(dir, '.github');
  fs.mkdirSync(guardDir, { recursive: true });
  fs.writeFileSync(path.join(guardDir, 'ci-generation-release-guard.json'), JSON.stringify(body, null, 2));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test('no guard file leaves push classification unchanged', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-noguard-'));
  try {
    assert.strictEqual(evaluatePushReleaseGuard(['scripts/generateBlogs.js'], { repoRoot: dir }), null);
    const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: ['scripts/generateBlogs.js'] });
    assert.strictEqual(plan.channel, 'full');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('exact approved Guest Reviews file set suppresses push generation', () => {
  withTempGuard({ profile: 'guest-reviews-code-only', exactPaths: GUEST_REVIEW_EXACT }, (dir) => {
    const verdict = evaluatePushReleaseGuard(GUEST_REVIEW_EXACT, { repoRoot: dir });
    assert.strictEqual(verdict.action, 'suppress');
    const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: GUEST_REVIEW_EXACT });
    assert.strictEqual(plan.skip, true);
    assert.strictEqual(plan.channel, 'skip');
  });
});

test('approved set plus extra file does not suppress (fail open to normal classify)', () => {
  withTempGuard({ profile: 'guest-reviews-code-only', exactPaths: GUEST_REVIEW_EXACT }, (dir) => {
    const changed = [...GUEST_REVIEW_EXACT, 'blog/foo/index.html'];
    assert.strictEqual(evaluatePushReleaseGuard(changed, { repoRoot: dir }), null);
    const plan = resolveGenerationPlan({ eventName: 'push', changedFiles: changed });
    assert.strictEqual(plan.channel, 'full');
  });
});

test('partial guest-review paths without exact set does not suppress', () => {
  withTempGuard({ profile: 'guest-reviews-code-only', exactPaths: GUEST_REVIEW_EXACT }, (dir) => {
    assert.strictEqual(
      evaluatePushReleaseGuard(['scripts/generateBlogs.js', 'package.json'], { repoRoot: dir }),
      null
    );
  });
});

test('schedule and workflow_dispatch ignore release guard', () => {
  withTempGuard({ profile: 'guest-reviews-code-only', exactPaths: GUEST_REVIEW_EXACT }, () => {
    const sched = resolveGenerationPlan({ eventName: 'schedule', changedFiles: GUEST_REVIEW_EXACT });
    assert.strictEqual(sched.channel, 'blogs');
    const manual = resolveGenerationPlan({
      eventName: 'workflow_dispatch',
      dispatchChannel: 'catalogue',
      changedFiles: GUEST_REVIEW_EXACT,
    });
    assert.strictEqual(manual.channel, 'catalogue');
  });
});

test('malformed guard JSON fails closed', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-badguard-'));
  fs.mkdirSync(path.join(dir, '.github'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.github/ci-generation-release-guard.json'), '{not-json');
  try {
    const loaded = loadReleaseGuard(dir);
    assert.ok(loaded.error);
    const verdict = evaluatePushReleaseGuard(['scripts/generateBlogs.js'], { repoRoot: dir });
    assert.strictEqual(verdict.action, 'reject');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('guard missing exactPaths self-entry is rejected at load', () => {
  withTempGuard(
    {
      profile: 'guest-reviews-code-only',
      exactPaths: GUEST_REVIEW_EXACT.filter((p) => !p.includes('ci-generation-release-guard')),
    },
    (dir) => {
      const loaded = loadReleaseGuard(dir);
      assert.ok(loaded.error);
    }
  );
});

console.log('ci-generation-release-guard tests passed');

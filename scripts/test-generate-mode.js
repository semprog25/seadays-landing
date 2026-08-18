#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { parseGenerateMode, generateArgsForChannel } = require('./lib/generateMode');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('default is full generation without orphan cleanup', () => {
  const mode = parseGenerateMode(['node', 'scripts/generateBlogs.js']);
  assert.strictEqual(mode.full, true);
  assert.strictEqual(mode.blogs, true);
  assert.strictEqual(mode.ships, true);
  assert.strictEqual(mode.ports, true);
  assert.strictEqual(mode.allowOrphanCleanup, false);
});

test('--blogs-only does not write ships/ports or run orphan cleanup', () => {
  const mode = parseGenerateMode(['node', 'x', '--blogs-only']);
  assert.strictEqual(mode.blogs, true);
  assert.strictEqual(mode.ships, false);
  assert.strictEqual(mode.ports, false);
  assert.strictEqual(mode.allowOrphanCleanup, false);
});

test('--ports-only does not rewrite blogs', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only']);
  assert.strictEqual(mode.blogs, false);
  assert.strictEqual(mode.ports, true);
  assert.strictEqual(mode.ships, false);
});

test('--catalogue-only writes ships+ports without blogs', () => {
  const mode = parseGenerateMode(['node', 'x', '--catalogue-only']);
  assert.strictEqual(mode.blogs, false);
  assert.strictEqual(mode.ships, true);
  assert.strictEqual(mode.ports, true);
  assert.strictEqual(mode.allowOrphanCleanup, false);
});

test('orphan cleanup is ignored unless catalogue writes are in scope', () => {
  const blogs = parseGenerateMode(['node', 'x', '--blogs-only', '--allow-orphan-cleanup']);
  assert.strictEqual(blogs.allowOrphanCleanup, false);
  const full = parseGenerateMode(['node', 'x', '--full', '--allow-orphan-cleanup']);
  assert.strictEqual(full.allowOrphanCleanup, true);
});

test('--sitemap-only is a no-write content mode', () => {
  const mode = parseGenerateMode(['node', 'x', '--sitemap-only']);
  assert.strictEqual(mode.sitemapOnly, true);
  assert.strictEqual(mode.blogs, false);
  assert.strictEqual(mode.ships, false);
  assert.strictEqual(mode.ports, false);
});

test('--only= scopes catalogue rewrites without changing channel flags', () => {
  const mode = parseGenerateMode([
    'node',
    'x',
    '--catalogue-only',
    '--only=celebrity-solstice,molde-norway',
  ]);
  assert.strictEqual(mode.ships, true);
  assert.strictEqual(mode.ports, true);
  assert.strictEqual(mode.blogs, false);
  assert.deepStrictEqual(mode.onlySlugs, ['celebrity-solstice', 'molde-norway']);
});

test('--allow-orphan-cleanup is the only way to enable destructive cleanup', () => {
  const src = require('fs').readFileSync(require('path').join(__dirname, 'generateBlogs.js'), 'utf8');
  if (!src.includes('if (mode.allowOrphanCleanup)')) {
    throw new Error('generateBlogs.js must gate removeOrphanShipPortDirectories behind allowOrphanCleanup');
  }
  if (!src.includes('skipping orphan catalogue cleanup')) {
    throw new Error('generateBlogs.js must skip orphan cleanup by default');
  }
});

test('channel args never enable orphan cleanup unless requested', () => {
  assert.deepStrictEqual(generateArgsForChannel('blogs'), ['--blogs-only']);
  assert.deepStrictEqual(generateArgsForChannel('ports'), ['--ports-only']);
  assert.deepStrictEqual(generateArgsForChannel('full'), ['--full']);
  assert.deepStrictEqual(
    generateArgsForChannel('full', { allowOrphanCleanup: true }),
    ['--full', '--allow-orphan-cleanup']
  );
});

console.log('generate-mode tests passed');

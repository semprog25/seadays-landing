#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  parseGenerateMode,
  validateTargetedOnlyMode,
  assertOnlySlugsResolvable,
  shouldWriteShipDetail,
  shouldWritePortDetail,
} = require('./lib/generateMode');

function test(name, fn) {
  try {
    fn();
    console.log('PASS', name);
  } catch (e) {
    console.error('FAIL', name, e.message);
    process.exitCode = 1;
  }
}

test('validateTargetedOnlyMode rejects --only with blogs', () => {
  const mode = parseGenerateMode(['node', 'x', '--full', '--only=celebrity-solstice']);
  assert.throws(() => validateTargetedOnlyMode(mode), /--only= cannot be combined with blog generation/);
});

test('validateTargetedOnlyMode rejects orphan cleanup with --only', () => {
  const mode = parseGenerateMode([
    'node',
    'x',
    '--catalogue-only',
    '--only=celebrity-solstice',
    '--allow-orphan-cleanup',
  ]);
  assert.throws(() => validateTargetedOnlyMode(mode), /--allow-orphan-cleanup/);
});

test('assertOnlySlugsResolvable requires known slugs', () => {
  const mode = parseGenerateMode(['node', 'x', '--ships-only', '--only=not-a-real-slug-ever']);
  assert.throws(
    () => assertOnlySlugsResolvable(mode, new Set(['celebrity-solstice']), new Set(['halifax-ns-canada'])),
    /not a known ship or port slug/
  );
});

test('shouldWriteShipDetail respects --only=', () => {
  const mode = parseGenerateMode(['node', 'x', '--ships-only', '--only=celebrity-solstice']);
  assert.strictEqual(shouldWriteShipDetail(mode, 'celebrity-solstice'), true);
  assert.strictEqual(shouldWriteShipDetail(mode, 'aidacosma'), false);
});

test('shouldWritePortDetail respects --only=', () => {
  const mode = parseGenerateMode(['node', 'x', '--ports-only', '--only=halifax-ns-canada']);
  assert.strictEqual(shouldWritePortDetail(mode, 'halifax-ns-canada'), true);
  assert.strictEqual(shouldWritePortDetail(mode, 'molde-norway'), false);
});

test('catalogue-only with two slugs resolves ship and port', () => {
  const mode = parseGenerateMode([
    'node',
    'x',
    '--catalogue-only',
    '--only=celebrity-solstice,halifax-ns-canada',
  ]);
  validateTargetedOnlyMode(mode);
  assertOnlySlugsResolvable(
    mode,
    new Set(['celebrity-solstice']),
    new Set(['halifax-ns-canada'])
  );
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('generate-only-slugs tests passed');

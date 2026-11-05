#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function normalizePortsIndexHtml(html) {
  return String(html || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function readMarkers(html) {
  return {
    verified: (html.match(/data-verified-photo="1"/g) || []).length,
    bookable: (html.match(/data-bookable="1"/g) || []).length,
    items: (html.match(/data-item="/g) || []).length,
    devPreview: html.includes('seadays-dev-preview'),
    reviewPromo: (html.match(/Want the full reviews/g) || []).length,
    guardNoPhoto: html.includes("var FB='/assets/img/ports-directory/seadays-no-image.webp'"),
  };
}

const sourceRoot = path.join(__dirname, '..');
const mainNodeModules = path.join(sourceRoot, '..', '..', 'node_modules');
const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-ports-parity-'));
const repoRoot = tempRoot;

execFileSync('rsync', ['-a', '--exclude', 'node_modules', '--exclude', '.git', `${sourceRoot}/`, `${repoRoot}/`], {
  stdio: 'pipe',
});
if (fs.existsSync(mainNodeModules)) {
  fs.symlinkSync(mainNodeModules, path.join(repoRoot, 'node_modules'));
}

const indexPath = path.join(repoRoot, 'ports', 'index.html');
const env = { ...process.env, SEADAYS_PORTS_INDEX_ONLY: '1' };

try {
  execFileSync('node', ['scripts/regenerate-ports-index.js'], { cwd: repoRoot, stdio: 'pipe', env });
  const regen1 = fs.readFileSync(indexPath, 'utf8');
  execFileSync('node', ['scripts/regenerate-ports-index.js'], { cwd: repoRoot, stdio: 'pipe', env });
  const regen2 = fs.readFileSync(indexPath, 'utf8');
  assert(normalizePortsIndexHtml(regen1) === normalizePortsIndexHtml(regen2), 'regenerate twice must match');

  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env,
    maxBuffer: 25 * 1024 * 1024,
  });
  const gen1 = fs.readFileSync(indexPath, 'utf8');
  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env,
    maxBuffer: 25 * 1024 * 1024,
  });
  const gen2 = fs.readFileSync(indexPath, 'utf8');
  assert(normalizePortsIndexHtml(gen1) === normalizePortsIndexHtml(gen2), 'generateBlogs --ports-only twice must match');

  const mRegen = readMarkers(regen2);
  const mGen = readMarkers(gen2);
  assert(mRegen.verified === mGen.verified, `verified photos regen=${mRegen.verified} gen=${mGen.verified}`);
  assert(mRegen.bookable === mGen.bookable, `bookable flags regen=${mRegen.bookable} gen=${mGen.bookable}`);
  assert(mRegen.items === mGen.items && mRegen.items === 406, `port items (got regen=${mRegen.items} gen=${mGen.items})`);
  assert(!mRegen.devPreview && !mGen.devPreview, 'no dev preview markers');
  assert(mRegen.reviewPromo === 1 && mGen.reviewPromo === 1, 'single review promo');
  assert(mRegen.guardNoPhoto && mGen.guardNoPhoto, 'directory runtime guard uses seadays-no-image fallback');

  assert(
    normalizePortsIndexHtml(regen2) === normalizePortsIndexHtml(gen2),
    'regenerate and generateBlogs --ports-only must produce identical ports/index.html'
  );

  console.log('OK test-ports-index-generator-parity', { regen: mRegen, gen: mGen, tempRoot });
} finally {
  fs.rmSync(tempRoot, { recursive: true, force: true });
}

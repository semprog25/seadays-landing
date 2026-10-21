#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const scriptPath = path.join(__dirname, 'cms-reconciliation-dry-run.js');

function runDryRun(env, landingRoot) {
  return spawnSync(process.execPath, [scriptPath], {
    cwd: ROOT,
    env: {
      ...process.env,
      SEADAYS_LANDING_ROOT: landingRoot,
      SEADAYS_APP_ROOT: '',
      SUPABASE_ANON_KEY: '',
      VITE_SUPABASE_ANON_KEY: '',
      ...env,
    },
    encoding: 'utf8',
  });
}

const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cms-dry-run-'));
const metaDir = path.join(tmp, 'data', 'blog-body-overrides');
fs.mkdirSync(metaDir, { recursive: true });
fs.writeFileSync(path.join(metaDir, 'meta.json'), JSON.stringify({ 'sample-slug': {} }));
fs.writeFileSync(path.join(metaDir, 'sample-slug.html'), '<p>test</p>');
fs.writeFileSync(
  path.join(tmp, 'data', 'blog-article-corrections.json'),
  JSON.stringify({ titleBySourceSlug: {} })
);
fs.mkdirSync(path.join(tmp, 'docs'), { recursive: true });
fs.writeFileSync(
  path.join(tmp, 'data', 'cms-reconciliation-manifest.json'),
  JSON.stringify({ complete: true, overrideCount: 1, articles: [{}] })
);
fs.writeFileSync(
  path.join(tmp, 'docs', 'cms-reconciliation-dry-run.md'),
  '# CMS reconciliation dry run\n\n## Full manifest\n\n| sample |\n'
);

const blocked = runDryRun({}, tmp);
assert.strictEqual(blocked.status, 2, 'must refuse to overwrite complete manifest without key');
assert.match(blocked.stderr, /Refusing to overwrite complete manifest/);

const fresh = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cms-dry-run-fresh-'));
fs.mkdirSync(path.join(fresh, 'data', 'blog-body-overrides'), { recursive: true });
fs.writeFileSync(path.join(fresh, 'data', 'blog-body-overrides', 'meta.json'), JSON.stringify({ x: {} }));
fs.writeFileSync(path.join(fresh, 'data', 'blog-body-overrides', 'x.html'), '<p>x</p>');
fs.writeFileSync(
  path.join(fresh, 'data', 'blog-article-corrections.json'),
  JSON.stringify({ titleBySourceSlug: {} })
);
fs.mkdirSync(path.join(fresh, 'docs'), { recursive: true });
const stop = runDryRun({}, fresh);
assert.strictEqual(stop.status, 1, 'fresh repo without key should STOP');
assert.match(stop.stderr || stop.stdout, /STOP:/);
assert.ok(
  !fs.existsSync(path.join(fresh, 'data', 'cms-reconciliation-manifest.json')),
  'must not write JSON manifest without credentials'
);

console.log('test-cms-reconciliation-dry-run: PASS');

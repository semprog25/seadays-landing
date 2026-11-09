#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { sha256File, verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { buildCompositeResearchRoot } = require('./lib/portResearchImport/researchRootComposite');

const REPO = path.join(__dirname, '..');
const PATCH = path.join(REPO, 'qa-evidence/stage67-yaml-repair-48/PORTS_MASTER_INDEX_SHA_PATCH.json');
const FIXTURE = path.join(REPO, 'scripts/fixtures/stage67-select-skipped.json');

const INDEX_SOURCE =
  process.env.PORT_RESEARCH_INDEX_SOURCE ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06/final/PORTS_MASTER_INDEX.json';
const BY_PORT_ROOT = process.env.PORT_RESEARCH_BY_PORT_ROOT || '/tmp/seadays-research-f4552cf';

function loadCohortSlugs() {
  return JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).bootstrapSkipped.map((r) => r.landing_slug);
}

assert.ok(fs.existsSync(PATCH), `run stage67-reconcile-repaired-48.js first; missing ${PATCH}`);

const patchArtifact = JSON.parse(fs.readFileSync(PATCH, 'utf8'));
const slugs = loadCohortSlugs();
assert.strictEqual(slugs.length, 48);
assert.strictEqual(patchArtifact.reconciled_count, 48);
assert.strictEqual(Object.keys(patchArtifact.sha_patch).length, 48);

const baseline = JSON.parse(fs.readFileSync(INDEX_SOURCE, 'utf8'));
const cohortSet = new Set(slugs);
let untouched = 0;
for (const row of baseline.ports) {
  if (cohortSet.has(row.slug)) continue;
  const md = path.join(BY_PORT_ROOT, 'by-port', `${row.slug}.md`);
  if (!fs.existsSync(md)) continue;
  if (sha256File(md) !== row.sha256) {
    throw new Error(`non-cohort sha drift unexpected: ${row.slug}`);
  }
  untouched += 1;
}
assert.ok(untouched >= 350, `expected >=350 untouched index/file matches, got ${untouched}`);

const workDir = fs.mkdtempSync(path.join(require('os').tmpdir(), 'seadays-research-test-'));
const { compositeRoot } = buildCompositeResearchRoot({
  byPortRoot: BY_PORT_ROOT,
  indexSourcePath: INDEX_SOURCE,
  shaPatchBySlug: patchArtifact.sha_patch,
  workDir,
});

for (const slug of slugs) {
  const sha = verifyResearchPortSha({
    researchRoot: compositeRoot,
    landingSlug: slug,
    manifestRow: { landing_slug: slug, sha256: patchArtifact.sha_patch[slug] },
  });
  assert.ok(sha.ok, `${slug}: ${sha.reason}`);
}

const guidesBefore = fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'));
assert.ok(guidesBefore.length > 1000);

const summaryPath = path.join(REPO, 'qa-evidence/stage67-yaml-repair-48/RECONCILE_SUMMARY.json');
if (fs.existsSync(summaryPath)) {
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
  assert.strictEqual(summary.reconciled_sha_count, 48);
  assert.ok((summary.bootstrap_apply_ready_slugs || []).indexOf('falmouth-jamaica') === -1);
}

console.log('test-stage67-repaired-48-sha-reconciliation PASS');

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  ALLOWED_RERUN_EVIDENCE_REL,
  BASELINE_INPUT_REL,
  CURATED_IMPROVE,
  boilerShare,
  buildClassifierContext,
  classify,
  runDryRun,
  validateEvidenceOutputPath,
} = require('./qa/adsense-port-ship-indexing-dry-run');

const repoRoot = path.join(__dirname, '..');
const evidencePkg = path.join(repoRoot, ALLOWED_RERUN_EVIDENCE_REL);
const bundledSweep = path.join(evidencePkg, 'inputs/sd_sweep-live-2026-10-28.json');
const bundledBaselineCsv = path.join(repoRoot, BASELINE_INPUT_REL);

function parseCsv(text) {
  const lines = text.trim().split('\n');
  const header = lines[0].split(',');
  const recIdx = header.indexOf('recommendation');
  const slugIdx = header.indexOf('slug');
  const kindIdx = header.indexOf('kind');
  const rows = new Map();
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',');
    const key = `${cols[kindIdx]}:${cols[slugIdx]}`;
    rows.set(key, cols[recIdx]);
  }
  return rows;
}

function expectValidateFail(outDir, sweepPath, options, messageFragment) {
  const result = validateEvidenceOutputPath(outDir, sweepPath, options);
  assert.strictEqual(result.ok, false, 'expected validation failure');
  if (messageFragment) assert.ok(result.error.includes(messageFragment), result.error);
}

assert.ok(!CURATED_IMPROVE.has('marigot-st-maarten'), 'marigot must not be pinned to IMPROVE');
assert.ok(fs.existsSync(bundledSweep), 'bundled sweep required');
assert.ok(fs.existsSync(bundledBaselineCsv), 'bundled baseline CSV required');

const ctx = buildClassifierContext({ sweepBy: new Map() });
const marigotHtml = fs.readFileSync(path.join(repoRoot, 'ports/marigot-st-maarten/index.html'), 'utf8');
const marigotSweep = JSON.parse(fs.readFileSync(bundledSweep, 'utf8')).find((r) => r.u.includes('marigot-st-maarten'));
assert.ok(marigotSweep, 'bundled sweep must include marigot');
ctx.sweepBy.set('https://seadays.app/ports/marigot-st-maarten', marigotSweep);
const marigotClass = classify(
  {
    kind: 'port',
    slug: 'marigot-st-maarten',
    url: 'https://seadays.app/ports/marigot-st-maarten/',
    html: marigotHtml,
  },
  ctx
);
assert.strictEqual(marigotClass.recommendation, 'KEEP_INDEX');
assert.ok(!/curated legacy template/.test(marigotClass.rationale));

const thinSlug = 'synthetic-thin-template-test';
const thinUrl = `https://seadays.app/ports/${thinSlug}`;
ctx.sweepBy.set(thinUrl, {
  w: 300,
  sents: ['on a call at marigot pier', 'on a call at the tender', 'one unique sentence about docks'],
});
const thin = classify(
  {
    kind: 'port',
    slug: thinSlug,
    url: `${thinUrl}/`,
    html: '<details class="pg-terminal-card"></details>',
  },
  ctx
);
assert.strictEqual(thin.recommendation, 'NOINDEX_CANDIDATE');

assert.ok(boilerShare(['on a call at foo', 'on a call at bar', 'unique prose about pier seven']) > 0.15);

const scriptSrc = fs.readFileSync(path.join(__dirname, 'qa/adsense-port-ship-indexing-dry-run.js'), 'utf8');
assert.ok(!/ADSENSE_INDEXING_APPLY/.test(scriptSrc));
assert.ok(!/Seadays-trust-boundary/.test(scriptSrc));

expectValidateFail(bundledSweep, bundledSweep, {}, 'sweep file path');
expectValidateFail(path.join(evidencePkg, 'inputs'), bundledSweep, {}, 'bundled inputs directory');
expectValidateFail(
  path.join(repoRoot, 'qa-evidence/adsense-indexing-dry-run-2026-10-28'),
  bundledSweep,
  {},
  'frozen audit evidence'
);
expectValidateFail(
  path.join(repoRoot, 'qa-evidence', 'adsense-indexing-dry-run-unsafe-test'),
  bundledSweep,
  { allowEvidenceRerun: true },
  'only permitted for the marigot-corrected'
);

const missingSweep = spawnSync(
  process.execPath,
  [
    path.join(__dirname, 'qa/adsense-port-ship-indexing-dry-run.js'),
    '--sweep',
    path.join(repoRoot, 'inputs-does-not-exist.json'),
    '--out-dir',
    path.join(repoRoot, 'qa-evidence', 'dry-run-missing-sweep-test'),
  ],
  { encoding: 'utf8' }
);
assert.notStrictEqual(missingSweep.status, 0);
assert.match(missingSweep.stderr + missingSweep.stdout, /Missing sweep file/);

fs.mkdirSync(evidencePkg, { recursive: true });
for (const name of ['port-ship-classification.csv', 'classification-summary.json', 'classification-movements-vs-oct28-uncorrected.json']) {
  const p = path.join(evidencePkg, name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}

const summary = runDryRun({
  outDir: evidencePkg,
  sweepPath: bundledSweep,
  productionBase: '369b39db215bac6119543b37fe5cfab25b1e93e9',
});

assert.strictEqual(summary.results.length, 252);
assert.deepStrictEqual(summary.counts, {
  KEEP_INDEX: 54,
  IMPROVE: 78,
  NOINDEX_CANDIDATE: 120,
});

const baseline = parseCsv(fs.readFileSync(bundledBaselineCsv, 'utf8'));
const corrected = parseCsv(fs.readFileSync(path.join(evidencePkg, 'port-ship-classification.csv'), 'utf8'));
const movements = [];
for (const [key, oldRec] of baseline.entries()) {
  const newRec = corrected.get(key);
  assert.ok(newRec, `missing row in corrected output: ${key}`);
  if (oldRec !== newRec) movements.push({ key, oldRec, newRec });
}
assert.strictEqual(movements.length, 1);
assert.strictEqual(movements[0].key, 'port:marigot-st-maarten');
assert.strictEqual(movements[0].oldRec, 'IMPROVE');
assert.strictEqual(movements[0].newRec, 'KEEP_INDEX');

fs.writeFileSync(
  path.join(evidencePkg, 'classification-movements-vs-oct28-uncorrected.json'),
  JSON.stringify(
    {
      baseline_csv: BASELINE_INPUT_REL,
      movements,
      counts_before: { KEEP_INDEX: 53, IMPROVE: 79, NOINDEX_CANDIDATE: 120 },
      counts_after: summary.counts,
    },
    null,
    2
  )
);

console.log('test-adsense-port-ship-indexing-dry-run: PASS');

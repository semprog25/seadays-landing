#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  restoreProductionFromSlugRollback,
  writeApplyInProgressMarker,
  recoverInterruptedSlugApplies,
  hasInterruptedApply,
} = require('./lib/bulkPortPublication/publicationBatchApplySafety');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards');

const REPO = path.join(__dirname, '..');

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function withTempRepo(fn) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-apply-safety-'));
  const guidesDir = path.join(tmp, 'data');
  const portDir = path.join(tmp, 'ports', 'stub-port');
  fs.mkdirSync(guidesDir, { recursive: true });
  fs.mkdirSync(portDir, { recursive: true });
  const guidesPath = path.join(guidesDir, 'public-port-guides.json');
  const guides = {
    byAppPortId: {
      stub: { portInfo: { name: 'Stub' }, researchImport: { landing_slug: 'stub-port' } },
    },
  };
  fs.writeFileSync(guidesPath, `${JSON.stringify(guides, null, 2)}\n`);
  fs.writeFileSync(path.join(portDir, 'index.html'), '<html><head><meta name="robots" content="noindex, follow"></head></html>');
  try {
    fn(tmp, guidesPath, portDir);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function testRestoreRoundTrip() {
  withTempRepo((tmp, guidesPath, portDir) => {
    const rollbackDir = path.join(tmp, 'qa-evidence', 'rollback-pre-apply', 'stub-port');
    fs.mkdirSync(path.join(rollbackDir, 'ports', 'stub-port'), { recursive: true });
    const beforeGuidesSha = sha256File(guidesPath);
    fs.copyFileSync(guidesPath, path.join(rollbackDir, 'public-port-guides.json'));
    fs.copyFileSync(path.join(portDir, 'index.html'), path.join(rollbackDir, 'ports', 'stub-port', 'index.html'));

    fs.writeFileSync(guidesPath, '{"byAppPortId":{"stub":{"dirty":true}}}\n');
    fs.writeFileSync(path.join(portDir, 'index.html'), '<html>dirty</html>');

    restoreProductionFromSlugRollback(tmp, rollbackDir, 'stub-port');
    assert.strictEqual(sha256File(guidesPath), beforeGuidesSha);
    assert.ok(/noindex/i.test(fs.readFileSync(path.join(portDir, 'index.html'), 'utf8')));
  });
}

function testRecoverInterruptedMarker() {
  withTempRepo((tmp) => {
    const evidenceRoot = path.join(tmp, 'qa-evidence', 'publication-batch-01');
    const rollbackDir = path.join(evidenceRoot, 'rollback-pre-apply', 'stub-port');
    fs.mkdirSync(path.join(rollbackDir, 'ports', 'stub-port'), { recursive: true });
    const guidesPath = path.join(tmp, 'data/public-port-guides.json');
    fs.copyFileSync(guidesPath, path.join(rollbackDir, 'public-port-guides.json'));
    fs.writeFileSync(guidesPath, '{"byAppPortId":{"stub":{"dirty":true}}}\n');
    writeApplyInProgressMarker(rollbackDir, 'stub-port');
    assert.ok(hasInterruptedApply(rollbackDir));

    const result = recoverInterruptedSlugApplies(tmp, evidenceRoot);
    assert.deepStrictEqual(result.recovered, ['stub-port']);
    assert.ok(!hasInterruptedApply(rollbackDir));
    const guides = JSON.parse(fs.readFileSync(guidesPath, 'utf8'));
    assert.ok(guides.byAppPortId.stub.portInfo, 'restored guides');
  });
}

function testInjectedFailureRestoresProduction() {
  const guidesBefore = sha256File(path.join(REPO, 'data/public-port-guides.json'));
  const prepPath = path.join(REPO, 'qa-evidence/publication-batch-01/PREP_MANIFEST.json');
  assert.ok(fs.existsSync(prepPath), 'run publication-batch prepare first');

  const slug = 'mumbai-india';
  const rollbackDir = path.join(REPO, 'qa-evidence/publication-batch-01/rollback-pre-apply', slug);
  fs.mkdirSync(path.join(rollbackDir, 'ports', slug), { recursive: true });
  fs.copyFileSync(
    path.join(REPO, 'data/public-port-guides.json'),
    path.join(rollbackDir, 'public-port-guides.json')
  );
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
  if (fs.existsSync(htmlPath)) {
    fs.copyFileSync(htmlPath, path.join(rollbackDir, 'ports', slug, 'index.html'));
  }
  writeApplyInProgressMarker(rollbackDir, slug);

  const env = {
    ...process.env,
    SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1',
    SEADAYS_PUBLICATION_BATCH_INJECT_FAIL: 'after_guides_write',
  };

  try {
    require('child_process').execSync('node scripts/publication-batch-workflow.js apply', {
      cwd: REPO,
      env,
      stdio: 'pipe',
    });
    assert.fail('expected injected failure');
  } catch (err) {
    const out = String(err.stdout || '') + String(err.stderr || '');
    assert.ok(/injected failure|BATCH_APPLY_STOP/i.test(out + err.message));
  }

  const recovered = recoverInterruptedSlugApplies(REPO, path.join(REPO, 'qa-evidence/publication-batch-01'));
  assert.ok(recovered.recovered.includes(slug) || !hasInterruptedApply(rollbackDir));

  const guidesAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'));
  assert.strictEqual(guidesAfter, guidesBefore, 'production guides restored after injected failure');

  const guides = loadPublicPortGuidesFile(REPO);
  removeStage65ExcludedGuideEntries(guides);
  assert.strictEqual(countPassengerEditorialGuides(guides), 356);
}

function testApplyIdempotentSecondRun() {
  const guidesBefore = sha256File(path.join(REPO, 'data/public-port-guides.json'));
  const env = { ...process.env, SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1' };
  require('child_process').execSync('node scripts/publication-batch-workflow.js apply', {
    cwd: REPO,
    env,
    stdio: 'pipe',
  });
  const guidesAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'));
  assert.strictEqual(guidesAfter, guidesBefore, 'second apply leaves production guides unchanged');
}

function main() {
  testRestoreRoundTrip();
  testRecoverInterruptedMarker();
  testInjectedFailureRestoresProduction();
  testApplyIdempotentSecondRun();
  console.log('test-publication-batch-apply-safety PASS');
}

main();

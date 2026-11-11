#!/usr/bin/env node
'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards');
const { STAGE43_HARD_EXCLUDE_HISTORICAL } = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { assertHistoricalPolicyPublicationGate: assertGate } = require('./lib/bulkPortPublication/historicalPolicyPublicationGate');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/publication-batch-01');
const MANIFEST_PATH = path.join(EVIDENCE, 'BATCH_01_MANIFEST.json');

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function headJsonLdTypeCounts(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0];
  const counts = { TouristDestination: 0, BreadcrumbList: 0, FAQPage: 0 };
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(head))) {
    try {
      const data = JSON.parse(m[1].trim());
      const type = data && data['@type'];
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
    } catch {
      /* skip */
    }
  }
  return counts;
}

function assertProductionUnchanged(slugs) {
  const guides = loadPublicPortGuidesFile(REPO);
  removeStage65ExcludedGuideEntries(guides);
  assert.strictEqual(countPassengerEditorialGuides(guides), 356);
  for (const slug of slugs) {
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    if (!fs.existsSync(htmlPath)) continue;
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(/noindex/i.test(html), `${slug} production html must stay noindex stub`);
    const callPlans = (html.match(/<article class="pg-call-plan-card/g) || []).length;
    assert.ok(callPlans < 3, `${slug} production must not have 3 call plans`);
  }
  delete process.env.SEADAYS_PUBLICATION_BATCH_01_CANDIDATE;
  delete process.env.SEADAYS_STAGE89_BODO_CANDIDATE;
  assertGate(REPO, guides);
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  assert.strictEqual(manifest.owner_publication_authorized, false);
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 356);
  assert.strictEqual(manifest.candidates.length, 4);

  const matrixPath = path.join(EVIDENCE, 'REMAINING_PORT_STATUS_MATRIX.json');
  assert.ok(fs.existsSync(matrixPath), 'run publication-batch-workflow matrix first');
  const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
  assert.strictEqual(matrix.baseline.live_passenger_editorial, 356);
  assert.strictEqual(matrix.baseline.remaining_unpublished, 50);
  assert.ok(matrix.baseline.reconcile, '356 + 50 must equal 406');

  const batchSlugs = manifest.candidates.map((c) => c.landing_slug);
  for (const slug of batchSlugs) {
    assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug), `${slug} historical hold`);
    const row = matrix.rows.find((r) => r.landing_slug === slug);
    assert.ok(row, `matrix row ${slug}`);
    assert.strictEqual(row.policy_status, 'historical_stage43_policy_held');
  }
  assert.ok(!batchSlugs.includes('eilat-israel'), 'eilat deferred');

  const prepPath = path.join(EVIDENCE, 'PREP_MANIFEST.json');
  const applyPath = path.join(EVIDENCE, 'APPLY_REPORT.json');
  if (!fs.existsSync(prepPath) || !fs.existsSync(applyPath)) {
    execSync('node scripts/publication-batch-workflow.js prepare', { cwd: REPO, stdio: 'inherit' });
    execSync('node scripts/publication-batch-workflow.js apply', {
      cwd: REPO,
      stdio: 'inherit',
      env: { ...process.env, SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1' },
    });
  }

  const prep = JSON.parse(fs.readFileSync(prepPath, 'utf8'));
  assert.strictEqual(prep.candidates.length, 4);

  const prodGuidesBefore = sha256File(path.join(REPO, 'data/public-port-guides.json'));

  for (const candidate of manifest.candidates) {
    const candDir = path.join(EVIDENCE, 'candidates', candidate.landing_slug);
    const htmlPath = path.join(candDir, 'ports', candidate.landing_slug, 'index.html');
    const guidePath = path.join(candDir, `byAppPortId.${candidate.app_port_id}.json`);
    assert.ok(fs.existsSync(htmlPath), `candidate html ${candidate.landing_slug}`);
    assert.ok(fs.existsSync(guidePath), `candidate guide ${candidate.landing_slug}`);

    const html = fs.readFileSync(htmlPath, 'utf8');
    const callPlans = (html.match(/<article class="pg-call-plan-card/g) || []).length;
    assert.ok(callPlans >= 3, `${candidate.landing_slug} needs 3 call plans, got ${callPlans}`);
    assert.ok(/noindex/i.test(html), `${candidate.landing_slug} candidate stays noindex`);

    const ld = headJsonLdTypeCounts(html);
    assert.strictEqual(ld.TouristDestination, 1, `${candidate.landing_slug} TouristDestination`);
    assert.strictEqual(ld.BreadcrumbList, 1, `${candidate.landing_slug} BreadcrumbList`);
    assert.strictEqual(ld.FAQPage, 1, `${candidate.landing_slug} FAQPage`);

    const guide = JSON.parse(fs.readFileSync(guidePath, 'utf8'));
    assert.strictEqual(guide.researchImport?.research_sha256, candidate.research_sha256);
    assert.strictEqual(guide.researchImport?.qa_verdict, 'PASS');
    assert.strictEqual(guide.researchImport?.owner_publication_authorized, false);

    if (candidate.viator_campaign) {
      assert.ok(html.includes(candidate.viator_campaign), `Viator campaign ${candidate.viator_campaign}`);
    }
  }

  assertProductionUnchanged(batchSlugs);
  const prodGuidesAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'));
  assert.strictEqual(prodGuidesAfter, prodGuidesBefore, 'public-port-guides.json unchanged after batch apply');

  assertGate(REPO);

  execSync('node scripts/assert-pages-deploy-publication-gate.js', {
    cwd: REPO,
    stdio: 'pipe',
    env: {
      ...process.env,
      SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1',
      SEADAYS_STAGE89_BODO_CANDIDATE: '1',
    },
  });

  execSync('node scripts/test-stage92-bodo-publication-safety.js', { cwd: REPO, stdio: 'pipe' });
  execSync('node scripts/test-barcelona-publish-gate-known-failure.js', { cwd: REPO, stdio: 'pipe' });

  const deployYml = fs.readFileSync(path.join(REPO, '.github/workflows/deploy.yml'), 'utf8');
  assert.ok(deployYml.includes('assert-pages-deploy-publication-gate.js'), 'deploy workflow must run pages gate');

  console.log('test-publication-batch-01 PASS', {
    pe: 356,
    candidates: batchSlugs.length,
    matrix_remaining: matrix.baseline.remaining_unpublished,
  });
}

main();

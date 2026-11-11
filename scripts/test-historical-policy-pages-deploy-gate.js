#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const {
  assertHistoricalPolicyPublicationGate,
  findUnauthorizedHistoricalPassengerEditorialInGuides,
  findUnauthorizedHistoricalEditorialHtml,
  countPassengerEditorialCallPlans,
} = require('./lib/bulkPortPublication/historicalPolicyPublicationGate');
const {
  STAGE60_OWNER_POLICY_EXCEPTION_SLUGS,
  WAVE01_OWNER_POLICY_EXCEPTION_SLUGS,
  BATCH02_OWNER_POLICY_EXCEPTION_SLUGS,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline');

const REPO = path.join(__dirname, '..');
const TRIESTE = 'trieste-italy';
const BODO = 'bod-norway';
const MORMUGAO = 'mormugao-port-goa-india';
const EILAT = 'eilat-israel';

function assertProductionGateOk() {
  assertHistoricalPolicyPublicationGate(REPO);
}

function assertUnauthorizedGuidesPromotionFails() {
  const guides = loadPublicPortGuidesFile(REPO);
  const bodo = guides.byAppPortId?.bodo;
  assert.ok(bodo, 'bodo slot');
  const leaked = JSON.parse(JSON.stringify(guides));
  leaked.byAppPortId.bodo = {
    ...bodo,
    researchImport: {
      ...(bodo.researchImport || {}),
      landing_slug: BODO,
      publication_tier: 'passenger_editorial',
      owner_publication_authorized: false,
    },
  };
  const violations = findUnauthorizedHistoricalPassengerEditorialInGuides(leaked);
  assert.ok(violations.some((v) => v.slug === BODO), 'unauthorized PE in guides must be detected');
  assert.throws(() => assertHistoricalPolicyPublicationGate(REPO, leaked), /historical policy publication gate/);
}

function assertBatch02AuthorizedEditorialHtmlOk() {
  const guides = loadPublicPortGuidesFile(REPO);
  const violations = findUnauthorizedHistoricalEditorialHtml(REPO, guides);
  for (const slug of BATCH02_OWNER_POLICY_EXCEPTION_SLUGS) {
    const guide = guides.byAppPortId?.mormugao;
    assert.ok(guide, `${slug} guide slot`);
    assert.strictEqual(guide.researchImport.landing_slug, slug);
    assert.strictEqual(guide.researchImport.owner_publication_authorized, true, `${slug} batch-02 publication auth`);
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(
      countPassengerEditorialCallPlans(html) >= 3,
      `${slug} production PE html must have 3 call plans after Batch 02`
    );
    assert.ok(!violations.some((v) => v.slug === slug), `${slug} must not be in html violations`);
  }
}

function assertWave01AuthorizedEditorialHtmlOk() {
  const guides = loadPublicPortGuidesFile(REPO);
  const violations = findUnauthorizedHistoricalEditorialHtml(REPO, guides);
  for (const slug of WAVE01_OWNER_POLICY_EXCEPTION_SLUGS) {
    const guide = Object.values(guides.byAppPortId || {}).find(
      (g) => g?.researchImport?.landing_slug === slug
    );
    assert.ok(guide, `${slug} guide slot`);
    assert.strictEqual(guide.researchImport.owner_publication_authorized, true, `${slug} wave-1 publication auth`);
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    assert.ok(
      countPassengerEditorialCallPlans(html) >= 3,
      `${slug} production PE html must have 3 call plans after Wave 1`
    );
    assert.ok(!violations.some((v) => v.slug === slug), `${slug} must not be in html violations`);
  }
}

function assertUnauthorizedEditorialHtmlFails() {
  const guides = loadPublicPortGuidesFile(REPO);
  const violations = findUnauthorizedHistoricalEditorialHtml(REPO, guides);
  const eilatViolation = violations.find((v) => v.slug === EILAT);
  assert.ok(!eilatViolation, 'production eilat html must stay policy-held stub');

  const stubPath = path.join(REPO, 'ports', EILAT, 'index.html');
  const stubHtml = fs.readFileSync(stubPath, 'utf8');
  assert.ok(countPassengerEditorialCallPlans(stubHtml) < 3, 'eilat stub call plans');

  const fakeRoot = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pages-gate-html-'));
  try {
    fs.mkdirSync(path.join(fakeRoot, 'ports', EILAT), { recursive: true });
    const fakeHtml = stubHtml + '<article class="pg-call-plan-card"></article>'.repeat(3);
    fs.writeFileSync(path.join(fakeRoot, 'ports', EILAT, 'index.html'), fakeHtml);
    const htmlViolations = findUnauthorizedHistoricalEditorialHtml(fakeRoot, guides);
    assert.ok(
      htmlViolations.some((v) => v.slug === EILAT && v.call_plan_cards >= 3),
      'synthetic 3-call-plan eilat html must fail gate'
    );
  } finally {
    fs.rmSync(fakeRoot, { recursive: true, force: true });
  }
}

function assertMormugaoUnauthorizedGuidePromotionFails() {
  const guides = loadPublicPortGuidesFile(REPO);
  const mormugao = guides.byAppPortId?.mormugao;
  assert.ok(mormugao, 'mormugao slot');
  const leaked = JSON.parse(JSON.stringify(guides));
  leaked.byAppPortId.mormugao = {
    ...mormugao,
    researchImport: {
      ...(mormugao.researchImport || {}),
      landing_slug: MORMUGAO,
      publication_tier: 'passenger_editorial',
      owner_publication_authorized: false,
    },
  };
  const violations = findUnauthorizedHistoricalPassengerEditorialInGuides(leaked);
  assert.ok(violations.some((v) => v.slug === MORMUGAO), 'unauthorized mormugao PE in guides must be detected');
  assert.throws(() => assertHistoricalPolicyPublicationGate(REPO, leaked), /historical policy publication gate/);
}

function assertCandidateEnvCannotBypassGate() {
  const env = {
    ...process.env,
    SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1',
    SEADAYS_STAGE89_BODO_CANDIDATE: '1',
  };
  const out = execSync('node scripts/assert-pages-deploy-publication-gate.js', {
    cwd: REPO,
    env,
    encoding: 'utf8',
  });
  assert.ok(/PASS/.test(out));
  assert.strictEqual(process.env.SEADAYS_PUBLICATION_BATCH_01_CANDIDATE, undefined, 'cleared in child only');
}

function assertTriesteExceptionRemainsValid() {
  assert.ok(STAGE60_OWNER_POLICY_EXCEPTION_SLUGS.has(TRIESTE), 'trieste in exception set');
  const guides = loadPublicPortGuidesFile(REPO);
  const trieste = guides.byAppPortId?.trieste;
  assert.ok(trieste?.researchImport?.landing_slug === TRIESTE, 'trieste guide');
  const violations = findUnauthorizedHistoricalPassengerEditorialInGuides(guides);
  assert.ok(!violations.some((v) => v.slug === TRIESTE), 'trieste must not appear in guide violations');
}

function assertQaEvidenceNotInJekyllPublishSet() {
  execSync('node scripts/test-jekyll-qa-evidence-exclude.js', { cwd: REPO, stdio: 'pipe' });
}

function assertLegacyPagesGapDocumented() {
  const deployYml = fs.readFileSync(path.join(REPO, '.github/workflows/deploy.yml'), 'utf8');
  assert.ok(deployYml.includes('assert-pages-deploy-publication-gate.js'), 'Landing deploy runs gate');
  assert.ok(deployYml.includes('paths-ignore'), 'deploy uses path filters');
  assert.ok(deployYml.includes('data/**'), 'data-only pushes may skip Landing deploy');
}

function main() {
  assertProductionGateOk();
  assertWave01AuthorizedEditorialHtmlOk();
  assertBatch02AuthorizedEditorialHtmlOk();
  assertUnauthorizedGuidesPromotionFails();
  assertMormugaoUnauthorizedGuidePromotionFails();
  assertUnauthorizedEditorialHtmlFails();
  assertCandidateEnvCannotBypassGate();
  assertTriesteExceptionRemainsValid();
  assertQaEvidenceNotInJekyllPublishSet();
  assertLegacyPagesGapDocumented();
  console.log('test-historical-policy-pages-deploy-gate PASS', {
    legacy_pages_prebuild_gate: 'NOT_ENFORCED_BY_GITHUB_MANAGED_JEKYLL_BUILD',
    landing_deploy_gate: 'PARTIAL_path_filtered',
    wave01_authorized_slugs: [...WAVE01_OWNER_POLICY_EXCEPTION_SLUGS],
    batch02_authorized_slugs: [...BATCH02_OWNER_POLICY_EXCEPTION_SLUGS],
  });
}

main();

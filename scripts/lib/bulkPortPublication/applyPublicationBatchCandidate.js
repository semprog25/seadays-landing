'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('../publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./stage65PublicationGuards');
const { assignPublicPortGuideByAppPortId } = require('./crossCountryHomonymPublicationGuards');
const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize');
const { verifyResearchPortSha } = require('../portResearchImport/verifyResearchSha');
const { resolveCompositeResearchRoot } = require('../portResearchImport/resolveCompositeResearchRoot');
const { replaceRobotsMeta } = require('../adsenseIndexability');
const { stableStringify } = require('../portResearchImport/jsonDiff');
const { extractTravelerQuestions } = require('../portResearchImport/extractMarkdownSections');
const { readResearchMarkdown } = require('../portResearchImport/transformResearchToPublic');

function fail(msg) {
  const err = new Error(msg);
  err.code = 'BATCH_APPLY_STOP';
  throw err;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function mergeTravelerQuestionsFromResearch(compositeRoot, landingSlug, guide) {
  const body = readResearchMarkdown(compositeRoot, landingSlug);
  const travelerQuestions = extractTravelerQuestions(body);
  if (!travelerQuestions || !travelerQuestions.length) return guide;
  guide.researchImport = { ...(guide.researchImport || {}), travelerQuestions };
  return guide;
}

function copyStage89Reuse(repoRoot, prepRow, evidenceRoot) {
  const reuseDir = path.join(repoRoot, prepRow.reuse_candidate_evidence_ref);
  const srcHtml = path.join(reuseDir, 'candidate-applied/ports/bod-norway/index.html');
  const srcGuide = path.join(reuseDir, 'candidate-applied/byAppPortId.bodo.json');
  if (!fs.existsSync(srcHtml) || !fs.existsSync(srcGuide)) {
    fail('bod-norway stage89 candidate-applied missing — run stage89 apply in evidence only first');
  }
  const destDir = path.join(evidenceRoot, 'candidates/bod-norway');
  fs.mkdirSync(path.join(destDir, 'ports/bod-norway'), { recursive: true });
  fs.copyFileSync(srcHtml, path.join(destDir, 'ports/bod-norway/index.html'));
  fs.copyFileSync(srcGuide, path.join(destDir, `byAppPortId.${prepRow.app_port_id}.json`));
  return {
    landing_slug: prepRow.landing_slug,
    app_port_id: prepRow.app_port_id,
    source: 'reuse_stage89',
    candidate_dir: destDir,
  };
}

function applyOneSlug({ repoRoot, batch, prepRow, batchCandidate, evidenceRoot, dryRun }) {
  if (prepRow.status === 'READY_REUSED_STAGE89') {
    return copyStage89Reuse(repoRoot, batchCandidate, evidenceRoot);
  }

  const landingSlug = prepRow.landing_slug;
  const appPortId = prepRow.app_port_id;
  const guidesPath = path.join(repoRoot, 'data/public-port-guides.json');
  const htmlPath = path.join(repoRoot, 'ports', landingSlug, 'index.html');
  const rollbackDir = path.join(evidenceRoot, 'rollback-pre-apply', landingSlug);
  fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true });

  const guidesBefore = loadPublicPortGuidesFile(repoRoot);
  removeStage65ExcludedGuideEntries(guidesBefore);
  const prior = guidesBefore.byAppPortId?.[appPortId];
  if (!prior) fail(`missing slot ${appPortId}`);
  if (usesPassengerEditorialLead(prior)) fail(`${landingSlug} already PE`);

  const proposed = JSON.parse(fs.readFileSync(path.join(repoRoot, prepRow.proposed_guide_ref), 'utf8'));
  const contentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex');
  if (contentHash !== prepRow.proposed_content_hash) fail(`proposed hash mismatch ${landingSlug}`);

  const patchPath = path.join(repoRoot, batch.composite_sha_patch_ref);
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: repoRoot, patchPath });
  try {
    const sha = verifyResearchPortSha({
      researchRoot: compositeRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: prepRow.research_sha256 },
    });
    if (!sha.ok) fail(`research sha ${landingSlug}: ${sha.reason}`);
  } finally {
    cleanup();
  }

  if (dryRun) {
    return { landing_slug: landingSlug, dry_run: true };
  }

  fs.copyFileSync(guidesPath, path.join(rollbackDir, 'public-port-guides.json'));
  if (fs.existsSync(htmlPath)) {
    fs.copyFileSync(htmlPath, path.join(rollbackDir, 'ports', landingSlug, 'index.html'));
  }

  let g = JSON.parse(JSON.stringify(proposed));
  const { compositeRoot: cr2, cleanup: cu2 } = resolveCompositeResearchRoot({
    landingRepoRoot: repoRoot,
    patchPath,
  });
  try {
    g = mergeTravelerQuestionsFromResearch(cr2, landingSlug, g);
  } finally {
    cu2();
  }

  const appliedAt = new Date().toISOString();
  g.researchImport = {
    ...(g.researchImport || {}),
    publication_tier: 'passenger_editorial',
    qa_verdict: 'PASS',
    research_sha256: prepRow.research_sha256,
    research_main_pin: batch.research_main_pin,
    publication_batch_01_conditional_candidate: true,
    batch01_preparation_bundle_hash: null,
    stage53_proposed_guide_reused: true,
    candidate_applied_at_utc: appliedAt,
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    conditional_policy_exception: false,
    not_publication_authorization: true,
    verified_factual_field_exclusions: prepRow.field_exclusions || [],
  };

  const next = JSON.parse(JSON.stringify(guidesBefore));
  assignPublicPortGuideByAppPortId(next, {
    landingSlug,
    appPortId,
    guide: g,
    priorGuideAtSlot: prior,
  });
  removeStage65ExcludedGuideEntries(next);
  writePublicPortGuidesFile(repoRoot, next);

  if (fs.existsSync(htmlPath)) fs.unlinkSync(htmlPath);

  const genEnv = {
    ...process.env,
    SEADAYS_PUBLICATION_BATCH_01_CANDIDATE: '1',
    SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(repoRoot, '..', 'Seadays-trust-boundary'),
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  };
  execSync(`node scripts/generateBlogs.js --ports-only --only=${landingSlug}`, {
    cwd: repoRoot,
    stdio: 'inherit',
    env: genEnv,
  });

  if (!fs.existsSync(htmlPath)) fail(`regen missing html ${landingSlug}`);
  let html = fs.readFileSync(htmlPath, 'utf8');
  if (!/noindex/i.test(html)) {
    html = replaceRobotsMeta(html, 'noindex, follow');
    fs.writeFileSync(htmlPath, html, 'utf8');
  }
  const campaign = batchCandidate.viator_campaign;
  if (campaign && !html.includes(campaign)) {
    fail(`missing Viator campaign ${campaign} on ${landingSlug}`);
  }

  const candidateDir = path.join(evidenceRoot, 'candidates', landingSlug);
  fs.mkdirSync(path.join(candidateDir, 'ports', landingSlug), { recursive: true });
  fs.copyFileSync(htmlPath, path.join(candidateDir, 'ports', landingSlug, 'index.html'));
  fs.writeFileSync(
    path.join(candidateDir, `byAppPortId.${appPortId}.json`),
    `${JSON.stringify(next.byAppPortId[appPortId], null, 2)}\n`
  );

  fs.copyFileSync(path.join(rollbackDir, 'public-port-guides.json'), guidesPath);
  if (fs.existsSync(path.join(rollbackDir, 'ports', landingSlug, 'index.html'))) {
    fs.copyFileSync(path.join(rollbackDir, 'ports', landingSlug, 'index.html'), htmlPath);
  } else if (fs.existsSync(htmlPath)) {
    fs.unlinkSync(htmlPath);
  }

  return {
    landing_slug: landingSlug,
    app_port_id: appPortId,
    candidate_dir: candidateDir,
    guides_sha256_before_restore: sha256File(guidesPath),
    production_restored: true,
  };
}

function applyBatchFromManifest(repoRoot, manifestRel, { dryRun } = {}) {
  if (process.env.SEADAYS_PUBLICATION_BATCH_01_CANDIDATE !== '1') {
    fail('set SEADAYS_PUBLICATION_BATCH_01_CANDIDATE=1 for local candidate apply only');
  }
  const repo = repoRoot || path.join(__dirname, '..', '..', '..');
  const batchPath = path.join(repo, manifestRel || 'qa-evidence/publication-batch-01/BATCH_01_MANIFEST.json');
  const batch = JSON.parse(fs.readFileSync(batchPath, 'utf8'));
  const prepPath = path.join(repo, batch.evidence_root, 'PREP_MANIFEST.json');
  if (!fs.existsSync(prepPath)) fail('run prepare first (PREP_MANIFEST.json missing)');
  const prep = JSON.parse(fs.readFileSync(prepPath, 'utf8'));

  const guidesPeCheck = loadPublicPortGuidesFile(repo);
  removeStage65ExcludedGuideEntries(guidesPeCheck);
  const peBefore = countPassengerEditorialGuides(guidesPeCheck);
  const evidenceRoot = path.join(repo, batch.evidence_root);
  const reports = [];

  for (const prepRow of prep.candidates) {
    const batchCandidate = batch.candidates.find((c) => c.landing_slug === prepRow.landing_slug);
    if (!batchCandidate) fail(`batch candidate missing ${prepRow.landing_slug}`);
    if (prepRow.status === 'READY_REUSED_STAGE89') {
      reports.push(copyStage89Reuse(repo, prepRow, evidenceRoot));
      continue;
    }
    reports.push(applyOneSlug({ repoRoot: repo, batch, prepRow, batchCandidate, evidenceRoot, dryRun }));
  }

  const guidesAfter = loadPublicPortGuidesFile(repo);
  removeStage65ExcludedGuideEntries(guidesAfter);
  const peAfter = countPassengerEditorialGuides(guidesAfter);
  if (peAfter !== peBefore) {
    fail(`production PE changed ${peBefore} -> ${peAfter} after restore expected ${batch.baseline_live_passenger_editorial}`);
  }
  if (peAfter !== batch.baseline_live_passenger_editorial) {
    fail(`production PE ${peAfter} !== baseline ${batch.baseline_live_passenger_editorial}`);
  }

  const applyReport = {
    applied_at_utc: new Date().toISOString(),
    batch_id: batch.batch_id,
    bundle_hash: prep.bundle_idempotency_hash,
    candidate_only: true,
    owner_publication_authorized: false,
    production_passenger_editorial: peAfter,
    slugs: reports.map((r) => r.landing_slug),
  };
  fs.writeFileSync(path.join(evidenceRoot, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  return { applyReport, reports };
}

module.exports = {
  applyBatchFromManifest,
};

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildBulkEligibilityReport, DEFAULT_RESEARCH } = require('./lib/bulkPortPublication/eligibility');
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest');
const {
  analyzeBlockedCohort,
  selectBootstrapCandidates,
} = require('./lib/bulkPortPublication/stage65UnpublishedCohort');
const {
  buildPublishedSlugSet,
  STAGE43_HARD_EXCLUDE,
  exclusionReasonForSlug,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { selectNeedsReviewRecoveryPool } = require('./lib/bulkPortPublication/targetedNeedsReviewRecovery');

/** Owner holds from Stage 63 — do not auto-promote without resolved factual checks. */
const STAGE65_OWNER_HOLD = new Set([
  'tokyo-yokohama-japan',
  'kirkenes-norway',
  'ocho-rios-jamaica',
]);

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage65-next-25-recovery');
const PRODUCTION_BASELINE_SHA = 'c68abdaf1024d968744fbdcb0a10b4c6d2afbc79';
const COHORT_LIMIT = Number(process.env.STAGE65_COHORT_LIMIT || 25);
const OVER_SAMPLE = Number(process.env.STAGE65_OVER_SAMPLE || 12);

function classifyUnpublished(row, publishedSet) {
  if (publishedSet.has(row.landing_slug)) return 'published_passenger_editorial';
  if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) return 'historical_policy_hold';
  if (STAGE65_OWNER_HOLD.has(row.landing_slug)) return 'owner_factual_hold';
  const ex = exclusionReasonForSlug(row.landing_slug, publishedSet);
  if (ex) return ex;
  if (row.qa_verdict === 'BLOCKED') return 'research_qa_blocked';
  if (row.publication_bucket === 'NEEDS_REVIEW') return 'needs_review_existing_guide';
  if (row.qa_verdict === 'PASS' && !row.has_public_port_guide) return 'bootstrap_missing_guide';
  if (row.publication_bucket === 'BLOCKED') return 'blocked_other';
  return row.publication_bucket || 'unknown';
}

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  const publishedSet = buildPublishedSlugSet(REPO);
  const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot });
  const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot });
  const unpublished = (report.ports || []).filter((p) => !publishedSet.has(p.landing_slug));

  const classCounts = {};
  const classified = unpublished.map((row) => {
    const bucket = classifyUnpublished(row, publishedSet);
    classCounts[bucket] = (classCounts[bucket] || 0) + 1;
    return {
      landing_slug: row.landing_slug,
      publication_bucket: row.publication_bucket,
      qa_verdict: row.qa_verdict,
      research_status: row.research_status,
      recovery_class: bucket,
      has_public_port_guide: row.has_public_port_guide,
      identifier_status: row.identifier_status,
    };
  });

  const analysis = analyzeBlockedCohort({
    manifestPorts: manifest.ports,
    eligibilityPorts: report.ports,
    researchRoot,
    landingRepoRoot: REPO,
  });

  const bootstrapFiltered = analysis.bootstrap_pool.filter(
    (p) => !STAGE65_OWNER_HOLD.has(p.landing_slug) && !STAGE43_HARD_EXCLUDE.has(p.landing_slug)
  );

  const { picked: bootstrapPick, skipped: bootstrapSkipped, eligible_count: bootstrapEligible } =
    selectBootstrapCandidates(bootstrapFiltered, { limit: COHORT_LIMIT, oversample: OVER_SAMPLE });

  const nrPool = unpublished.filter(
    (p) =>
      p.publication_bucket === 'NEEDS_REVIEW' &&
      p.qa_verdict === 'PASS' &&
      p.identifier_status === 'resolved' &&
      p.research_sha_verified &&
      !STAGE43_HARD_EXCLUDE.has(p.landing_slug) &&
      !STAGE65_OWNER_HOLD.has(p.landing_slug) &&
      p.policy_dry_run?.ok !== false
  );
  const { picked: nrPick } = selectNeedsReviewRecoveryPool({
    eligibilityPorts: nrPool,
    publishedSlugs: publishedSet,
    limit: 5,
  });

  const selected = [...nrPick, ...bootstrapPick].filter(
    (p, i, a) => a.findIndex((x) => x.landing_slug === p.landing_slug) === i
  );

  fs.mkdirSync(OUT, { recursive: true });

  const reconcile = {
    generated_at_utc: new Date().toISOString(),
    production_baseline_sha: PRODUCTION_BASELINE_SHA,
    worktree_head_sha: head,
    published_passenger_editorial: publishedSet.size,
    unpublished_remaining: unpublished.length,
    recovery_class_counts: classCounts,
    owner_hold_slugs: [...STAGE65_OWNER_HOLD],
    bootstrap_policy_ok: bootstrapFiltered.filter((p) => p.policy_ok).length,
    bootstrap_yaml_fail: bootstrapFiltered.filter((p) => p.yaml_parse_error).length,
    needs_review_eligible: nrPool.length,
    needs_review_selected: nrPick.map((p) => p.landing_slug),
    selected_for_prepare: selected.map((p) => p.landing_slug),
    research_qa_blocked_unpublished: unpublished.filter((p) => p.qa_verdict === 'BLOCKED').length,
  };

  fs.writeFileSync(path.join(OUT, 'REMAINING_INVENTORY.json'), `${JSON.stringify(reconcile, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'BLOCKED_CAUSE_REPORT.json'), `${JSON.stringify(analysis.cause_counts, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'BOOTSTRAP_POOL.json'), `${JSON.stringify(bootstrapFiltered, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'CLASSIFIED_UNPUBLISHED.json'), `${JSON.stringify(classified, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'SELECT_SKIPPED.json'),
    `${JSON.stringify({ bootstrapSkipped, bootstrapEligible, target: COHORT_LIMIT }, null, 2)}\n`,
    'utf8'
  );

  console.log(JSON.stringify(reconcile, null, 2));
}

main();

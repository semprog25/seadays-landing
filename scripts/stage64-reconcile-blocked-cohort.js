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
} = require('./lib/bulkPortPublication/stage64BlockedCohort');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage64-blocked-recovery');
const PRODUCTION_BASELINE_SHA = '4fc0b2545da0210afad4a54b0114dfd4f9451273';
const COHORT_LIMIT = Number(process.env.STAGE64_COHORT_LIMIT || 25);
const OVER_SAMPLE = Number(process.env.STAGE64_OVER_SAMPLE || 10);

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot });
  const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot });
  const analysis = analyzeBlockedCohort({
    manifestPorts: manifest.ports,
    eligibilityPorts: report.ports,
    researchRoot,
    landingRepoRoot: REPO,
  });

  const { picked, skipped, eligible_count } = selectBootstrapCandidates(analysis.bootstrap_pool, {
    limit: COHORT_LIMIT,
    oversample: OVER_SAMPLE,
  });

  fs.mkdirSync(OUT, { recursive: true });

  const causeReport = {
    generated_at_utc: new Date().toISOString(),
    production_baseline_sha: PRODUCTION_BASELINE_SHA,
    worktree_head_sha: head,
    research_root: researchRoot,
    blocked_unpublished: analysis.blocked_unpublished_count,
    inspected: analysis.inspected_count,
    blocking_cause_counts: analysis.cause_counts,
    bootstrap_policy_ok: analysis.bootstrap_policy_ok_count,
    bootstrap_yaml_failures: analysis.bootstrap_yaml_fail_count,
    qa_blocked_in_blocked_cohort: (manifest.ports || []).filter(
      (p) =>
        analysis.inspected_sample.some((i) => i.landing_slug === p.landing_slug) && p.qa_verdict === 'BLOCKED'
    ).length,
    note:
      'Primary recoverable BLOCKED unpublished rows are qa PASS with missing public-port-guides entry; picker id becomes resolved after guide bootstrap.',
    inspected_sample: analysis.inspected_sample,
  };

  fs.writeFileSync(path.join(OUT, 'BLOCKED_CAUSE_REPORT.json'), `${JSON.stringify(causeReport, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'BOOTSTRAP_POOL.json'), `${JSON.stringify(analysis.bootstrap_pool, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(picked, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'SELECT_SKIPPED.json'),
    `${JSON.stringify({ skipped, eligible_count, target: COHORT_LIMIT }, null, 2)}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        blocked_unpublished: analysis.blocked_unpublished_count,
        bootstrap_policy_ok: analysis.bootstrap_policy_ok_count,
        selected_for_prepare: picked.length,
        eligible_count,
        causes_top: Object.entries(analysis.cause_counts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8),
      },
      null,
      2
    )
  );
}

main();

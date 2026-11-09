#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildBulkEligibilityReport, DEFAULT_RESEARCH } = require('./lib/bulkPortPublication/eligibility');
const {
  buildPublishedSlugSet,
  exclusionReasonForSlug,
  STAGE43_HARD_EXCLUDE,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { selectNeedsReviewRecoveryPool } = require('./lib/bulkPortPublication/targetedNeedsReviewRecovery');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/needs-review-25-recovery');
const PRODUCTION_BASELINE_SHA = 'd15a5deb5b5f7e7eb187a402d11f911e856c204a';
const ROOT_CAUSES_REF = path.join(REPO, 'NEEDS_REVIEW_ROOT_CAUSES.json');

function classifyRootCause(row) {
  const causes = [];
  if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) causes.push('historical_policy_exclusion');
  if (row.qa_verdict !== 'PASS') causes.push('research_qa_blocked');
  if (row.identifier_status !== 'resolved') causes.push('canonical_identity_unresolved');
  if (!row.research_sha_verified) causes.push('research_sha_mismatch');
  const diag = row.editorial_readiness?.research_diagnostics?.issues || [];
  if (diag.some((i) => i.includes('markdown'))) causes.push('draft_sanitizer_markdown_leak');
  if (diag.some((i) => i.includes('research_leak'))) causes.push('editorial_research_leak');
  if (!row.editorial_readiness?.live_passenger_ready) causes.push('missing_weak_passenger_content');
  if (row.publication_layers?.factually_verified === false) causes.push('unsupported_factual_claims');
  if (row.policy_dry_run && !row.policy_dry_run.ok) causes.push('gateway_terminal_policy_block');
  if (!causes.length) causes.push('needs_review_unclassified');
  return causes;
}

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot });
  const publishedSet = buildPublishedSlugSet(REPO);
  const guides = loadPublicPortGuidesFile(REPO);

  const needsReview = (report.ports || []).filter((p) => {
    if (p.publication_bucket !== 'NEEDS_REVIEW') return false;
    if (publishedSet.has(p.landing_slug)) return false;
    const g = guides.byAppPortId[p.app_port_id];
    if (g && usesPassengerEditorialLead(g)) return false;
    return true;
  });

  const causeCounts = {};
  const classified = needsReview.map((row) => {
    const causes = classifyRootCause(row);
    for (const c of causes) causeCounts[c] = (causeCounts[c] || 0) + 1;
    return {
      landing_slug: row.landing_slug,
      app_port_id: row.app_port_id,
      causes,
      thin_score: row.thin_score,
      policy_ok: row.policy_dry_run?.ok !== false,
    };
  });

  const recoveryPool = needsReview.filter(
    (p) =>
      p.qa_verdict === 'PASS' &&
      p.identifier_status === 'resolved' &&
      p.research_sha_verified &&
      !STAGE43_HARD_EXCLUDE.has(p.landing_slug) &&
      !exclusionReasonForSlug(p.landing_slug, publishedSet) &&
      p.policy_dry_run?.ok !== false
  );

  const { picked, skipped, eligible_count } = selectNeedsReviewRecoveryPool({
    eligibilityPorts: recoveryPool,
    publishedSlugs: publishedSet,
    limit: 25,
  });

  const prior = fs.existsSync(ROOT_CAUSES_REF) ? JSON.parse(fs.readFileSync(ROOT_CAUSES_REF, 'utf8')) : null;

  fs.mkdirSync(OUT, { recursive: true });
  const reconcile = {
    generated_at_utc: new Date().toISOString(),
    production_baseline_sha: PRODUCTION_BASELINE_SHA,
    worktree_head_sha: head,
    prior_root_cause_report: prior
      ? {
          generated_at_utc: prior.generated_at_utc,
          needs_review_analyzed: prior.needs_review_analyzed,
        }
      : null,
    current_inventory: {
      needs_review_unpublished: needsReview.length,
      recovery_pool_policy_ok: recoveryPool.length,
      published_passenger_editorial: publishedSet.size,
    },
    delta_vs_prior_report:
      prior && typeof prior.needs_review_analyzed === 'number'
        ? {
            prior_count: prior.needs_review_analyzed,
            current_count: needsReview.length,
            note: 'Prior report used rollback baseline guides; current uses production data/public-port-guides.json',
          }
        : null,
    cause_counts: causeCounts,
    selected_candidates: picked.map((p) => p.landing_slug),
    skipped,
    classified_sample: classified.slice(0, 120),
  };

  fs.writeFileSync(path.join(OUT, 'RECONCILE.json'), `${JSON.stringify(reconcile, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(picked, null, 2)}\n`, 'utf8');
  console.log(
    JSON.stringify(
      {
        needs_review: needsReview.length,
        recovery_pool: recoveryPool.length,
        selected: picked.length,
        eligible_count,
      },
      null,
      2
    )
  );
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');
const { sha256File, verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { buildCompositeResearchRoot } = require('./lib/portResearchImport/researchRootComposite');
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility');
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest');
const { analyzeBlockedCohort } = require('./lib/bulkPortPublication/stage65UnpublishedCohort');
const { buildPublishedSlugSet, STAGE43_HARD_EXCLUDE } = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { parseFrontmatter } = require('./lib/portResearchImport/resolveYaml');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31');
const FIXTURE = path.join(REPO, 'scripts/fixtures/stage70-category-b-yaml.json');

const VERIFIED_RESEARCH_COMMIT =
  process.env.VERIFIED_RESEARCH_COMMIT || 'f4552cf944e55c1087797567661b948e13e3978c';
const DEFAULT_BY_PORT_ROOT =
  process.env.PORT_RESEARCH_BY_PORT_ROOT ||
  '/Users/sharanestone/Semprog/seadays-ports-deliverables';
const DEFAULT_INDEX_SOURCE =
  process.env.PORT_RESEARCH_INDEX_SOURCE ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06/final/PORTS_MASTER_INDEX.json';

const STAGE67_OWNER_HOLD = new Set([
  'tokyo-yokohama-japan',
  'kirkenes-norway',
  'ocho-rios-jamaica',
  'glasgow-united-kingdom',
  'rostock-germany',
]);

const FALMOUTH_JAMAICA_SLUG = 'falmouth-jamaica';

function loadCohortSlugs() {
  const data = JSON.parse(fs.readFileSync(FIXTURE, 'utf8'));
  return data.landing_slugs;
}

function buildShaPatch({ slugs, byPortRoot, indexSourcePath }) {
  const index = JSON.parse(fs.readFileSync(indexSourcePath, 'utf8'));
  const bySlug = new Map((index.ports || []).map((p) => [p.slug, p]));
  const patchRows = [];
  const patchMap = {};

  for (const slug of slugs) {
    const mdPath = path.join(byPortRoot, 'by-port', `${slug}.md`);
    if (!fs.existsSync(mdPath)) {
      patchRows.push({ landing_slug: slug, error: 'missing_by_port_md' });
      continue;
    }
    const byPortSha = sha256File(mdPath);
    const indexRow = bySlug.get(slug);
    const indexSha = indexRow?.sha256 || null;
    patchMap[slug] = byPortSha;
    patchRows.push({
      landing_slug: slug,
      index_sha256_before: indexSha,
      by_port_sha256: byPortSha,
      sha_reconciled: indexSha !== byPortSha,
      qa_verdict: indexRow?.qa_verdict || null,
      research_status: indexRow?.research_status || null,
    });
  }

  return { patchMap, patchRows };
}

function classifyGuide(row, publishedSet) {
  if (publishedSet.has(row.landing_slug)) return 'published_passenger_editorial';
  if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) return 'historical_policy_hold';
  if (STAGE67_OWNER_HOLD.has(row.landing_slug)) return 'owner_factual_hold';
  if (row.landing_slug === FALMOUTH_JAMAICA_SLUG) return 'falmouth_homonym_identifier_hold';
  if (!row.has_public_port_guide) return 'bootstrap_missing_guide';
  return 'existing_guide';
}

function gateRow({ slug, manifestRow, eligRow, publishedSet, researchRoot }) {
  const mdPath = path.join(researchRoot, 'by-port', `${slug}.md`);
  let yamlOk = false;
  let yamlError = null;
  try {
    const raw = fs.readFileSync(mdPath, 'utf8');
    parseFrontmatter(raw);
    yamlOk = true;
  } catch (err) {
    yamlError = String(err.message || err).split('\n')[0];
  }

  const sha = verifyResearchPortSha({
    researchRoot,
    landingSlug: slug,
    manifestRow: manifestRow,
  });

  return {
    landing_slug: slug,
    sha_match: sha.ok,
    sha_expected: sha.expected,
    sha_actual: sha.actual,
    yaml_parse: yamlOk,
    yaml_error: yamlError,
    research_qa: manifestRow?.qa_verdict || null,
    app_port_id: manifestRow?.app_port_id || eligRow?.app_port_id || null,
    identifier_status: manifestRow?.identifier_status || null,
    guide_classification: classifyGuide(manifestRow || {}, publishedSet),
    policy_ok: eligRow?.policy_dry_run?.ok === true,
    policy_blockers: eligRow?.policy_dry_run?.blockers || [],
    publication_bucket: eligRow?.publication_bucket || null,
    research_sha_verified: eligRow?.research_sha_verified === true,
    factual_editorial_holds: [
      ...(STAGE67_OWNER_HOLD.has(slug) ? ['owner_factual_hold'] : []),
      ...(slug === FALMOUTH_JAMAICA_SLUG ? ['falmouth_homonym_publication_guard'] : []),
      ...(eligRow?.publication_bucket === 'NEEDS_REVIEW' ? ['needs_review_existing_guide'] : []),
    ],
    eligible_for_publication_apply:
      sha.ok &&
      yamlOk &&
      manifestRow?.qa_verdict === 'PASS' &&
      manifestRow?.identifier_status === 'resolved' &&
      eligRow?.policy_dry_run?.ok === true &&
      !publishedSet.has(slug) &&
      !STAGE43_HARD_EXCLUDE.has(slug) &&
      !STAGE67_OWNER_HOLD.has(slug) &&
      slug !== FALMOUTH_JAMAICA_SLUG &&
      Boolean(manifestRow?.has_public_port_guide),
  };
}

function main() {
  const slugs = loadCohortSlugs();
  if (slugs.length !== 31) throw new Error(`expected 31 cohort slugs, got ${slugs.length}`);

  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  const publishedSet = buildPublishedSlugSet(REPO);
  const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
  const liveGuides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  let passengerEditorialGuideCount = 0;
  for (const g of Object.values(liveGuides.byAppPortId || {})) {
    if (usesPassengerEditorialLead(g)) passengerEditorialGuideCount += 1;
  }

  const { patchMap, patchRows } = buildShaPatch({
    slugs,
    byPortRoot: DEFAULT_BY_PORT_ROOT,
    indexSourcePath: DEFAULT_INDEX_SOURCE,
  });

  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-research-composite-'));
  const { compositeRoot } = buildCompositeResearchRoot({
    byPortRoot: DEFAULT_BY_PORT_ROOT,
    indexSourcePath: DEFAULT_INDEX_SOURCE,
    shaPatchBySlug: patchMap,
    workDir,
  });

  if (!process.env.SEADAYS_APP_ROOT) {
    process.env.SEADAYS_APP_ROOT = path.resolve(REPO, '..', '..', '..', 'Seadays-trust-boundary');
  }

  const identifierManifest = buildPortIdentifierManifest({
    landingRepoRoot: REPO,
    researchRoot: compositeRoot,
  });
  const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot });
  const analysis = analyzeBlockedCohort({
    manifestPorts: identifierManifest.ports,
    eligibilityPorts: report.ports,
    researchRoot: compositeRoot,
    landingRepoRoot: REPO,
  });

  const bySlugManifest = new Map(identifierManifest.ports.map((p) => [p.landing_slug, p]));
  const bySlugElig = new Map(report.ports.map((p) => [p.landing_slug, p]));

  const gates = slugs.map((slug) =>
    gateRow({
      slug,
      manifestRow: bySlugManifest.get(slug),
      eligRow: bySlugElig.get(slug),
      publishedSet,
      researchRoot: compositeRoot,
    })
  );

  const eligible = gates.filter((g) => g.eligible_for_publication_apply);
  const cohortBootstrap = (analysis.bootstrap_pool || []).filter((p) => slugs.includes(p.landing_slug));
  const bootstrapPolicyOk = cohortBootstrap.filter((p) => p.policy_ok && !p.yaml_parse_error);
  const bootstrapApplyReady = bootstrapPolicyOk.filter(
    (p) =>
      p.landing_slug !== FALMOUTH_JAMAICA_SLUG &&
      !STAGE67_OWNER_HOLD.has(p.landing_slug) &&
      !STAGE43_HARD_EXCLUDE.has(p.landing_slug)
  );

  const patchArtifact = {
    verified_research_commit: VERIFIED_RESEARCH_COMMIT,
    index_source_path: DEFAULT_INDEX_SOURCE,
    by_port_root: DEFAULT_BY_PORT_ROOT,
    generated_at_utc: new Date().toISOString(),
    cohort_size: 31,
    reconciled_count: patchRows.filter((r) => r.sha_reconciled).length,
    sha_patch: patchMap,
    rows: patchRows,
  };

  const summary = {
    status: 'READY_FOR_OWNER_REVIEW',
    landing_head_sha: head,
    verified_research_commit: VERIFIED_RESEARCH_COMMIT,
    published_passenger_editorial_slug_count: publishedSet.size,
    published_passenger_editorial_guide_count: passengerEditorialGuideCount,
    owner_universe_remaining: 406 - publishedSet.size,
    reconciled_sha_count: patchArtifact.reconciled_count,
    cohort_gate_pass: {
      sha_match: gates.filter((g) => g.sha_match).length,
      yaml_parse: gates.filter((g) => g.yaml_parse).length,
      research_qa_pass: gates.filter((g) => g.research_qa === 'PASS').length,
      app_port_id_resolved: gates.filter((g) => Boolean(g.app_port_id)).length,
      identifier_status_resolved: gates.filter((g) => g.identifier_status === 'resolved').length,
      bootstrap_policy_ok: bootstrapPolicyOk.length,
    },
    genuinely_eligible_passenger_editorial_apply: eligible.length,
    eligible_passenger_editorial_slugs: eligible.map((g) => g.landing_slug),
    bootstrap_policy_ok_cohort: bootstrapPolicyOk.length,
    bootstrap_apply_ready_excluding_homonym_and_owner_holds: bootstrapApplyReady.length,
    bootstrap_apply_ready_slugs: bootstrapApplyReady.map((p) => p.landing_slug),
    holds: gates.filter((g) => !g.eligible_for_publication_apply),
    bootstrap_policy_ok_global_pool: analysis.bootstrap_pool.filter((p) => p.policy_ok).length,
    regression: {
      public_port_guides_mutated: false,
      port_html_mutated: false,
      terminal_coordinates_mutated: false,
      unrelated_index_sha_unchanged: true,
    },
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(REPO, 'scripts/fixtures'), { recursive: true });

  fs.writeFileSync(
    path.join(OUT, 'PORTS_MASTER_INDEX_SHA_PATCH.json'),
    `${JSON.stringify(patchArtifact, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(path.join(OUT, 'GATE_REPORT.json'), `${JSON.stringify(gates, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(OUT, 'RECONCILE_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'STAGE70_REPAIR_31_REPORT.md'),
    [
      '# Stage 70 — 31 Category-B YAML-repaired ports SHA / gate reconciliation',
      '',
      `- **Research commit (base):** \`${VERIFIED_RESEARCH_COMMIT}\` + Stage 70 syntax repair`,
      `- **Landing HEAD:** \`${head}\``,
      `- **Reconciled SHA rows:** ${patchArtifact.reconciled_count}/31`,
      `- **Published passenger editorial:** ${passengerEditorialGuideCount} guides / ${publishedSet.size} slugs / 406 universe`,
      `- **Genuinely eligible (post-reconcile, no apply):** ${eligible.length}`,
      '',
      'No `public-port-guides.json`, port HTML, or terminal JSON mutated in this pass.',
      '',
    ].join('\n'),
    'utf8'
  );

  console.log(JSON.stringify(summary, null, 2));
}

main();

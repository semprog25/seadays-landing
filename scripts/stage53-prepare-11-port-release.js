#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';
const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence', 'stage53-11-port-release');
const STAGE28 = path.join(OUT, 'STAGE28_RELEASE_CANDIDATES.json');
const STAGE45 = path.join(REPO, 'STAGE45_50_PORT_RESCORE.json');
const STAGE28_DRAFTS = path.join(OUT, 'draft-sources/stage28');
const STAGE52_DRAFTS = path.join(OUT, 'draft-sources/stage52-corrected');
const LOCK = 'stage53-11-port-release-v1';
const STAGE45_BUNDLE = 'f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214';

const STAGE28_SLUGS = [
  'bod-norway',
  'mormugao-port-goa-india',
  'mumbai-india',
  'ravenna-italy',
  'trieste-italy',
  'eilat-israel',
];
const STAGE52_SLUGS = [
  'almeria-spain',
  'harstad-norway',
  'montego-bay-jamaica',
  'roseau-dominica',
  'la-romana-dominican-republic',
];
const COHORT_SLUGS = [...STAGE28_SLUGS, ...STAGE52_SLUGS].sort();

const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft');
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence');
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview');
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema');
const { sanitizePassengerDraftSurfaces } = require('./lib/bulkPortPublication/sanitizePassengerDraftSurfaces');
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields');
const { preparePassengerGuideText } = require('./lib/publicGuideCopySanitize');

function sanitizePassengerGuideSurfaces(guide) {
  for (const { holder, key } of listPassengerTextFields(guide)) {
    if (typeof holder[key] !== 'string') continue;
    holder[key] = preparePassengerGuideText(holder[key], { label: `guide_field_${key}` });
  }
  if (guide.gettingThere?.distanceAnswer && typeof guide.gettingThere.distanceAnswer === 'string') {
    guide.gettingThere.distanceAnswer = preparePassengerGuideText(guide.gettingThere.distanceAnswer, {
      label: 'distanceAnswer',
    });
  }
  return guide;
}

function gitHead() {
  try {
    return execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
  } catch {
    return null;
  }
}

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE53_STOP', message: msg }, null, 2));
  process.exit(41);
}

function loadMembership() {
  if (!fs.existsSync(STAGE28)) fail(`missing ${STAGE28}`);
  const s28 = JSON.parse(fs.readFileSync(STAGE28, 'utf8'));
  const s28BySlug = new Map(s28.ports.map((p) => [p.landing_slug, p]));
  const rescore = JSON.parse(fs.readFileSync(STAGE45, 'utf8'));
  if (rescore.bundle_idempotency_hash !== STAGE45_BUNDLE) {
    fail(`stage45 bundle mismatch: ${rescore.bundle_idempotency_hash}`);
  }
  const rescoreBySlug = new Map(rescore.ports.map((p) => [p.landing_slug, p]));
  const guides = loadPublicPortGuidesFile(REPO);

  const rows = [];
  for (const slug of STAGE28_SLUGS) {
    const row = s28BySlug.get(slug);
    if (!row) fail(`stage28 missing slug: ${slug}`);
    if (row.owner_bucket !== 'READY_FOR_OWNER_APPROVAL') {
      fail(`stage28 bucket drift ${slug}: ${row.owner_bucket}`);
    }
    if (!row.publication_gates_pass) fail(`stage28 gates false: ${slug}`);
    if (slug === 'venice-ravenna-trieste-italy') fail(`venice composite excluded from stage53 cohort`);
    const g = guides.byAppPortId[row.app_port_id];
    if (!g) fail(`missing live guide: ${slug}`);
    if (usesPassengerEditorialLead(g)) fail(`already passenger editorial: ${slug}`);
    rows.push({
      ...row,
      draft_source: 'stage28',
      draft_path: path.join(STAGE28_DRAFTS, `${slug}.json`),
    });
  }

  for (const slug of STAGE52_SLUGS) {
    const row = rescoreBySlug.get(slug);
    if (!row) fail(`stage45 missing slug: ${slug}`);
    const g = guides.byAppPortId[row.app_port_id];
    if (!g) fail(`missing live guide: ${slug}`);
    if (usesPassengerEditorialLead(g)) fail(`already passenger editorial: ${slug}`);
    const draftPath = path.join(STAGE52_DRAFTS, `${slug}.json`);
    if (!fs.existsSync(draftPath)) fail(`missing corrected draft: ${slug}`);
    rows.push({
      landing_slug: slug,
      app_port_id: row.app_port_id,
      canonical_id: row.canonical_id || row.app_port_id,
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      research_sha256: row.research_sha256,
      field_exclusions: row.field_exclusions || [],
      owner_bucket: 'READY_FOR_OWNER_APPROVAL',
      publication_gates_pass: true,
      draft_source: 'stage52_corrected',
      draft_path: draftPath,
      draft_file_sha256: hashFile(draftPath),
      stage45_prior_bucket: row.owner_bucket,
    });
  }

  const appIds = rows.map((r) => r.app_port_id);
  if (new Set(appIds).size !== 11) fail(`appPortId collision: ${appIds.join(',')}`);
  return { rows, bySlug: new Map(rows.map((r) => [r.landing_slug, r])) };
}

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Stage 53 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`;
}

function runCurrentGates({ draft, row, researchRoot }) {
  const validation = validateEditorialDraft({
    draft,
    manifestRow: { landing_slug: row.landing_slug, app_port_id: row.app_port_id },
    researchRoot,
  });
  const scan = scanDraftFields(draft, []);
  const supported = (draft.thingsToDo?.topThings || []).filter((t) => String(t).trim()).length;
  const bucket = classifyOwnerBucket({
    validationOk: validation.ok,
    supportedAttractions: supported,
    scan,
    unresolved: [],
    editorialFailures: validation.failures,
  });
  return { validation, scan, bucket };
}

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const mainHead = gitHead();
  const lockedAt = new Date().toISOString();
  const { rows, bySlug } = loadMembership();
  const guides = loadPublicPortGuidesFile(REPO);

  fs.mkdirSync(path.join(OUT, 'proposed-guides'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'previews-local-only'), { recursive: true });

  const manifestPorts = [];
  const factualResults = [];
  const gateResults = [];
  let passing = 0;

  for (const landingSlug of COHORT_SLUGS) {
    const row = bySlug.get(landingSlug);
    const draftPayload = JSON.parse(fs.readFileSync(row.draft_path, 'utf8'));
    const draft = sanitizePassengerDraftSurfaces(JSON.parse(JSON.stringify(draftPayload.draft || draftPayload)));
    const draftSha = hashFile(row.draft_path);

    if (row.draft_source === 'stage28' && draftSha !== row.draft_file_sha256) {
      fail(`stage28 draft sha mismatch ${landingSlug}`);
    }

    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) fail(`research sha mismatch ${landingSlug}`);

    const currentGates = runCurrentGates({ draft, row, researchRoot });
    if (!currentGates.validation.ok || currentGates.bucket !== 'READY_FOR_OWNER_APPROVAL') {
      gateResults.push({
        landing_slug: landingSlug,
        pass: false,
        bucket: currentGates.bucket,
        failures: currentGates.validation.failures,
      });
      manifestPorts.push({
        landing_slug: landingSlug,
        app_port_id: row.app_port_id,
        production_apply_allowed: false,
        current_gate_failure: currentGates.validation.failures,
      });
      continue;
    }

    const existing = JSON.parse(JSON.stringify(guides.byAppPortId[row.app_port_id]));
    const fieldExclusions = (row.field_exclusions || []).slice().sort();
    const lockMeta = {
      draft_id: row.draft_id,
      draft_version: row.draft_version || draft.researchImport?.prompt_version,
      research_sha256: row.research_sha256,
      landing_slug: landingSlug,
      locked_at_utc: lockedAt,
      draft_source: row.draft_source,
    };

    let proposed = applyEditorialDraftToGuide({
      existingGuide: existing,
      draft,
      fieldExclusions,
      lockMeta,
    });
    proposed = sanitizePassengerGuideSurfaces(proposed);
    proposed.researchImport.stage53_release_candidate = true;
    proposed.researchImport.stage45_rescore_bundle_hash = STAGE45_BUNDLE;

    const factual = reviewConsequentialClaims({
      guide: proposed,
      landingSlug,
      researchRoot,
      fieldExclusions,
    });
    factualResults.push({ landing_slug: landingSlug, ...factual });

    const fragment = buildPhase1GuideHtml({
      port: {
        name: proposed.portName,
        slug: landingSlug,
        appPortId: proposed.appPortId,
        country: proposed.country,
      },
      guide: proposed,
      terminals: [],
      affiliate: { show: false },
    });
    const html = shellHtml(fragment, proposed.portName);
    const leakBlob = JSON.stringify({
      portInfo: proposed.portInfo,
      gettingThere: proposed.gettingThere,
      thingsToDo: proposed.thingsToDo,
    });
    const gates = [
      { gate: 'current_editorial_validation', ok: currentGates.validation.ok },
      { gate: 'owner_bucket_ready', ok: currentGates.bucket === 'READY_FOR_OWNER_APPROVAL' },
      { gate: 'passenger_leak_scan', ok: !containsInternalResearchLeak(leakBlob) },
      { gate: 'factual_exclude', ok: !factual.exclude_from_release, reason: factual.exclude_reason },
    ];
    const htmlVal = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true });
    gates.push({ gate: 'html_preview_validation', ok: htmlVal.ok, issues: htmlVal.issues });
    const allPass = gates.every((g) => g.ok !== false);

    if (allPass) passing += 1;
    gateResults.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      pass: allPass,
      gates,
      field_exclusions: fieldExclusions,
      draft_source: row.draft_source,
    });

    const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex');
    fs.writeFileSync(
      path.join(OUT, 'proposed-guides', `${landingSlug}.json`),
      `${JSON.stringify(proposed, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(
      path.join(OUT, 'rollback', `${landingSlug}.production-snapshot.json`),
      `${JSON.stringify(existing, null, 2)}\n`,
      'utf8'
    );
    fs.writeFileSync(path.join(OUT, 'previews-local-only', `${landingSlug}.html`), html, 'utf8');

    manifestPorts.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      canonical_id: row.canonical_id || row.app_port_id,
      draft_id: row.draft_id,
      draft_source: row.draft_source,
      draft_file_sha256: draftSha,
      research_sha256: row.research_sha256,
      field_exclusions: fieldExclusions,
      proposed_content_hash: proposedContentHash,
      production_apply_allowed: allPass,
      publication_gates_pass: allPass,
      proposed_guide_ref: `qa-evidence/stage53-11-port-release/proposed-guides/${landingSlug}.json`,
      rollback_ref: `qa-evidence/stage53-11-port-release/rollback/${landingSlug}.production-snapshot.json`,
      owner_approval_status: 'PENDING',
    });
  }

  const releaseBundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        manifestPorts
          .filter((p) => p.production_apply_allowed)
          .map((p) => ({
            landing_slug: p.landing_slug,
            proposed_content_hash: p.proposed_content_hash,
            draft_file_sha256: p.draft_file_sha256,
            research_sha256: p.research_sha256,
          }))
      )
    )
    .digest('hex');

  const proposal = {
    schema_version: 1,
    lock_version: LOCK,
    status: passing === COHORT_SLUGS.length ? 'IMMUTABLE_CANDIDATE_PENDING_OWNER' : 'PARTIAL_CANDIDATE',
    owner_publication_authorized: false,
    created_at_utc: lockedAt,
    production_baseline_sha: mainHead,
    stage52_planning_baseline_sha: '02f2a75506422e58c4819a745bdbdd8aad71e08e1',
    commits_since_stage52: ['c90cb145c9b089ece02b02be8e5dbadbe809458e'],
    stage45_rescore_bundle_hash: STAGE45_BUNDLE,
    bundle_idempotency_hash: releaseBundleHash,
    candidate_count: COHORT_SLUGS.length,
    passing_all_gates: passing,
    slugs_locked: COHORT_SLUGS,
    app_port_ids: rows.map((r) => r.app_port_id).sort(),
    ports: manifestPorts,
    pipeline: { prompt_version_expected: PROMPT_VERSION },
  };

  fs.writeFileSync(path.join(OUT, 'STAGE53_RELEASE_MANIFEST.json'), `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  fs.writeFileSync(path.join(REPO, 'STAGE53_11_PORT_RELEASE_PROPOSAL.json'), `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(REPO, 'STAGE53_FACTUAL_GATE_RESULTS.json'),
    `${JSON.stringify({ generated_at: lockedAt, ports: factualResults, gate_rows: gateResults }, null, 2)}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify({ ok: passing === COHORT_SLUGS.length, passing, total: COHORT_SLUGS.length, release_bundle: releaseBundleHash }, null, 2)
  );
  if (passing !== COHORT_SLUGS.length) process.exit(44);
}

main();

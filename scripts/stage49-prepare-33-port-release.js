#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft');
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence');
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema');

const REPO = path.join(__dirname, '..');
const STAGE45_DRAFTS = path.join(REPO, 'qa-evidence', 'stage45-rescore', 'drafts');
const OUT = path.join(REPO, 'qa-evidence', 'stage49-33-port-release');
const LOCK = 'stage49-33-port-release-v1';
const EXPECTED_STAGE45_RESCORE_BUNDLE = 'f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214';
const OWNER_STAGE45_BUNDLE_REF = '01fde17fccfd4708abd77664807d53773b2c7f5731c01e1f8efea113f53a34aa';
const PRODUCTION_BASELINE_SHA = 'aa14e0f19f1df22f933fc25368bae82f5941a0e1';
const PR76_PUBLISHED = new Set([
  'kagoshima-japan',
  'katakolon-olympia-greece',
  'korcula-croatia',
  'malmo-sweden',
  'penang-malaysia',
  'rio-de-janeiro-brazil',
  'shanghai-china',
]);

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Stage 49 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`;
}

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function runPublicationGates({ proposed, draft, html, landingSlug, researchRoot }) {
  const gates = [];
  const validation = validateEditorialDraft({
    draft,
    manifestRow: { landing_slug: landingSlug, app_port_id: proposed.appPortId },
    researchRoot,
  });
  gates.push({ gate: 'editorial_draft_validation', ok: validation.ok, failures: validation.failures });
  const htmlVal = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true });
  gates.push({ gate: 'html_preview_validation', ok: htmlVal.ok, issues: htmlVal.issues });
  gates.push({ gate: 'preview_no_terminal_map', ok: !/id="port-terminal-map"/.test(html) });
  const leakBlob = JSON.stringify({
    portInfo: proposed.portInfo,
    gettingThere: proposed.gettingThere,
    thingsToDo: proposed.thingsToDo,
  });
  gates.push({ gate: 'passenger_leak_scan', ok: !containsInternalResearchLeak(leakBlob) });
  gates.push({ gate: 'prompt_version', ok: draft?.researchImport?.prompt_version === PROMPT_VERSION });
  return { allOk: gates.every((g) => g.ok !== false), gates, validation };
}

function loadMembership() {
  const rescorePath = path.join(REPO, 'STAGE45_50_PORT_RESCORE.json');
  if (!fs.existsSync(rescorePath)) throw new Error(`missing ${rescorePath}`);
  const rescore = JSON.parse(fs.readFileSync(rescorePath, 'utf8'));
  if (rescore.bundle_idempotency_hash !== EXPECTED_STAGE45_RESCORE_BUNDLE) {
    throw new Error(`Stage 45 rescore bundle mismatch: ${rescore.bundle_idempotency_hash}`);
  }
  const ready = rescore.ports.filter(
    (p) => p.owner_bucket === 'READY_FOR_OWNER_APPROVAL' && p.publication_gates_pass
  );
  const selected = ready.filter((p) => !PR76_PUBLISHED.has(p.landing_slug));
  const slugs = selected.map((p) => p.landing_slug).sort();
  const appIds = selected.map((p) => p.app_port_id).sort();
  const uniqueAppIds = new Set(appIds);
  if (ready.length !== 40) throw new Error(`expected 40 ready, got ${ready.length}`);
  if (selected.length !== 33) throw new Error(`expected 33 unpublished ready, got ${selected.length}`);
  if (uniqueAppIds.size !== 33) throw new Error(`appPortId collision in cohort`);
  for (const p of selected) {
    if (p.draft_version !== PROMPT_VERSION) {
      throw new Error(`draft_version mismatch ${p.landing_slug}: ${p.draft_version}`);
    }
  }
  return { rescore, selected, slugs, bySlug: new Map(selected.map((p) => [p.landing_slug, p])) };
}

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH;
  const lockedAt = new Date().toISOString();
  const { selected, slugs, bySlug } = loadMembership();
  const guides = loadPublicPortGuidesFile(REPO);

  fs.mkdirSync(path.join(OUT, 'proposed-guides'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'previews'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true });

  const manifestPorts = [];
  const factualResults = [];
  const gateResults = [];
  let passing = 0;
  const appIdsSeen = new Set();

  for (const landingSlug of slugs) {
    const row = bySlug.get(landingSlug);
    const draftPath = path.join(STAGE45_DRAFTS, `${landingSlug}.json`);
    if (!fs.existsSync(draftPath)) throw new Error(`missing draft: ${landingSlug}`);
    const draftPayload = JSON.parse(fs.readFileSync(draftPath, 'utf8'));
    const draft = JSON.parse(JSON.stringify(draftPayload.draft));
    const draftSha = hashFile(draftPath);
    if (draftSha !== row.draft_file_sha256) throw new Error(`draft sha mismatch ${landingSlug}`);

    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    });
    if (!sha.ok) throw new Error(`research sha mismatch ${landingSlug}: ${sha.reason || 'unknown'}`);

    if (appIdsSeen.has(row.app_port_id)) throw new Error(`duplicate appPortId ${row.app_port_id}`);
    appIdsSeen.add(row.app_port_id);

    const existingLive = guides.byAppPortId[row.app_port_id];
    if (!existingLive) throw new Error(`missing production guide ${landingSlug}`);
    const existing = JSON.parse(JSON.stringify(existingLive));
    const alreadyEditorial =
      existing.researchImport?.publication_tier === 'passenger_editorial' &&
      String(existing.portInfo?.description || '').trim().length > 0;
    if (alreadyEditorial && !PR76_PUBLISHED.has(landingSlug)) {
      throw new Error(`duplicate passenger editorial on main: ${landingSlug}`);
    }

    const fieldExclusions = (row.field_exclusions || []).slice().sort();
    const lockMeta = {
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      research_sha256: row.research_sha256,
      landing_slug: landingSlug,
      locked_at_utc: lockedAt,
    };

    let proposed = applyEditorialDraftToGuide({
      existingGuide: existing,
      draft,
      fieldExclusions,
      lockMeta,
    });
    proposed.researchImport.stage49_release_candidate = true;
    proposed.researchImport.stage45_rescore_bundle_hash = EXPECTED_STAGE45_RESCORE_BUNDLE;

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
    const gates = runPublicationGates({ proposed, draft, html, landingSlug, researchRoot });
    const portPass = gates.gates.filter((g) => g.gate !== 'preview_no_terminal_map').every((g) => g.ok !== false);
    if (factual.exclude_from_release) {
      gates.gates.push({
        gate: 'factual_exclude',
        ok: false,
        reason: factual.exclude_reason,
      });
    }
    const allPass = portPass && !factual.exclude_from_release;
    if (allPass) passing += 1;
    gateResults.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      pass: allPass,
      gates: gates.gates,
      field_exclusions: fieldExclusions,
    });

    const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex');
    const proposedPath = path.join(OUT, 'proposed-guides', `${landingSlug}.json`);
    fs.writeFileSync(proposedPath, `${JSON.stringify(proposed, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(OUT, 'rollback', `${landingSlug}.production-snapshot.json`),
      `${JSON.stringify(existing, null, 2)}\n`,
      'utf8'
    );
    fs.mkdirSync(path.join(OUT, 'previews', landingSlug), { recursive: true });
    fs.writeFileSync(path.join(OUT, 'previews', landingSlug, 'index.html'), html, 'utf8');

    manifestPorts.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      canonical_id: row.canonical_id || row.app_port_id,
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      draft_file_sha256: draftSha,
      research_sha256: row.research_sha256,
      field_exclusions: fieldExclusions,
      stage45_candidate_content_hash: row.candidate_content_hash,
      proposed_content_hash: proposedContentHash,
      production_apply_allowed: allPass,
      publication_gates_pass: allPass,
      proposed_guide_ref: `qa-evidence/stage49-33-port-release/proposed-guides/${landingSlug}.json`,
      preview_ref: `qa-evidence/stage49-33-port-release/previews/${landingSlug}/index.html`,
      rollback_ref: `qa-evidence/stage49-33-port-release/rollback/${landingSlug}.production-snapshot.json`,
      owner_approval_status: 'PENDING',
      stage45_rescore_bundle_hash: EXPECTED_STAGE45_RESCORE_BUNDLE,
    });
  }

  const releaseBundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        manifestPorts.map((p) => ({
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
    status: passing === slugs.length ? 'IMMUTABLE_CANDIDATE_PENDING_OWNER' : 'PARTIAL_CANDIDATE',
    owner_publication_authorized: false,
    created_at_utc: lockedAt,
    production_baseline_sha: PRODUCTION_BASELINE_SHA,
    stage45_rescore_bundle_hash: EXPECTED_STAGE45_RESCORE_BUNDLE,
    stage45_owner_bundle_ref: OWNER_STAGE45_BUNDLE_REF,
    stage45_bundle_ref_matches_rescore_file: OWNER_STAGE45_BUNDLE_REF === EXPECTED_STAGE45_RESCORE_BUNDLE,
    bundle_idempotency_hash: releaseBundleHash,
    pr76_excluded_slugs: [...PR76_PUBLISHED].sort(),
    candidate_count: slugs.length,
    passing_all_gates: passing,
    slugs_locked: slugs,
    app_port_ids: [...appIdsSeen].sort(),
    ports: manifestPorts,
    pipeline: {
      prompt_version: PROMPT_VERSION,
      sanitizer_on_main: true,
      draft_source: 'qa-evidence/stage45-rescore/drafts',
    },
  };

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, 'STAGE49_RELEASE_MANIFEST.json'), `${JSON.stringify(proposal, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(REPO, 'STAGE49_33_PORT_RELEASE_PROPOSAL.json'),
    `${JSON.stringify(proposal, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(REPO, 'STAGE49_FACTUAL_GATE_RESULTS.json'),
    `${JSON.stringify({ generated_at: lockedAt, ports: factualResults }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(REPO, 'STAGE49_FACTUAL_GATE_RESULTS.json'),
    `${JSON.stringify({ generated_at: lockedAt, ports: factualResults, gate_rows: gateResults }, null, 2)}\n`,
    'utf8'
  );

  console.log(
    JSON.stringify(
      {
        ok: passing === slugs.length,
        passing,
        total: slugs.length,
        release_bundle: releaseBundleHash,
        stage45_rescore_bundle: EXPECTED_STAGE45_RESCORE_BUNDLE,
      },
      null,
      2
    )
  );
  if (passing !== slugs.length) process.exit(44);
}

main();

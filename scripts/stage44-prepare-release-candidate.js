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

const REPO = path.join(__dirname, '..');
const STAGE43 = path.join(REPO, 'qa-evidence', 'stage43-next-cohort');
const OUT = path.join(REPO, 'qa-evidence', 'stage44-7-port-release');
const EXPECTED_STAGE43_BUNDLE = '40be0c1e5d0d3c9b0578b745875ce78375173d25b2af8cfe2300aad4da567b66';
const LOCK = 'stage44-7-port-release-v1';

const LOCKED_SLUGS = [
  'kagoshima-japan',
  'katakolon-olympia-greece',
  'korcula-croatia',
  'malmo-sweden',
  'penang-malaysia',
  'rio-de-janeiro-brazil',
  'shanghai-china',
];

const GATEWAY_NOTES = {
  'shanghai-china': 'Wusongkou cruise terminal — not downtown Huangpu; confirm berth on programme.',
  'rio-de-janeiro-brazil': 'Porto Mauá / pier varies; safety-conscious transfer wording retained.',
  'penang-malaysia': 'Swettenham Pier / ferry quay — George Town access via taxi or ship excursion.',
  'katakolon-olympia-greece': 'Katakolon pier to Ancient Olympia — coach/taxi timing; no walkable claim.',
  'kagoshima-japan': 'Shiroyama / Honkoshin terminals — ship-assigned; transfer guidance conservative.',
};

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — Stage 44 preview</title>
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
  return { allOk: gates.every((g) => g.ok !== false), gates, validation };
}

function main() {
  const researchRoot = DEFAULT_RESEARCH;
  const lockedAt = new Date().toISOString();
  const s43 = JSON.parse(fs.readFileSync(path.join(REPO, 'STAGE43_NEXT_COHORT.json'), 'utf8'));
  if (s43.bundle_idempotency_hash !== EXPECTED_STAGE43_BUNDLE) {
    throw new Error(`Stage 43 bundle mismatch: ${s43.bundle_idempotency_hash}`);
  }
  const s43BySlug = new Map(s43.ports.map((p) => [p.landing_slug, p]));
  const guides = loadPublicPortGuidesFile(REPO);

  fs.mkdirSync(path.join(OUT, 'proposed-guides'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'previews'), { recursive: true });
  fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true });

  const manifestPorts = [];
  const factualPorts = [];
  let passing = 0;

  for (const landingSlug of LOCKED_SLUGS) {
    const row = s43BySlug.get(landingSlug);
    if (!row || row.owner_bucket !== 'READY_FOR_OWNER_APPROVAL' || !row.publication_gates_pass) {
      throw new Error(`stage43 row not ready: ${landingSlug}`);
    }

    const draftPath = path.join(STAGE43, 'drafts', `${landingSlug}.json`);
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

    const fieldExclusions = (row.field_exclusions || []).slice().sort();
    const existingLive = guides.byAppPortId[row.app_port_id];
    if (!existingLive) throw new Error(`missing production guide ${landingSlug}`);
    const existing = JSON.parse(JSON.stringify(existingLive));

    const lockMeta = {
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      research_sha256: row.research_sha256,
      landing_slug: landingSlug,
      locked_at_utc: lockedAt,
    };

    const stage43CandidateGuide = {
      ...existing,
      ...draft,
      researchImport: { ...draft.researchImport, field_exclusions: fieldExclusions },
    };
    const stage43ContentHash = crypto.createHash('sha256').update(stableStringify(stage43CandidateGuide)).digest('hex');
    if (stage43ContentHash !== row.candidate_content_hash) {
      throw new Error(`stage43 content hash drift ${landingSlug}`);
    }

    let proposed = applyEditorialDraftToGuide({
      existingGuide: existing,
      draft,
      fieldExclusions,
      lockMeta,
    });
    proposed.researchImport.stage44_release_candidate = true;
    proposed.researchImport.stage43_source_bundle_hash = EXPECTED_STAGE43_BUNDLE;

    const factual = reviewConsequentialClaims({
      guide: proposed,
      landingSlug,
      researchRoot,
      fieldExclusions,
    });
    factualPorts.push(factual);
    if (factual.exclude_from_release) {
      throw new Error(`factual exclude ${landingSlug}: ${factual.exclude_reason}`);
    }

    const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex');

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
    if (portPass) passing += 1;

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
      canonical_id: row.app_port_id,
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      draft_file_sha256: draftSha,
      research_sha256: row.research_sha256,
      field_exclusions: fieldExclusions,
      stage43_candidate_content_hash: stage43ContentHash,
      proposed_content_hash: proposedContentHash,
      candidate_content_hash: stage43ContentHash,
      production_apply_allowed: true,
      publication_gates_pass: portPass,
      proposed_guide_ref: `qa-evidence/stage44-7-port-release/proposed-guides/${landingSlug}.json`,
      preview_ref: `qa-evidence/stage44-7-port-release/previews/${landingSlug}/index.html`,
      rollback_ref: `qa-evidence/stage44-7-port-release/rollback/${landingSlug}.production-snapshot.json`,
      owner_approval_status: 'PENDING',
      stage43_source_bundle_hash: EXPECTED_STAGE43_BUNDLE,
      gateway_note: GATEWAY_NOTES[landingSlug] || null,
    });
  }

  if (passing !== LOCKED_SLUGS.length) throw new Error(`gates failed: ${passing}/${LOCKED_SLUGS.length}`);

  const releaseBundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        manifestPorts.map((p) => ({
          landing_slug: p.landing_slug,
          candidate_content_hash: p.candidate_content_hash,
          proposed_content_hash: p.proposed_content_hash,
          draft_file_sha256: p.draft_file_sha256,
        }))
      )
    )
    .digest('hex');

  const manifest = {
    schema_version: 1,
    lock_version: LOCK,
    status: 'IMMUTABLE_CANDIDATE_PENDING_OWNER',
    owner_publication_authorized: false,
    created_at_utc: lockedAt,
    stage43_source_bundle_hash: EXPECTED_STAGE43_BUNDLE,
    bundle_idempotency_hash: releaseBundleHash,
    production_baseline_sha: s43.production_baseline_sha,
    candidate_count: LOCKED_SLUGS.length,
    passing_all_gates: passing,
    slugs_locked: LOCKED_SLUGS.slice().sort(),
    ports: manifestPorts,
    gateway_identity_review: GATEWAY_NOTES,
    factual_evidence: factualPorts,
  };

  fs.writeFileSync(path.join(OUT, 'STAGE44_RELEASE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'STAGE44_FACTUAL_SPOT_CHECK.json'),
    `${JSON.stringify({ generated_at: lockedAt, ports: factualPorts }, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify({ ok: true, release_bundle: releaseBundleHash, passing }, null, 2));
}

main();

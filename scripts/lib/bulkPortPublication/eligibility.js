'use strict';

const fs = require('fs');
const path = require('path');
const { buildPortIdentifierManifest } = require('../portResearchImport/buildIdentifierManifest');
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter');
const { gateManifestForApply, scoreGuideThinness } = require('../portResearchImport/applyPortResearch');
const { verifyResearchPortSha } = require('../portResearchImport/verifyResearchSha');
const { computePolicyApply } = require('../portResearchImport/applyPortResearch');
const { classifyPassengerReadiness } = require('./editorialReadiness');

const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06';

const SOFT_IMPORT_BLOCKERS = new Set(['identifier_inferred', 'research_status_needs_review']);

function hardImportBlockers(blockers) {
  return (blockers || []).filter((b) => !SOFT_IMPORT_BLOCKERS.has(b));
}

const PUBLISHED_EDITORIAL_SLUGS = new Set([
  'hamburg-germany',
  'aalborg-denmark',
  'aarhus-denmark',
  'akureyri-iceland',
  'eidfjord-norway',
  'aqaba-jordan',
  'aruba-oranjestad-aruba',
]);

function technicalImportBlockers(row) {
  return gateManifestForApply(row);
}

function computePolicyDryRun({ researchRoot, row, guide, terminalsRow }) {
  try {
    const result = computePolicyApply({
      researchRoot,
      landingSlug: row.landing_slug,
      manifestRow: row,
      existingGuide: guide,
      existingTerminals: terminalsRow,
    });
    if (!result.ok) {
      return { ok: false, blockers: result.hardBlockers || [], terminal_pin: null };
    }
    const allowMap = result.policy?.allow_terminal_map_pin;
    return {
      ok: true,
      blockers: [],
      terminal_pin: allowMap === true ? 'allowed' : 'suppressed_or_false',
      enrichment_mode: Boolean(result.policy?.enrichment_mode),
    };
  } catch (err) {
    return { ok: false, blockers: [`compute_policy_error:${err.message}`], terminal_pin: null };
  }
}

function publicationBucket({ row, technicalBlockers, passenger }) {
  const hard = hardImportBlockers(technicalBlockers);
  if (row.qa_verdict === 'BLOCKED' || hard.length) return 'BLOCKED';
  if (PUBLISHED_EDITORIAL_SLUGS.has(row.landing_slug)) return 'PASS';
  if (
    row.qa_verdict === 'PASS' &&
    row.identifier_status === 'resolved' &&
    hard.length === 0 &&
    row.has_public_port_guide
  ) {
    return 'NEEDS_REVIEW';
  }
  return 'BLOCKED';
}

function buildBulkEligibilityReport({ landingRepoRoot, researchRoot = DEFAULT_RESEARCH }) {
  const manifestPayload = buildPortIdentifierManifest({ landingRepoRoot, researchRoot });
  const guides = loadPublicPortGuidesFile(landingRepoRoot);
  const guidesById = guides.byAppPortId || {};
  let terminalsById = {};
  const terminalsPath = path.join(landingRepoRoot, 'data', 'public-port-terminals.json');
  if (fs.existsSync(terminalsPath)) {
    terminalsById = JSON.parse(fs.readFileSync(terminalsPath, 'utf8')).byPortId || {};
  }

  const ports = [];
  for (const row of manifestPayload.ports || []) {
    const appPortId = row.app_port_id;
    const guide = appPortId ? guidesById[appPortId] : null;
    const technicalBlockers = [
      ...technicalImportBlockers(row),
      ...(row.import_blockers || []),
      ...(row.identifier_status === 'inferred' ? ['identifier_inferred'] : []),
    ].filter((v, i, a) => a.indexOf(v) === i);

    const shaCheck = verifyResearchPortSha({
      researchRoot,
      landingSlug: row.landing_slug,
      manifestRow: row,
    });

    const passenger = classifyPassengerReadiness({
      landingSlug: row.landing_slug,
      appPortId,
      guide,
      researchRoot: fs.existsSync(path.join(researchRoot, 'by-port', `${row.landing_slug}.md`))
        ? researchRoot
        : null,
    });

    const policyDry = guide
      ? computePolicyDryRun({
          researchRoot,
          row,
          guide,
          terminalsRow: terminalsById[appPortId],
        })
      : { ok: false, blockers: ['no_guide'], terminal_pin: null };

    const bucket = publicationBucket({ row, technicalBlockers, passenger });

    const layers = {
      technically_importable:
        row.qa_verdict === 'PASS' &&
        hardImportBlockers(technicalBlockers).length === 0 &&
        row.identifier_status === 'resolved' &&
        Boolean(appPortId) &&
        row.has_public_port_guide,
      editorially_passenger_ready: passenger.live_passenger_ready,
      factually_verified: passenger.live_passenger_ready && PUBLISHED_EDITORIAL_SLUGS.has(row.landing_slug),
      safe_to_publish: bucket === 'PASS',
    };

    ports.push({
      landing_slug: row.landing_slug,
      app_port_id: appPortId,
      name: row.name,
      country: row.country,
      research_sha256: row.sha256,
      research_sha_verified: shaCheck.ok,
      qa_verdict: row.qa_verdict,
      identifier_status: row.identifier_status,
      identifier_confidence: row.identifier_status,
      thin_score: guide ? scoreGuideThinness(guide) : null,
      content_completeness: {
        has_description: Boolean(String(guide?.portInfo?.description || '').trim()),
        has_things_to_do: Boolean(guide?.thingsToDo?.standardCall),
        top_things_count: (guide?.thingsToDo?.topThings || []).length,
      },
      editorial_readiness: passenger,
      terminal_coordinate_tier: policyDry.terminal_pin,
      policy_dry_run: policyDry,
      import_blockers: technicalBlockers,
      publication_bucket: bucket,
      publication_layers: layers,
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    schema_version: 1,
    landing_repo: landingRepoRoot,
    research_root: researchRoot,
    main_head_note: 'Reconcile against origin/main at generation time',
    counts: {
      total: ports.length,
      publication_pass: ports.filter((p) => p.publication_bucket === 'PASS').length,
      publication_needs_review: ports.filter((p) => p.publication_bucket === 'NEEDS_REVIEW').length,
      publication_blocked: ports.filter((p) => p.publication_bucket === 'BLOCKED').length,
      technically_importable: ports.filter((p) => p.publication_layers.technically_importable).length,
      editorially_passenger_ready: ports.filter((p) => p.publication_layers.editorially_passenger_ready).length,
      factually_verified: ports.filter((p) => p.publication_layers.factually_verified).length,
      safe_to_publish: ports.filter((p) => p.publication_layers.safe_to_publish).length,
    },
    manifest_meta: manifestPayload.meta,
  };

  return { summary, ports, collisions: manifestPayload.collisions };
}

module.exports = {
  buildBulkEligibilityReport,
  DEFAULT_RESEARCH,
  PUBLISHED_EDITORIAL_SLUGS,
};

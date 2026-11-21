#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft');
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence');
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const { containsInternalResearchLeak, preparePassengerGuideText } = require('./lib/publicGuideCopySanitize');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema');
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview');
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields');
const { buildTargetedNeedsReviewDraft } = require('./lib/bulkPortPublication/targetedNeedsReviewRecovery');
const { buildBootstrapGuideShell } = require('./lib/bulkPortPublication/stage65UnpublishedCohort');
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot');
const { dryRunPortImport } = require('./lib/portResearchImport/transformResearchToPublic');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage68-bootstrap-47');
const CANDIDATES = path.join(OUT, 'SELECTED_CANDIDATES.json');
const LOCK = 'stage68-bootstrap-47-v1';
const PRODUCTION_BASELINE_SHA = execSync('git rev-parse origin/main', {
  cwd: REPO,
  encoding: 'utf8',
}).trim();

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — stage68 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`;
}

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

function countCallPlanCards(html) {
  return (html.match(/pg-call-plan-card/g) || []).length;
}

function main() {
  if (!fs.existsSync(CANDIDATES)) throw new Error('run stage68-select-bootstrap-cohort.js first');
  const selected = JSON.parse(fs.readFileSync(CANDIDATES, 'utf8'));
  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO });
  const researchRoot = compositeRoot;
  if (!process.env.SEADAYS_APP_ROOT) {
    process.env.SEADAYS_APP_ROOT = path.resolve(REPO, '..', '..', '..', 'Seadays-trust-boundary');
  }

  try {
    const guides = loadPublicPortGuidesFile(REPO);
    const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim();
    const lockedAt = new Date().toISOString();

    fs.mkdirSync(path.join(OUT, 'corrected-drafts'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'proposed-guides'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'previews-local-only'), { recursive: true });
    fs.mkdirSync(path.join(OUT, 'terminals-proposed'), { recursive: true });

    const manifestPorts = [];
    const recoveryRows = [];
    let passing = 0;

    for (const row of selected) {
      const landingSlug = row.landing_slug;
      const live = guides.byAppPortId[row.app_port_id];
      const existing = JSON.parse(JSON.stringify(live || buildBootstrapGuideShell(row)));
      existing.appPortId = row.app_port_id;
      existing.researchImport = {
        ...(existing.researchImport || {}),
        landing_slug: landingSlug,
      };

      const sha = verifyResearchPortSha({
        researchRoot,
        landingSlug,
        manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
      });
      if (!sha.ok) throw new Error(`research sha mismatch ${landingSlug}`);

      const draft = buildTargetedNeedsReviewDraft({ row, existingGuide: existing, researchRoot });
      const validation = validateEditorialDraft({ draft, manifestRow: row, researchRoot });
      const scan = scanDraftFields(draft);
      const ownerBucket = classifyOwnerBucket({
        validationOk: validation.ok,
        supportedAttractions: (draft.thingsToDo?.topThings || []).length,
        scan,
        unresolved: draft.researchImport?.unresolved_claims,
        editorialFailures: validation.failures,
      });

      const draftPayload = {
        landing_slug: landingSlug,
        draft,
        validation,
        owner_bucket: ownerBucket,
        recovery_mode: 'stage68-bootstrap-editorial',
      };
      const draftSha = crypto.createHash('sha256').update(stableStringify(draftPayload)).digest('hex');
      fs.writeFileSync(
        path.join(OUT, 'corrected-drafts', `${landingSlug}.json`),
        `${JSON.stringify(draftPayload, null, 2)}\n`,
        'utf8'
      );

      const fieldExclusions = [];
      const lockMeta = {
        draft_version: PROMPT_VERSION,
        research_sha256: row.research_sha256,
        landing_slug: landingSlug,
        locked_at_utc: lockedAt,
        draft_source: 'stage68-bootstrap-47',
      };

      let proposed = applyEditorialDraftToGuide({
        existingGuide: existing,
        draft,
        fieldExclusions,
        lockMeta,
      });
      const researchMerge = dryRunPortImport({
        researchRoot,
        landingSlug,
        manifestRow: { ...row, qa_verdict: 'PASS' },
        existingGuide: proposed,
        existingTerminals: [],
        qaVerdict: 'PASS',
      });
      if (researchMerge.mergedGuide) {
        proposed = { ...proposed, ...researchMerge.mergedGuide, appPortId: row.app_port_id };
      }
      proposed = sanitizePassengerGuideSurfaces(proposed);
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        stage68_bootstrap_release_candidate: true,
        owner_publication_authorized: false,
        identifier_confidence: row.identifier_confidence || 'inferred_not_canonical',
      };

      const terminals = researchMerge.mergedTerminals || [];
      fs.writeFileSync(
        path.join(OUT, 'terminals-proposed', `${row.app_port_id}.json`),
        `${JSON.stringify({ terminals, gate: researchMerge.terminalGate }, null, 2)}\n`,
        'utf8'
      );

      const factual = reviewConsequentialClaims({
        guide: proposed,
        landingSlug,
        researchRoot,
        fieldExclusions,
      });

      const fragment = buildPhase1GuideHtml({
        port: {
          name: proposed.portName,
          slug: landingSlug,
          appPortId: proposed.appPortId,
          country: proposed.country,
        },
        guide: proposed,
        terminals,
        affiliate: { show: false },
      });
      const html = shellHtml(fragment, proposed.portName || landingSlug);
      const htmlVal = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true });
      const callPlanCards = countCallPlanCards(html);
      const leakBlob = JSON.stringify({
        portInfo: proposed.portInfo,
        gettingThere: proposed.gettingThere,
        thingsToDo: proposed.thingsToDo,
      });

      const gates = [
        { gate: 'editorial_draft_validation', ok: validation.ok, failures: validation.failures },
        { gate: 'owner_bucket_ready', ok: ownerBucket === 'READY_FOR_OWNER_APPROVAL', owner_bucket: ownerBucket },
        { gate: 'html_preview_validation', ok: htmlVal.ok, issues: htmlVal.issues },
        { gate: 'call_plan_cards', ok: callPlanCards >= 3, count: callPlanCards },
        { gate: 'passenger_leak_scan', ok: !containsInternalResearchLeak(leakBlob) },
        { gate: 'factual_exclude', ok: !factual.exclude_from_release, reason: factual.exclude_reason },
        { gate: 'identifier_confidence_not_unresolved', ok: row.identifier_confidence !== 'unresolved' },
      ];
      const portPass = gates.every((g) => g.ok !== false);
      if (portPass) passing += 1;

      recoveryRows.push({
        landing_slug: landingSlug,
        app_port_id: row.app_port_id,
        owner_bucket: ownerBucket,
        publication_gates_pass: portPass,
        validation_failures: validation.failures,
        factual_flags: factual.flags || [],
        call_plan_cards: callPlanCards,
        gates,
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
        draft_content_hash: draftSha,
        research_sha256: row.research_sha256,
        field_exclusions: fieldExclusions,
        proposed_content_hash: proposedContentHash,
        production_apply_allowed: portPass,
        publication_gates_pass: portPass,
        proposed_guide_ref: `qa-evidence/stage68-bootstrap-47/proposed-guides/${landingSlug}.json`,
        rollback_ref: `qa-evidence/stage68-bootstrap-47/rollback/${landingSlug}.production-snapshot.json`,
        corrected_draft_ref: `qa-evidence/stage68-bootstrap-47/corrected-drafts/${landingSlug}.json`,
        terminals_proposed_ref: `qa-evidence/stage68-bootstrap-47/terminals-proposed/${row.app_port_id}.json`,
        owner_approval_status: 'PENDING',
        owner_bucket: ownerBucket,
        identifier_confidence: row.identifier_confidence,
      });
    }

    const approved = manifestPorts.filter((p) => p.production_apply_allowed);
    const releaseBundleHash = crypto
      .createHash('sha256')
      .update(
        stableStringify(
          approved.map((p) => ({
            landing_slug: p.landing_slug,
            app_port_id: p.app_port_id,
            proposed_content_hash: p.proposed_content_hash,
            draft_content_hash: p.draft_content_hash,
            research_sha256: p.research_sha256,
          }))
        )
      )
      .digest('hex');

    const verdict =
      passing === 0 ? 'BLOCKED' : passing === selected.length ? 'READY_FOR_OWNER_REVIEW' : 'PARTIAL';

    const manifest = {
      schema_version: 1,
      lock_version: LOCK,
      status: verdict,
      owner_publication_authorized: false,
      created_at_utc: lockedAt,
      production_baseline_sha: PRODUCTION_BASELINE_SHA,
      worktree_head_sha: head,
      verified_research_commit: patchMeta.verified_research_commit,
      bundle_idempotency_hash: releaseBundleHash,
      candidate_count_selected: selected.length,
      passing_all_gates: passing,
      slugs_inspected: selected.map((p) => p.landing_slug).sort(),
      slugs_approved: approved.map((p) => p.landing_slug).sort(),
      ports: manifestPorts,
      pipeline: {
        prompt_version: PROMPT_VERSION,
        recovery_mode: 'stage68-bootstrap-47',
        sanitizer: 'stage22-deterministic-v2.5-marker-strip',
      },
    };

    fs.writeFileSync(path.join(OUT, 'STAGE68_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    fs.writeFileSync(
      path.join(OUT, 'RECOVERY_RESULTS.json'),
      `${JSON.stringify({ generated_at: lockedAt, ports: recoveryRows }, null, 2)}\n`,
      'utf8'
    );

    console.log(
      JSON.stringify(
        {
          verdict,
          passing,
          selected: selected.length,
          approved: approved.length,
          release_bundle: releaseBundleHash,
        },
        null,
        2
      )
    );
    if (passing === 0) process.exit(45);
  } finally {
    cleanup();
  }
}

main();

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft');
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence');
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');
const {
  containsInternalResearchLeak,
  collectGuidePassengerLeakBlob,
  preparePassengerGuideText,
} = require('./lib/publicGuideCopySanitize');
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview');
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields');
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot');
const { dryRunPortImport } = require('./lib/portResearchImport/transformResearchToPublic');
const { getPortMergePolicy } = require('./lib/portResearchImport/mergePolicy');

const REPO = path.join(__dirname, '..');
const PARENT_MANIFEST = path.join(REPO, 'qa-evidence/stage68-held-recovery-6/PARENT_STAGE68_MANIFEST.json');
const OUT = path.join(REPO, 'qa-evidence/stage68-held-recovery-6');
const HELD_SLUGS = [
  'oslo-norway',
  'st-croix-frederiksted-us-virgin-islands',
  'new-york-ny-united-states',
  'ocean-cay-msc-reserve-bahamas',
  'kefalonia-greece',
  'wilhelmshaven-germany',
];
const PREP_BUNDLE = 'd5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583';

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — stage68 held recovery preview</title>
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

function applyHeldDraftPatches(draft, landingSlug) {
  const d = draft;
  if (landingSlug === 'oslo-norway') {
    d.portInfo.description = d.portInfo.description.replace(
      / Without published LOA\/depth tables on the captured English page, berth metrics stay null beyond the named terminals\./,
      ' Confirm which quay your sailing uses on the daily programme.'
    );
  }
  if (landingSlug === 'st-croix-frederiksted-us-virgin-islands') {
    d.portInfo.description = d.portInfo.description.replace(
      / Door GPS remains unpublished on the extract — pins stay null despite the strong berth narrative\./,
      ''
    );
  }
  if (landingSlug === 'new-york-ny-united-states') {
    d.portInfo.description = d.portInfo.description.replace(
      / Passenger door WGS84 pins are not published as entrance surveys — pins stay null\. ?/,
      ''
    );
    d.gettingThere.distanceToCity =
      'Manhattan Cruise Terminal (711 12th Avenue): allow traffic buffers for Midtown. Brooklyn Cruise Terminal (Pier 12): Brooklyn Bridge and Dumbo are closer than from Manhattan. JFK, LaGuardia and Newark need timed transfers — confirm with your sailing. Cape Liberty in Bayonne is a separate embarkation facility; do not confuse it with NYC terminals.';
    d.gettingThere.distanceAnswer = d.gettingThere.distanceToCity;
    d.gettingThere.publicTransport =
      'Manhattan (MCT): 711 12th Avenue at West 55th Street — subway and bus via Columbus Circle; allow walk time in traffic. Brooklyn (BCT): Pier 12, Building 112 — use the GPS address on NYCEDC materials only. Airports (JFK, LGA, EWR): plan timed transfers with your sailing. Cape Liberty in Bayonne is not an NYC terminal — match your ticket to the facility on your documents.';
    if (Array.isArray(d.thingsToDo?.topThings)) {
      d.thingsToDo.topThings = d.thingsToDo.topThings.map((line) =>
        line.replace(/;\s*minutes Not verified\.?/gi, '; allow extra transfer time in traffic.')
      );
    }
  }
  if (landingSlug === 'ocean-cay-msc-reserve-bahamas') {
    d.portInfo.description = d.portInfo.description.replace(
      / Quay LOA\/door coordinates are not published as WGS84 on the page used — keep pins null\./,
      ''
    );
  }
  if (landingSlug === 'wilhelmshaven-germany') {
    d.thingsToDo.topThings = [
      'Wilhelmshaven waterfront / Jade bay — ~90 min when the ship grants shore leave.',
      'Nordhafen / Hannoverkai — NPorts lists 300 m LOA alongside; confirm whether your call is passenger-facing.',
      'Deep-water harbour / JadeWeserPort context — industrial gateway; NPorts does not market a regular cruise passenger programme.',
    ];
    d.gettingThere.distanceToCity =
      'Inner harbour is behind a dual-chamber sea lock. Walk or shuttle times from Hannoverkai into city sights vary — confirm on the daily programme.';
    d.gettingThere.distanceAnswer = d.gettingThere.distanceToCity;
    d.gettingThere.publicTransport = d.gettingThere.distanceToCity;
  }
  if (landingSlug === 'kefalonia-greece') {
    d.thingsToDo.topThings = [
      'Argostoli waterfront / town — immediate connection to the harbour per LTDKI.',
      'Melissani Cave — highlight on Visit Greece materials; plan a timed road trip.',
      'Myrtos viewpoint — only with a generous buffer; confirm parking and hours locally.',
    ];
    d.thingsToDo.practicalTip =
      'If the north mole is occupied, expect anchorage and tender service — budget extra queue time when several ships are in the area.';
  }
  return d;
}

function stripMapPinsForPolicy(terminals, landingSlug) {
  const policy = getPortMergePolicy(landingSlug);
  if (policy.allow_terminal_map_pin !== false && landingSlug !== 'kefalonia-greece') return terminals;
  return terminals.map((t) => ({
    ...t,
    latitude: null,
    longitude: null,
    map_precision_tier: 'none',
    map_precision_label: 'No map pin — confirm gangway location on the daily programme.',
  }));
}

function main() {
  const parent = JSON.parse(fs.readFileSync(PARENT_MANIFEST, 'utf8'));
  if (parent.bundle_idempotency_hash !== PREP_BUNDLE) throw new Error('parent bundle hash mismatch');
  const rowsBySlug = new Map(parent.ports.map((p) => [p.landing_slug, p]));
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO });
  const guides = loadPublicPortGuidesFile(REPO);
  const lockedAt = new Date().toISOString();
  const recoveryRows = [];
  const passingSlugs = [];

  try {
    for (const landingSlug of HELD_SLUGS) {
      const row = rowsBySlug.get(landingSlug);
      if (!row) throw new Error(`missing manifest row: ${landingSlug}`);
      const correctedPath = path.join(OUT, 'corrected-drafts', `${landingSlug}.json`);
      const wrap = JSON.parse(fs.readFileSync(correctedPath, 'utf8'));
      let draft = JSON.parse(JSON.stringify(wrap.draft));
      draft = applyHeldDraftPatches(draft, landingSlug);
      draft.landing_slug = landingSlug;
      draft.appPortId = row.app_port_id;

      const validation = validateEditorialDraft({
        draft,
        manifestRow: { ...row, landing_slug: landingSlug, app_port_id: row.app_port_id },
        researchRoot: compositeRoot,
      });
      const scan = scanDraftFields(draft);
      const ownerBucket = classifyOwnerBucket({
        validationOk: validation.ok,
        supportedAttractions: (draft.thingsToDo?.topThings || []).length,
        scan,
        unresolved: draft.researchImport?.unresolved_claims,
        editorialFailures: validation.failures,
      });

      const live = guides.byAppPortId[row.app_port_id] || {};
      let proposed = applyEditorialDraftToGuide({
        existingGuide: JSON.parse(JSON.stringify(live)),
        draft,
        fieldExclusions: [],
        lockMeta: { locked_at_utc: lockedAt, draft_source: 'stage68-held-recovery-6' },
      });
      const researchMerge = dryRunPortImport({
        researchRoot: compositeRoot,
        landingSlug,
        manifestRow: { ...row, qa_verdict: 'PASS' },
        existingGuide: proposed,
        existingTerminals: [],
        qaVerdict: 'PASS',
      });
      if (researchMerge.mergedGuide) {
        proposed = { ...proposed, ...researchMerge.mergedGuide, appPortId: row.app_port_id };
      }
      proposed = applyHeldDraftPatches(proposed, landingSlug);
      const draftLead = String(draft.portInfo?.description || '').trim();
      if (draftLead) {
        const lead = String(proposed.portInfo?.description || '').trim();
        if (!lead || containsInternalResearchLeak(lead)) {
          proposed.portInfo.description = draftLead;
        }
      }
      proposed = sanitizePassengerGuideSurfaces(proposed);
      if (!String(proposed.portInfo?.description || '').trim() && draftLead) {
        proposed.portInfo.description = draftLead;
      }
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        landing_slug: landingSlug,
        stage68_held_recovery: true,
        stage68_preparation_bundle_hash: PREP_BUNDLE,
        owner_publication_authorized: false,
      };

      let terminals = stripMapPinsForPolicy(researchMerge.mergedTerminals || [], landingSlug);
      const factual = reviewConsequentialClaims({
        guide: proposed,
        landingSlug,
        researchRoot: compositeRoot,
        fieldExclusions: [],
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
      const callPlanCards = (html.match(/pg-call-plan-card/g) || []).length;

      const gates = [
        { gate: 'editorial_draft_validation', ok: validation.ok, failures: validation.failures },
        { gate: 'owner_bucket_ready', ok: ownerBucket === 'READY_FOR_OWNER_APPROVAL', owner_bucket: ownerBucket },
        { gate: 'html_preview_validation', ok: htmlVal.ok, issues: htmlVal.issues },
        { gate: 'call_plan_cards', ok: callPlanCards >= 3, count: callPlanCards },
        {
          gate: 'port_lead_present',
          ok: Boolean(String(proposed.portInfo?.description || '').trim()),
        },
        {
          gate: 'passenger_leak_scan',
          ok: !containsInternalResearchLeak(collectGuidePassengerLeakBlob(proposed)),
        },
        { gate: 'factual_exclude', ok: !factual.exclude_from_release, reason: factual.exclude_reason },
      ];
      const portPass = gates.every((g) => g.ok !== false);

      fs.writeFileSync(path.join(OUT, 'corrected-drafts', `${landingSlug}.json`), `${JSON.stringify({ ...wrap, draft, owner_bucket: ownerBucket, validation, recovery_patches: 'stage68-held-recovery-6' }, null, 2)}\n`);
      fs.writeFileSync(path.join(OUT, 'proposed-guides', `${landingSlug}.json`), `${JSON.stringify(proposed, null, 2)}\n`);
      fs.writeFileSync(
        path.join(OUT, 'terminals-proposed', `${row.app_port_id}.json`),
        `${JSON.stringify({ terminals, gate: researchMerge.terminalGate }, null, 2)}\n`
      );
      fs.writeFileSync(path.join(OUT, 'previews-local-only', `${landingSlug}.html`), html, 'utf8');

      recoveryRows.push({
        landing_slug: landingSlug,
        app_port_id: row.app_port_id,
        owner_bucket: ownerBucket,
        publication_gates_pass: portPass,
        validation_failures: validation.failures,
        excluded_fields: scan.excluded_fields,
        gates,
        call_plan_cards: callPlanCards,
      });
      if (portPass) passingSlugs.push(landingSlug);
    }
  } finally {
    cleanup();
  }

  const bundlePayload = {
    schema_version: 1,
    status: passingSlugs.length ? 'READY_FOR_OWNER_REVIEW' : 'HELD',
    inspected: HELD_SLUGS.length,
    passing: passingSlugs.length,
    held: HELD_SLUGS.length - passingSlugs.length,
    slugs_inspected: HELD_SLUGS.slice(),
    slugs_approved: passingSlugs.slice().sort(),
    slugs_still_held: HELD_SLUGS.filter((s) => !passingSlugs.includes(s)).sort(),
    preparation_bundle_hash: PREP_BUNDLE,
    baseline_main: '90b981f409427bb81f29e6f736b0d35cae94e39e',
    recovery_at_utc: new Date().toISOString(),
    rows: recoveryRows,
  };
  bundlePayload.bundle_idempotency_hash = crypto
    .createHash('sha256')
    .update(stableStringify(bundlePayload))
    .digest('hex');

  fs.writeFileSync(path.join(OUT, 'STAGE68_HELD_RECOVERY_MANIFEST.json'), `${JSON.stringify(bundlePayload, null, 2)}\n`);
  fs.writeFileSync(path.join(OUT, 'RECOVERY_RESULTS.json'), `${JSON.stringify(bundlePayload, null, 2)}\n`);
  console.log(
    JSON.stringify({
      inspected: bundlePayload.inspected,
      passing: bundlePayload.passing,
      held: bundlePayload.held,
      slugs_approved: bundlePayload.slugs_approved,
      bundle_hash: bundlePayload.bundle_idempotency_hash,
    })
  );
  if (!passingSlugs.length) process.exit(47);
}

if (require.main === module) {
  main();
}

module.exports = {
  applyHeldDraftPatches,
  HELD_SLUGS,
  PREP_BUNDLE,
};

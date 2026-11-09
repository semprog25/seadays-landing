'use strict';

const fs = require('fs');
const path = require('path');
const { parseFrontmatter } = require('./resolveYaml');
const {
  evaluateTerminalPin,
  buildTerminalImportNote,
} = require('./terminalCoordinateGate');
const {
  sectionBody,
  extractThingsToDo,
  extractTravelerQuestions,
  extractCruiseTerminalArrival,
  firstParagraph,
  stripCitationMarkers,
} = require('./extractMarkdownSections');
const { mergeGuide, mergeTerminalLists, terminalSlugFromId } = require('./mergePublicGuide');

function readResearchMarkdown(researchRoot, landingSlug) {
  const p = path.join(researchRoot, 'by-port', `${landingSlug}.md`);
  return fs.readFileSync(p, 'utf8');
}

function researchToGuidePatch(meta, body) {
  const overview = sectionBody(body, 'Overview');
  const gettingThere = sectionBody(body, 'Getting there');
  const thingsToDo = extractThingsToDo(body);
  const travelerQuestions = extractTravelerQuestions(body);

  const patch = {
    appPortId: null,
    portName: meta.name || '',
    country: meta.country || '',
    portInfo: {
      description: stripCitationMarkers(firstParagraph(overview)),
    },
    gettingThere: {
      fromTerminal: extractCruiseTerminalArrival(body),
      publicTransport: stripCitationMarkers(firstParagraph(gettingThere)),
    },
    thingsToDo: thingsToDo
      ? {
          intro: stripCitationMarkers(thingsToDo.intro),
          topThings: thingsToDo.topThings.map(stripCitationMarkers).slice(0, 8),
          shortCall: stripCitationMarkers(thingsToDo.shortCall),
          standardCall: stripCitationMarkers(thingsToDo.standardCall),
          longerCall: stripCitationMarkers(thingsToDo.longerCall),
          practicalTip: stripCitationMarkers(thingsToDo.practicalTip),
        }
      : undefined,
    researchImport: {
      schema_version: meta.schema_version,
      researched_at_utc: meta.researched_at_utc,
      qa_verdict: meta.qa_verdict || null,
      travelerQuestions,
      verified_at_utc: meta.verified_at_utc,
    },
  };
  return patch;
}

function researchToTerminals(meta, countryId, landingSlug) {
  const terminals = Array.isArray(meta.terminals) ? meta.terminals : [];
  const gateReport = [];
  const importable = [];

  let sort = 10;
  for (const t of terminals) {
    const gate = evaluateTerminalPin(t);
    gateReport.push({
      terminal_id: t.terminal_id,
      name: t.name,
      importable: gate.importable,
      tier: gate.tier,
      reasons: gate.reasons,
      lat: gate.lat,
      lng: gate.lng,
    });
    if (!gate.importable) continue;

    const description = buildTerminalImportNote(t, gate);
    importable.push({
      terminal_id: t.terminal_id,
      name: t.name,
      slug: terminalSlugFromId(t.terminal_id, landingSlug),
      description,
      address: t.address || '',
      latitude: gate.lat,
      longitude: gate.lng,
      is_primary: sort === 10,
      sort_order: sort,
      country_id: countryId,
      map_precision_tier: gate.tier,
      map_precision_label: gate.label,
    });
    sort += 10;
  }

  return { gateReport, importable, mergeInput: importable };
}

/**
 * @returns {{
 *   publishable: boolean,
 *   reason: string,
 *   guidePatch: object|null,
 *   mergedGuide: object|null,
 *   terminalGate: object,
 *   mergedTerminals: object|null,
 *   diffSummary: object
 * }}
 */
function dryRunPortImport({
  researchRoot,
  landingSlug,
  manifestRow,
  existingGuide,
  existingTerminals,
  qaVerdict,
}) {
  if (qaVerdict === 'BLOCKED' || manifestRow?.qa_verdict === 'BLOCKED') {
    return {
      publishable: false,
      reason: 'qa_blocked',
      guidePatch: null,
      mergedGuide: null,
      terminalGate: { skipped: true },
      mergedTerminals: null,
      diffSummary: { action: 'no_publishable_changes' },
    };
  }

  if (!manifestRow?.app_port_id || manifestRow.identifier_status === 'unresolved') {
    return {
      publishable: false,
      reason: 'identifier_unresolved',
      guidePatch: null,
      mergedGuide: null,
      terminalGate: { skipped: true },
      mergedTerminals: null,
      diffSummary: { action: 'no_publishable_changes' },
    };
  }

  const raw = readResearchMarkdown(researchRoot, landingSlug);
  const { meta, body } = parseFrontmatter(raw);
  const guidePatch = researchToGuidePatch(meta, body);
  guidePatch.appPortId = manifestRow.app_port_id;

  const { gateReport, importable } = researchToTerminals(meta, manifestRow.country_id, landingSlug);

  const mergedGuide = existingGuide ? mergeGuide(existingGuide, guidePatch) : guidePatch;
  const preservePrimary = landingSlug === 'hamburg-germany';
  const terminalMerge = existingTerminals
    ? mergeTerminalLists(existingTerminals, importable, { landingSlug, preserveExistingPrimary: preservePrimary })
    : { terminals: importable, report: { added: importable.map((t) => t.name), updated: [], skipped: [], preserved: [] } };

  const diffSummary = {
    action: 'dry_run_merge_proposal',
    guide_fields_considered: ['portInfo.description', 'gettingThere', 'thingsToDo'],
    guide_preserved: ['hero', 'shorePlansFirst', 'sourcesUsed', 'lastEnrichment'],
    terminals_importable_count: importable.length,
    terminals_gated_out: gateReport.filter((g) => !g.importable).length,
    terminal_merge: terminalMerge.report,
  };

  return {
    publishable: false,
    reason: 'dry_run_only_not_approved',
    guidePatch,
    mergedGuide,
    terminalGate: { gateReport, importable_count: importable.length },
    mergedTerminals: terminalMerge.terminals,
    diffSummary,
  };
}

module.exports = {
  dryRunPortImport,
  researchToGuidePatch,
  researchToTerminals,
  readResearchMarkdown,
};

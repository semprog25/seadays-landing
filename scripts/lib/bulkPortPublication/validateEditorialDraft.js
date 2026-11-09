'use strict';

const { containsInternalResearchLeak, preparePassengerGuideText } = require('../publicGuideCopySanitize');
const { isTruncatedResearchCopy } = require('../researchCopyGuards');
const { validateDraftStructure } = require('./editorialDraftSchema');
const { listGuideFieldIssues } = require('./editorialReadiness');
const { runFactualRiskChecks } = require('./factualRiskChecks');
const { verifyResearchPortSha } = require('../portResearchImport/verifyResearchSha');
const { buildPhase1GuideHtml } = require('../portGuideSections');

function validateEditorialDraft({ draft, manifestRow, researchRoot }) {
  const failures = [];
  const warnings = [];

  const struct = validateDraftStructure(draft);
  if (!struct.ok) failures.push(...struct.errors.map((e) => `schema_${e}`));

  if (manifestRow?.landing_slug !== draft.landing_slug) failures.push('slug_manifest_mismatch');
  if (manifestRow?.app_port_id !== draft.appPortId) failures.push('app_port_id_mismatch');

  if (researchRoot && manifestRow) {
    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug: draft.landing_slug,
      manifestRow,
    });
    if (!sha.ok) failures.push('research_sha_mismatch');
  }

  const guideShape = {
    portInfo: draft.portInfo,
    gettingThere: draft.gettingThere,
    thingsToDo: draft.thingsToDo,
    researchImport: draft.researchImport,
  };
  for (const issue of listGuideFieldIssues(guideShape)) {
    failures.push(`passenger_${issue}`);
  }

  const blob = JSON.stringify(draft);
  if (/\*\*/.test(blob)) failures.push('raw_markdown_in_draft');
  if (containsInternalResearchLeak(blob)) failures.push('research_leak_in_draft');

  for (const field of [
    draft.portInfo?.description,
    draft.gettingThere?.fromTerminal,
    draft.thingsToDo?.shortCall,
    draft.thingsToDo?.standardCall,
    draft.thingsToDo?.longerCall,
  ]) {
    if (isTruncatedResearchCopy(String(field || ''))) failures.push('truncated_passenger_field');
  }

  const genericFaq =
    /Entry and visa rules depend on nationality/i.test(blob) &&
    draft.researchImport?.unresolved_claims?.includes('not_passenger_editorial_tier');

  try {
    const html = buildPhase1GuideHtml({
      port: {
        name: draft.portName,
        slug: draft.landing_slug,
        appPortId: draft.appPortId,
        country: draft.country,
      },
      guide: guideShape,
      terminals: [],
      affiliate: { show: false },
    });
    if (!html.includes('pg-call-plan-card--short')) failures.push('render_missing_short_card');
    if (!html.includes('pg-cruise-tip')) warnings.push('render_missing_cruise_tip_style');
    if (html.includes('port-terminal-map')) failures.push('unexpected_terminal_map');
    if (containsInternalResearchLeak(html)) failures.push('leak_in_render_html');
  } catch (err) {
    failures.push(`render_error:${err.message}`);
  }

  if (genericFaq) warnings.push('generic_politics_boilerplate');

  const factual = runFactualRiskChecks({ draft, manifestRow });
  for (const flag of factual.flags) {
    if (/internal_research|insufficient_attractions|research_itinerary/.test(flag)) failures.push(`factual_${flag}`);
    else warnings.push(`factual_${flag}`);
  }

  return {
    ok: failures.length === 0,
    failures,
    warnings,
    factual,
    editorial_passenger_ready: failures.length === 0,
    factually_verified: false,
  };
}

module.exports = { validateEditorialDraft };

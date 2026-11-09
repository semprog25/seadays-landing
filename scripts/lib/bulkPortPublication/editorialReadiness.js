'use strict';

const {
  containsInternalResearchLeak,
  preparePassengerGuideText,
  usesPassengerEditorialLead,
} = require('../publicGuideCopySanitize');
const { isTruncatedResearchCopy } = require('../researchCopyGuards');
const { readResearchMarkdown, researchToGuidePatch } = require('../portResearchImport/transformResearchToPublic');
const { parseFrontmatter } = require('../portResearchImport/resolveYaml');
const { STAGE15_PILOT_GUIDES } = require('../stage15PilotEditorial');

const AALBORG_MANUAL_SLUG = 'aalborg-denmark';

function listGuideFieldIssues(guide) {
  const issues = [];
  if (!guide) {
    issues.push('missing_guide');
    return issues;
  }
  const desc = String(guide.portInfo?.description || '').trim();
  if (!desc || desc.length < 40) issues.push('thin_or_empty_description');
  if (/\*\*/.test(desc)) issues.push('markdown_in_description');

  const gt = guide.gettingThere || {};
  if (!String(gt.fromTerminal || '').trim()) issues.push('missing_from_terminal');
  if (!String(gt.distanceAnswer || gt.distanceToCity || '').trim()) issues.push('missing_distance_guidance');

  const td = guide.thingsToDo || {};
  const top = td.topThings || [];
  if (top.length < 3) issues.push(`top_things_${top.length}_of_3`);
  if (top.length > 5) issues.push(`top_things_${top.length}_over_5`);
  for (const field of ['shortCall', 'standardCall', 'longerCall', 'practicalTip']) {
    const text = String(td[field] || '').trim();
    if (!text) issues.push(`missing_${field}`);
    else checkText(text, field, issues);
  }
  for (let i = 0; i < top.length; i += 1) {
    checkText(top[i], `topThings[${i}]`, issues);
  }
  if (String(gt.fromTerminal || '').trim()) checkText(gt.fromTerminal, 'fromTerminal', issues);
  return issues;
}

function checkText(text, label, issues) {
  if (/\*\*/.test(text)) issues.push(`markdown_${label}`);
  if (containsInternalResearchLeak(text)) issues.push(`research_leak_${label}`);
  if (isTruncatedResearchCopy(text)) issues.push(`truncated_${label}`);
}

function assessResearchPatchQuality(patch) {
  const issues = [];
  if (!patch) {
    issues.push('no_patch');
    return { issues, auto_publishable: false };
  }
  listGuideFieldIssues(patch).forEach((i) => issues.push(`patch_${i}`));
  const desc = String(patch.portInfo?.description || '');
  if (BOILERPLATE_LIKE(desc)) issues.push('patch_boilerplate_description');
  return { issues, auto_publishable: false };
}

const BOILERPLATE_LIKE = (text) =>
  /excellent facilities|vibrant port destination|beautiful harbor|gateway to/i.test(String(text || ''));

function editorialSourceForPort({ landingSlug, appPortId, guide }) {
  if (usesPassengerEditorialLead(guide)) {
    return { source: 'live_passenger_editorial', module: null, on_main: true };
  }
  if (appPortId === 'aalborg' || landingSlug === AALBORG_MANUAL_SLUG) {
    return { source: 'live_manual_aalborg', module: null, on_main: true };
  }
  if (STAGE15_PILOT_GUIDES[appPortId]) {
    return { source: 'stage15_editorial_module', module: 'stage15PilotEditorial', on_main: usesPassengerEditorialLead(guide) };
  }
  return { source: 'none', module: null, on_main: false };
}

function classifyPassengerReadiness({ landingSlug, appPortId, guide, researchRoot }) {
  const liveIssues = listGuideFieldIssues(guide);
  const editorial = editorialSourceForPort({ landingSlug, appPortId, guide });
  const liveReady = liveIssues.length === 0 && usesPassengerEditorialLead(guide);

  let researchDiagnostics = null;
  if (researchRoot && landingSlug) {
    try {
      const raw = readResearchMarkdown(researchRoot, landingSlug);
      const { meta, body } = parseFrontmatter(raw);
      const patch = researchToGuidePatch(meta, body);
      researchDiagnostics = assessResearchPatchQuality(patch);
      researchDiagnostics.research_sha256 = meta.sha256 || null;
    } catch (err) {
      researchDiagnostics = { issues: [`research_read_failed:${err.message}`], auto_publishable: false };
    }
  }

  const needsReviewReasons = [];
  if (!liveReady) {
    if (liveIssues.length) needsReviewReasons.push(...liveIssues.map((i) => `live_${i}`));
    if (!usesPassengerEditorialLead(guide)) needsReviewReasons.push('not_passenger_editorial_tier');
  }
  if (researchDiagnostics?.issues?.length) {
    needsReviewReasons.push('raw_research_not_auto_publishable');
  }

  return {
    editorial_source: editorial,
    live_field_issues: liveIssues,
    live_passenger_ready: liveReady,
    research_diagnostics: researchDiagnostics,
    needs_review_reasons: needsReviewReasons,
  };
}

module.exports = {
  listGuideFieldIssues,
  assessResearchPatchQuality,
  editorialSourceForPort,
  classifyPassengerReadiness,
  usesPassengerEditorialLead,
};

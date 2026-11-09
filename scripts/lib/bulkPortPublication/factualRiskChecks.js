'use strict';

const { containsInternalResearchLeak, isResearchItineraryCopy } = require('../publicGuideCopySanitize');

const GENERIC_FAQ_RE = /^(Entry and visa rules depend on nationality|Check current advisories)/i;
const UNSAFE_TIMING_RE = /\b(\d{1,2})\s*minute walk\b/i;
const VISA_ASSERT_RE = /\bvisa[- ]free\b|\bno visa required\b/i;
const BERTH_CONFLICT_RE = /\b(T1|T2|T3|Terminal 1|Terminal 2).*\b(and|or).*\b(T1|T2|T3|Terminal 1|Terminal 2)\b/i;

function runFactualRiskChecks({ draft, manifestRow }) {
  const flags = [];
  const slug = draft.landing_slug || '';
  const gt = draft.gettingThere || {};
  const td = draft.thingsToDo || {};
  const blob = JSON.stringify(draft).toLowerCase();

  if (manifestRow?.collision_group) flags.push('identifier_collision_group');
  if (manifestRow?.identifier_status === 'inferred') flags.push('identifier_inferred');

  const terminalInSlug = /cruise-terminal|port-terminal/i.test(slug);
  const cityNamedInDesc = draft.portName && blob.includes(String(draft.portName).toLowerCase());
  if (terminalInSlug && !cityNamedInDesc && /city center|downtown|old town/i.test(blob)) {
    flags.push('terminal_vs_destination_city_risk');
  }

  for (const field of ['walkingTime', 'distanceAnswer', 'distanceToCity', 'fromTerminal']) {
    const text = String(gt[field] || '');
    if (UNSAFE_TIMING_RE.test(text) && !/confirm|programme|berth|depending/i.test(text)) {
      flags.push(`unsupported_walk_transfer_${field}`);
    }
  }

  const excursionText = [td.shortCall, td.standardCall, td.longerCall, td.intro].join(' ');
  if (/(petra|wadi rum|jerusalem|bremen city|hanoi|ho chi minh)/i.test(excursionText) && /short call|4½|4\.5|tight/i.test(excursionText)) {
    flags.push('long_distance_excursion_feasibility');
  }

  if (VISA_ASSERT_RE.test(blob) && !/confirm|nationality|passport/i.test(blob)) {
    flags.push('unsupported_visa_assertion');
  }

  if (BERTH_CONFLICT_RE.test(String(gt.fromTerminal || ''))) {
    flags.push('conflicting_berth_names');
  }

  for (const field of ['shortCall', 'standardCall', 'longerCall']) {
    const text = String(td[field] || '').trim();
    if (!text) flags.push(`incomplete_call_plan_${field}`);
    if (GENERIC_FAQ_RE.test(text)) flags.push(`generic_faq_style_${field}`);
    if (isResearchItineraryCopy(text)) flags.push(`research_itinerary_${field}`);
  }

  if (/\b(wheelchair|step[- ]free|fully accessible)\b/i.test(blob) && !/confirm|ask the line|not audited/i.test(blob)) {
    flags.push('unverified_accessibility_claim');
  }
  if (/\b(safe area|generally safe|low crime)\b/i.test(blob) && !/confirm|official|advisory/i.test(blob)) {
    flags.push('unverified_safety_claim');
  }

  if (containsInternalResearchLeak(blob)) flags.push('internal_research_language');

  const topCount = (td.topThings || []).length;
  if (topCount < 3) flags.push(`insufficient_attractions_${topCount}`);

  const unresolved = draft.researchImport?.unresolved_claims || [];
  if (unresolved.some((u) => /terminal_needs_review|null_unverified|incomplete_capture/.test(u))) {
    flags.push('terminal_verification_gap');
  }

  return {
    flags: [...new Set(flags)],
    factually_verified: false,
    schema_pass_alone_is_insufficient: true,
  };
}

module.exports = { runFactualRiskChecks };

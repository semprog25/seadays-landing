'use strict';

const { preparePassengerGuideText } = require('../publicGuideCopySanitize');
const { synthesizePassengerDraft } = require('./passengerDraftSynthesize');
const { sanitizePassengerDraftSurfaces } = require('./sanitizePassengerDraftSurfaces');
const { loadFactPack } = require('./researchFactPack');

const GENERIC_CALL_PLANS = {
  shortCall: 'Stay near the port area and keep a generous buffer before all-aboard.',
  standardCall:
    'Combine a central walk, one attraction, and lunch if times allow—start back well before all-aboard.',
  longerCall:
    'A second stop or coach outing is realistic only with confirmed transport and an eight-hour or longer window.',
};

const DISTANCE_FALLBACK =
  'Check the daily programme for your berth and allow extra time on turnaround or tender days.';

const SANITIZE_FIELD_PATHS = [
  'portInfo.description',
  'gettingThere.fromTerminal',
  'gettingThere.distanceAnswer',
  'thingsToDo.intro',
  'thingsToDo.practicalTip',
];

function applyTargetedPassengerFixes(draft, existingGuide) {
  const liveTop = (existingGuide?.thingsToDo?.topThings || [])
    .map((t) => preparePassengerGuideText(String(t || ''), { label: 'liveTop' }))
    .filter(Boolean);
  let topThings = [...(draft.thingsToDo?.topThings || []), ...liveTop];
  const seen = new Set();
  topThings = topThings
    .filter((t) => {
      const key = t.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 5);
  if (!draft.thingsToDo) draft.thingsToDo = {};
  draft.thingsToDo.topThings = topThings;

  for (const key of ['shortCall', 'standardCall', 'longerCall']) {
    draft.thingsToDo[key] = GENERIC_CALL_PLANS[key];
  }

  if (!String(draft.portInfo?.description || '').trim() && existingGuide?.portInfo?.description) {
    const desc = preparePassengerGuideText(existingGuide.portInfo.description, { label: 'description' });
    if (desc) {
      if (!draft.portInfo) draft.portInfo = {};
      draft.portInfo.description = desc;
    }
  }

  for (const fieldPath of SANITIZE_FIELD_PATHS) {
    const parts = fieldPath.split('.');
    let holder = draft;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!holder[parts[i]]) holder[parts[i]] = {};
      holder = holder[parts[i]];
    }
    const key = parts[parts.length - 1];
    const cleaned = preparePassengerGuideText(String(holder[key] || ''), { label: fieldPath });
    if (cleaned) holder[key] = cleaned;
  }

  if (!String(draft.gettingThere?.distanceAnswer || '').trim()) {
    if (!draft.gettingThere) draft.gettingThere = {};
    draft.gettingThere.distanceAnswer = DISTANCE_FALLBACK;
    draft.gettingThere.distanceToCity = DISTANCE_FALLBACK;
  } else if (!String(draft.gettingThere.distanceToCity || '').trim()) {
    draft.gettingThere.distanceToCity = draft.gettingThere.distanceAnswer;
  }

  return sanitizePassengerDraftSurfaces(draft);
}

/**
 * Targeted editorial recovery: synthesize passenger surfaces, then prefer live strengths,
 * generic call plans, v2.5 sanitization, and hedged distance — not blind full rescore reruns.
 */
function buildTargetedNeedsReviewDraft({ row, existingGuide, researchRoot }) {
  const factPack = loadFactPack(researchRoot, row.landing_slug);
  factPack.research_sha256 = row.research_sha256 || factPack.research_sha256;
  let draft = synthesizePassengerDraft({
    landingSlug: row.landing_slug,
    appPortId: row.app_port_id,
    portName: row.name?.split(',')[0] || existingGuide?.portName || row.app_port_id,
    country: row.country || existingGuide?.country,
    factPack,
    existingGuide,
  });
  draft = applyTargetedPassengerFixes(draft, existingGuide);
  if (draft.researchImport) {
    draft.researchImport.recovery_mode = 'stage62-targeted-editorial';
  }
  return draft;
}

function scoreNeedsReviewCandidate(row) {
  let score = row.thin_score || 0;
  const diag = row.editorial_readiness?.research_diagnostics?.issues || [];
  if (diag.some((i) => i.includes('markdown'))) score += 8;
  if (!diag.some((i) => i.includes('research_leak'))) score += 5;
  if (row.policy_dry_run?.ok) score += 10;
  if (row.qa_verdict === 'PASS') score += 3;
  if (row.identifier_status === 'resolved') score += 3;
  if (row.research_sha_verified) score += 3;
  return score;
}

function selectNeedsReviewRecoveryPool({ eligibilityPorts, publishedSlugs, excludeSlugs, limit = 25 }) {
  const picked = [];
  const skipped = [];
  const sorted = [...eligibilityPorts].sort(
    (a, b) => scoreNeedsReviewCandidate(b) - scoreNeedsReviewCandidate(a) || a.landing_slug.localeCompare(b.landing_slug)
  );
  for (const row of sorted) {
    if (picked.length >= limit) break;
    if (publishedSlugs.has(row.landing_slug)) {
      skipped.push({ landing_slug: row.landing_slug, reason: 'already_published' });
      continue;
    }
    if (excludeSlugs?.has(row.landing_slug)) {
      skipped.push({ landing_slug: row.landing_slug, reason: 'policy_hold' });
      continue;
    }
    if (row.qa_verdict !== 'PASS' || row.identifier_status !== 'resolved' || !row.research_sha_verified) {
      skipped.push({ landing_slug: row.landing_slug, reason: 'research_gate' });
      continue;
    }
    if (row.policy_dry_run?.ok === false) {
      skipped.push({ landing_slug: row.landing_slug, reason: 'gateway_terminal_policy' });
      continue;
    }
    picked.push(row);
  }
  return { picked, skipped, eligible_count: sorted.length };
}

module.exports = {
  GENERIC_CALL_PLANS,
  applyTargetedPassengerFixes,
  buildTargetedNeedsReviewDraft,
  scoreNeedsReviewCandidate,
  selectNeedsReviewRecoveryPool,
};

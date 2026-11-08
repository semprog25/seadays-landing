'use strict';

const { containsInternalResearchLeak } = require('../publicGuideCopySanitize');
const { loadResearchSources } = require('./parseResearchSources');

const AUTHORITATIVE_PUBLISHER_RE =
  /havn|port authority|EU —|DP World|Ports Authority|stavangerregionen|bremerhaven|cruiseanløp/i;

function claimTier(text, sources) {
  if (!text || containsInternalResearchLeak(text)) return { tier: 'exclude', reason: 'research_leak_or_unverified_wording' };
  if (/\b(gap|stay null|not verified|unverified this pass)\b/i.test(text)) {
    return { tier: 'exclude', reason: 'explicit_evidence_gap' };
  }
  if (/\b\d+\s*minute walk\b/i.test(text) && !/confirm|programme|berth/i.test(text)) {
    return { tier: 'secondary', reason: 'timing_needs_owner_confirm', confidence: 'low' };
  }
  const hasAuth = sources.some((s) => s.url && AUTHORITATIVE_PUBLISHER_RE.test(s.publisher || ''));
  if (hasAuth) return { tier: 'authoritative', confidence: 'high' };
  if (sources.some((s) => s.url)) return { tier: 'secondary', confidence: 'medium' };
  return { tier: 'unverified', confidence: 'low', reason: 'no_url_backing_in_sources_table' };
}

function reviewConsequentialClaims({ guide, landingSlug, researchRoot, fieldExclusions = [] }) {
  const sources = loadResearchSources(researchRoot, landingSlug);
  const exclusions = new Set(fieldExclusions);
  const claims = [];
  const removed = [];

  const blocks = [
    { area: 'terminal_identity', field: 'gettingThere.fromTerminal', text: guide.gettingThere?.fromTerminal },
    { area: 'transfer_guidance', field: 'gettingThere.distanceAnswer', text: guide.gettingThere?.distanceAnswer },
    { area: 'walking_guidance', field: 'gettingThere.walkingTime', text: guide.gettingThere?.walkingTime },
    { area: 'port_overview', field: 'portInfo.description', text: guide.portInfo?.description },
    { area: 'excursion_short', field: 'thingsToDo.shortCall', text: guide.thingsToDo?.shortCall },
    { area: 'excursion_standard', field: 'thingsToDo.standardCall', text: guide.thingsToDo?.standardCall },
    { area: 'excursion_long', field: 'thingsToDo.longerCall', text: guide.thingsToDo?.longerCall },
    { area: 'practical_tip', field: 'thingsToDo.practicalTip', text: guide.thingsToDo?.practicalTip },
  ];

  for (const b of blocks) {
    if (exclusions.has(b.field)) {
      removed.push({ field: b.field, reason: 'field_excluded_stage23' });
      continue;
    }
    const tier = claimTier(String(b.text || ''), sources);
    if (tier.tier === 'exclude') removed.push({ field: b.field, reason: tier.reason, excerpt: String(b.text || '').slice(0, 80) });
    claims.push({
      area: b.area,
      field: b.field,
      tier: tier.tier,
      confidence: tier.confidence || tier.tier,
      supporting_sources: sources
        .filter((s) => s.url)
        .slice(0, 4)
        .map((s) => ({ id: s.id, url: s.url, accessed_utc: s.accessed_utc, publisher: s.publisher })),
    });
  }

  (guide.thingsToDo?.topThings || []).forEach((t, i) => {
    const field = `thingsToDo.topThings[${i}]`;
    if (exclusions.has(field)) {
      removed.push({ field, reason: 'field_excluded_stage23' });
      return;
    }
    const tier = claimTier(String(t), sources);
    if (tier.tier === 'exclude') removed.push({ field, reason: tier.reason, excerpt: t });
    claims.push({
      area: 'attraction',
      field,
      tier: tier.tier,
      confidence: tier.confidence || tier.tier,
      supporting_sources: sources.filter((s) => s.url).slice(0, 2),
    });
  });

  const consequential_unresolved = claims.filter(
    (c) => c.tier === 'unverified' && /terminal|transfer|walking|excursion/.test(c.area)
  );
  const blocked = consequential_unresolved.length >= 2 && removed.length === 0;

  return {
    landing_slug: landingSlug,
    sources_table: sources,
    claims,
    high_risk_removed: removed,
    exclude_from_release: blocked,
    exclude_reason: blocked ? 'multiple_unverified_consequential_claims' : null,
  };
}

module.exports = { reviewConsequentialClaims, claimTier };

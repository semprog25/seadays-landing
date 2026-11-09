'use strict';

const { containsInternalResearchLeak } = require('../publicGuideCopySanitize');

const RESEARCH_PHRASING_RE = /\b(hours not verified|not verified this pass|metres gap|door pins stay null|stay null|LOA unread|quay LOA)\b/i;

const FIELD_PATHS = [
  ['portInfo', 'description'],
  ['gettingThere', 'fromTerminal'],
  ['gettingThere', 'distanceAnswer'],
  ['gettingThere', 'walkingTime'],
  ['gettingThere', 'publicTransport'],
  ['thingsToDo', 'intro'],
  ['thingsToDo', 'shortCall'],
  ['thingsToDo', 'standardCall'],
  ['thingsToDo', 'longerCall'],
  ['thingsToDo', 'practicalTip'],
];

function getNested(obj, pathParts) {
  return pathParts.reduce((o, k) => (o && o[k] != null ? o[k] : ''), obj);
}

function summarizeLiveQuality(guide) {
  if (!guide) return { tier: 'missing', notes: 'No production guide row' };
  const desc = String(guide.portInfo?.description || '');
  const top = guide.thingsToDo?.topThings || [];
  if (desc.length < 60) return { tier: 'thin', notes: 'Short or empty overview' };
  if (/excellent facilities|vibrant port|beautiful harbor/i.test(desc)) {
    return { tier: 'boilerplate', notes: 'Generic marketing copy' };
  }
  if (top.length >= 3 && desc.length >= 100) return { tier: 'usable', notes: 'Structured guide with attractions list' };
  return { tier: 'mixed', notes: 'Some fields usable; shore plans may be thin' };
}

function beforeAfterCompare(live, draft) {
  const changes = [];
  const preserved = [];
  for (const pathParts of FIELD_PATHS) {
    const key = pathParts.join('.');
    const liveVal = String(getNested(live, pathParts) || '').trim();
    const draftVal = String(getNested(draft, pathParts) || '').trim();
    if (!liveVal && draftVal) changes.push({ field: key, change: 'added', preview: draftVal.slice(0, 120) });
    else if (liveVal && !draftVal) changes.push({ field: key, change: 'cleared', preview: liveVal.slice(0, 80) });
    else if (liveVal && draftVal && liveVal !== draftVal) {
      if (draftVal.length > liveVal.length + 40 || !liveVal.includes(draftVal.slice(0, 30))) {
        changes.push({ field: key, change: 'rewritten', preview: draftVal.slice(0, 120) });
      } else preserved.push(key);
    } else if (liveVal && liveVal === draftVal) preserved.push(key);
  }
  const liveTop = live?.thingsToDo?.topThings || [];
  const draftTop = draft?.thingsToDo?.topThings || [];
  if (JSON.stringify(liveTop) !== JSON.stringify(draftTop)) {
    changes.push({
      field: 'thingsToDo.topThings',
      change: 'attractions_updated',
      preview: `${liveTop.length} → ${draftTop.length}: ${draftTop.slice(0, 3).join('; ')}`,
    });
  }
  return { changes, preserved_strengths: preserved };
}

function scanDraftFields(draft) {
  const verified = [];
  const excluded = [];
  const risks = [];
  for (const pathParts of FIELD_PATHS) {
    const key = pathParts.join('.');
    const text = String(getNested(draft, pathParts) || '').trim();
    if (!text) continue;
    if (containsInternalResearchLeak(text) || RESEARCH_PHRASING_RE.test(text)) {
      excluded.push({ field: key, reason: 'research_or_unverified_phrasing', excerpt: text.slice(0, 100) });
      continue;
    }
    if (/\d+\s*min buffer/i.test(text) && !/confirm|programme/i.test(text)) {
      risks.push({ field: key, risk: 'timing_claim_needs_owner_confirm' });
    }
    verified.push({ field: key, confidence: 'medium', note: 'Passes automated passenger sanitizer' });
  }
  for (let i = 0; i < (draft.thingsToDo?.topThings || []).length; i += 1) {
    const t = draft.thingsToDo.topThings[i];
    const key = `thingsToDo.topThings[${i}]`;
    if (containsInternalResearchLeak(t) || RESEARCH_PHRASING_RE.test(t)) {
      excluded.push({ field: key, reason: 'unverified_attraction_wording', excerpt: t });
    } else {
      verified.push({ field: key, confidence: 'medium', note: 'Sourced from research markdown' });
    }
  }
  return { verified_claims: verified, excluded_fields: excluded, field_risks: risks };
}

function mapClaimsToSources(draft, sources, scan) {
  const mapped = [];
  const text = JSON.stringify(draft);
  const citeIds = [...new Set((text.match(/\[S\d+\]/g) || []).map((c) => c.replace(/[[\]]/g, '')))];
  for (const src of sources) {
    if (!citeIds.length && src.id === 'S1') {
      mapped.push({
        claim_area: 'terminal_and_port_policy',
        source_id: src.id,
        url: src.url,
        accessed_utc: src.accessed_utc,
        confidence: src.url ? 'high' : 'medium',
      });
    }
  }
  for (const src of sources.slice(0, 6)) {
    if (src.url && /havn|cruise|port authority|DP World|EU —/i.test(src.publisher || '')) {
      mapped.push({
        claim_area: 'authoritative_operator',
        source_id: src.id,
        url: src.url,
        accessed_utc: src.accessed_utc,
        confidence: 'high',
      });
    }
  }
  return [...new Map(mapped.map((m) => [`${m.source_id}:${m.claim_area}`, m])).values()].slice(0, 8);
}

function classifyOwnerBucket({ validationOk, supportedAttractions, scan, unresolved, editorialFailures }) {
  if (editorialFailures?.length) return 'NEEDS_EDITORIAL_FIX';
  if (!validationOk) return 'NEEDS_EDITORIAL_FIX';
  if (supportedAttractions < 3) return 'NEEDS_EDITORIAL_FIX';
  if (unresolved?.includes('incomplete_capture') || unresolved?.some((u) => u.includes('collision'))) {
    return 'BLOCKED';
  }
  const hardExclusions = scan.excluded_fields.filter((e) =>
    /portInfo.description|gettingThere/.test(e.field)
  );
  if (hardExclusions.length) return 'NEEDS_FACT_CHECK';
  if (scan.field_risks.length > 3) return 'NEEDS_FACT_CHECK';
  return 'READY_FOR_OWNER_APPROVAL';
}

function recommendDecision(bucket) {
  const map = {
    READY_FOR_OWNER_APPROVAL: 'APPROVE_AFTER_SPOT_CHECK',
    NEEDS_FACT_CHECK: 'REVIEW_EXCLUSIONS_THEN_APPROVE',
    NEEDS_EDITORIAL_FIX: 'HOLD',
    BLOCKED: 'DO_NOT_PUBLISH',
  };
  return map[bucket] || 'HOLD';
}

module.exports = {
  beforeAfterCompare,
  scanDraftFields,
  mapClaimsToSources,
  classifyOwnerBucket,
  recommendDecision,
  summarizeLiveQuality,
  RESEARCH_PHRASING_RE,
};

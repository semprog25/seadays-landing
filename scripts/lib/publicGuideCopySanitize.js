'use strict';

const { stripWikiCitationMarkers } = require('./portCopyHygiene');
const { isTruncatedResearchCopy, assertResearchCopyNotTruncated } = require('./researchCopyGuards');

const INTERNAL_RESEARCH_LEAK_RE = [
  /\bnull\s*\/\s*unverified\b/i,
  /\bnot copied without matching\b/i,
  /\bresearch pass\b/i,
  /\bthis pass\b/i,
  /\bverified_approx\b/i,
  /\bway\/\d+\b/i,
  /\beditorial estimates\b/i,
  /\bOSM\b.*\bpin\b/i,
  /\b\d+\s*\+\s*\d+\s*\+\s*\d+\s*=/,
  /\(\s*\d+\s*\+\s*\d+/,
];

const MAX_QUICK_FACT_CHARS = 120;

function stripMarkdownEmphasis(text) {
  return String(text || '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/`([^`]+)`/g, '$1');
}

function containsInternalResearchLeak(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return INTERNAL_RESEARCH_LEAK_RE.some((re) => re.test(s));
}

function preparePassengerGuideText(text, opts = {}) {
  const raw = stripWikiCitationMarkers(stripMarkdownEmphasis(text));
  if (!raw) return '';
  if (containsInternalResearchLeak(raw)) {
    if (opts.strict) throw new Error(`Blocked internal research copy: ${raw.slice(0, 80)}…`);
    return '';
  }
  if (isTruncatedResearchCopy(raw)) {
    if (opts.strict) assertResearchCopyNotTruncated(raw, opts.label || 'passenger copy');
    return '';
  }
  return raw.trim();
}

function quickFactGettingSummary(guide) {
  const g = guide && guide.gettingThere;
  if (!g) return '';
  const preferred = preparePassengerGuideText(g.distanceToCity || g.walkingTime || '', { label: 'quickFact' });
  if (preferred && preferred.length <= MAX_QUICK_FACT_CHARS) return preferred;
  if (preferred) return `${preferred.slice(0, MAX_QUICK_FACT_CHARS - 1).replace(/\s+\S*$/, '').trim()}…`;
  const fallback = preparePassengerGuideText(g.fromTerminal || '', { label: 'quickFact' });
  if (!fallback) return '';
  if (fallback.length <= MAX_QUICK_FACT_CHARS) return fallback;
  return `${fallback.slice(0, MAX_QUICK_FACT_CHARS - 1).replace(/\s+\S*$/, '').trim()}…`;
}

function usesPassengerEditorialLead(guide) {
  return (
    guide?.researchImport?.publication_tier === 'passenger_editorial' &&
    String(guide?.portInfo?.description || '').trim().length > 0
  );
}

function isResearchItineraryCopy(text) {
  const s = String(text || '');
  if (/\b\d+\s*\+\s*\d+\s*\+\s*\d+\s*=/.test(s)) return true;
  if (/\(\s*\d+\s*\+\s*\d+/.test(s)) return true;
  if (/Sum:\s*\d+\s*min/i.test(s)) return true;
  return false;
}

function assertPassengerReadyGuideFields(guide, portId) {
  const pilotIds = new Set(['aalborg', 'aarhus', 'akureyri', 'eidfjord', 'aqaba', 'aruba']);
  if (!guide || (!pilotIds.has(portId) && !usesPassengerEditorialLead(guide))) return;
  const fields = [
    guide.gettingThere?.fromTerminal,
    guide.gettingThere?.publicTransport,
    guide.gettingThere?.walkingTime,
    guide.thingsToDo?.shortCall,
    guide.thingsToDo?.standardCall,
    guide.thingsToDo?.longerCall,
    guide.thingsToDo?.practicalTip,
    ...(guide.thingsToDo?.topThings || []),
  ].filter(Boolean);
  for (const text of fields) {
    if (/\*\*/.test(text)) throw new Error('Raw markdown remains in guide JSON');
    if (containsInternalResearchLeak(text)) throw new Error(`Internal leak in JSON: ${text.slice(0, 60)}`);
    assertResearchCopyNotTruncated(text, 'guide field');
  }
}

module.exports = {
  stripMarkdownEmphasis,
  containsInternalResearchLeak,
  isResearchItineraryCopy,
  preparePassengerGuideText,
  quickFactGettingSummary,
  usesPassengerEditorialLead,
  assertPassengerReadyGuideFields,
  INTERNAL_RESEARCH_LEAK_RE,
  MAX_QUICK_FACT_CHARS,
};

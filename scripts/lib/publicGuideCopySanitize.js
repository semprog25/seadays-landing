'use strict';

const { stripWikiCitationMarkers } = require('./portCopyHygiene');
const { isTruncatedResearchCopy, assertResearchCopyNotTruncated } = require('./researchCopyGuards');

const { listPassengerTextFields } = require('./publicPortGuidePassengerTextFields');

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
  /\bkeep pins null\b/i,
  /\bpins stay null\b/i,
  /\bberth metrics stay null\b/i,
  /\bNot verified on (?:the )?[\w\s/&.'’-]+(?:operations |passenger )?page\b/i,
  /\bnot isolated from\b/i,
  /\bHTML captured\b/i,
  /\bcaptured (?:MLIT |guide )?page\b/i,
  /\bminutes not verified\b/i,
  /\bexact metres unverified\b/i,
  /\bpins remain null\b/i,
  /\bGangway GPS pins remain null\b/i,
  /\bTimed metres gap\b/i,
  /\bTransfer metres\b/i,
  /\bgap on PAJ\b/i,
  /\bAuthority:\s*berth\b/i,
  /\bmuseum primaries are filed\b/i,
  /\bharbour-page themes\b/i,
  /\btreat ticket logistics as gaps\b/i,
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

function collectGuidePassengerLeakBlob(guide) {
  if (!guide) return '';
  const parts = [];
  for (const { holder, key } of listPassengerTextFields(guide)) {
    const value = holder[key];
    if (typeof value === 'string' && value.trim()) parts.push(value);
  }
  const distanceAnswer = guide?.gettingThere?.distanceAnswer;
  if (typeof distanceAnswer === 'string' && distanceAnswer.trim()) parts.push(distanceAnswer);
  return parts.join('\n');
}

// Shared by sanitization and FAQs so place abbreviations cannot create fragments.
function splitPassengerSentences(text) {
  const parts = String(text || '').trim().split(/(?<=[.!?])\s+/);
  const sentences = [];
  for (const part of parts) {
    if (sentences.length && /\b(?:St|Mt|Ft|No|Dr|Mr|Mrs|Ms|Prof|Jr|Sr|Ave|Rd|e\.g|i\.e)\.$/i.test(sentences[sentences.length - 1])) {
      sentences[sentences.length - 1] += ' ' + part;
    } else if (part) sentences.push(part);
  }
  return sentences;
}

function sanitizePassengerRenderCopy(value) {
  if (typeof value === 'string') {
    return containsInternalResearchLeak(value) ? preparePassengerGuideText(value) : value;
  }
  if (Array.isArray(value)) return value.map(sanitizePassengerRenderCopy);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizePassengerRenderCopy(item)]));
  }
  return value;
}

function faqResearchSentence(sentence) {
  const s = String(sentence || '');
  return (
    /\bclaimed\b/i.test(s) ||
    /\bnot surveyed\b/i.test(s) ||
    /\bminutes unverified\b/i.test(s) ||
    /\bper VIPA\b/i.test(s) ||
    /\bper VPCC\b/i.test(s) ||
    /\bunverified\b/i.test(s)
  );
}

/** FAQ-only polish: drop research-note phrasing; does not alter non-FAQ passenger blocks. */
function prepareFaqPassengerText(text) {
  const raw = preparePassengerGuideText(text);
  if (!raw) return '';
  const sentences = [];
  for (const sentence of splitPassengerSentences(raw)) {
    let s = sentence
      .replace(
        /\bTown centre walk claimed ~\d+\s*min\.?/gi,
        'The town centre is a short walk from the cruise piers for many mobile guests'
      )
      .replace(
        /\bShopping\/restaurants within walking distance of the pier per VIPA;?\s*minutes not surveyed\.?/gi,
        'Shops and restaurants are within walking distance of the pier'
      )
      .replace(/;\s*downtown minutes unverified\.?/gi, '.')
      .replace(/\bdowntown minutes unverified\.?/gi, '')
      .replace(/\bper VIPA;?\s*/gi, '')
      .replace(/\bminutes not surveyed\.?/gi, '')
      .replace(
        /\bTender ~1\s*NM then short walk into village\.?/gi,
        'Tender ride of about one nautical mile, then a short walk into the village'
      )
      .replace(/\bNo cruise shuttle per VPCC\.?/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!s || faqResearchSentence(s)) continue;
    if (!/[.!?…]$/.test(s)) s = `${s}.`;
    sentences.push(s);
  }
  return sentences.join(' ').trim();
}

function preparePassengerGuideText(text, opts = {}) {
  let raw = stripWikiCitationMarkers(stripMarkdownEmphasis(text));
  if (!raw) return '';
  if (containsInternalResearchLeak(raw)) {
    if (opts.strict) throw new Error(`Blocked internal research copy: ${raw.slice(0, 80)}…`);
    raw = splitPassengerSentences(raw).filter((sentence) => !containsInternalResearchLeak(sentence)).join(' ');
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
  const tier = guide?.researchImport?.publication_tier
  const batch03Conditional =
    tier === 'passenger_editorial_candidate' &&
    guide?.researchImport?.batch03_kirkenes_ocho_conditional_candidate === true
  const batch04Conditional =
    tier === 'passenger_editorial_candidate' &&
    guide?.researchImport?.batch04_preparation_only === true
  const passengerLeadTier =
    tier === 'passenger_editorial' || batch03Conditional || batch04Conditional
  return passengerLeadTier && String(guide?.portInfo?.description || '').trim().length > 0
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
  collectGuidePassengerLeakBlob,
  isResearchItineraryCopy,
  preparePassengerGuideText,
  prepareFaqPassengerText,
  sanitizePassengerRenderCopy,
  splitPassengerSentences,
  quickFactGettingSummary,
  usesPassengerEditorialLead,
  assertPassengerReadyGuideFields,
  INTERNAL_RESEARCH_LEAK_RE,
  MAX_QUICK_FACT_CHARS,
};

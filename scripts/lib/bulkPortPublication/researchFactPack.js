'use strict';

const crypto = require('crypto');
const {
  sectionBody,
  extractThingsToDo,
  extractCruiseTerminalArrival,
  firstParagraph,
  bulletLines,
  numberedListLines,
  stripCitationMarkers,
  isTruncatedResearchTableCell,
} = require('../portResearchImport/extractMarkdownSections');
const { parseFrontmatter } = require('../portResearchImport/resolveYaml');
const { readResearchMarkdown } = require('../portResearchImport/transformResearchToPublic');

function hashGuide(guide) {
  return crypto.createHash('sha256').update(JSON.stringify(guide || {})).digest('hex').slice(0, 16);
}

function extractAttractionNames(meta) {
  const list = Array.isArray(meta.attractions) ? meta.attractions : [];
  return list
    .map((a) => stripCitationMarkers(a.name || ''))
    .filter((n) => n && n.length > 2)
    .slice(0, 8);
}

function extractGettingThereBullets(body) {
  const section = sectionBody(body, 'Getting there');
  return bulletLines(section).map(stripCitationMarkers);
}

function detectUnresolved(sectionText) {
  const flags = [];
  const s = String(sectionText || '');
  if (/null\/unverified/i.test(s)) flags.push('null_unverified_in_research');
  if (isTruncatedResearchTableCell(s)) flags.push('truncated_table_cell');
  if (/not captured this pass/i.test(s)) flags.push('incomplete_capture');
  if (/verification_status:\s*needs_review/i.test(s)) flags.push('terminal_needs_review');
  return flags;
}

function buildResearchFactPack({ researchRoot, landingSlug, meta, body }) {
  let overview = stripCitationMarkers(firstParagraph(sectionBody(body, 'Overview')));
  if (overview) {
    overview = overview.replace(/\s+[—-]\s+left null\.?$/i, '.').trim();
  }
  const gettingSection = sectionBody(body, 'Getting there');
  const terminals = extractCruiseTerminalArrival(body);
  const gettingBullets = extractGettingThereBullets(body);
  const things = extractThingsToDo(body);
  const thingsSection = sectionBody(body, 'Things to do');
  const thingsSectionBullets = [...bulletLines(thingsSection), ...numberedListLines(thingsSection)]
    .map(stripCitationMarkers)
    .filter(Boolean);
  const gettingSummary = stripCitationMarkers(firstParagraph(gettingSection));
  const attractionNames = extractAttractionNames(meta);
  const unresolved = [
    ...detectUnresolved(gettingSection),
    ...detectUnresolved(sectionBody(body, 'Cruise terminals')),
  ];
  if (meta.research_status === 'needs_review') unresolved.push('research_status_needs_review');

  const terminalNotes = (Array.isArray(meta.terminals) ? meta.terminals : [])
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      address: t.address || '',
      caveat: t.assignment_caveat || t.transit_notes || '',
      verified: t.verification_status !== 'needs_review',
    }));

  return {
    landing_slug: landingSlug,
    research_sha256: meta.sha256 || meta.research_sha256 || null,
    qa_verdict: meta.qa_verdict,
    overview_raw: overview,
    terminals_arrival: terminals,
    getting_bullets: gettingBullets,
    getting_summary: gettingSummary,
    things_raw: things,
    things_section_bullets: thingsSectionBullets,
    attraction_names: attractionNames,
    terminal_notes: terminalNotes,
    unresolved,
    provenance: ['research_markdown', `by-port/${landingSlug}.md`],
  };
}

function loadFactPack(researchRoot, landingSlug) {
  const raw = readResearchMarkdown(researchRoot, landingSlug);
  let meta = {};
  let body = raw;
  try {
    const parsed = parseFrontmatter(raw);
    meta = parsed.meta || {};
    body = parsed.body || raw;
  } catch (err) {
    const end = raw.indexOf('\n---', 3);
    body = end >= 0 ? raw.slice(end + 4).trimStart() : raw;
    meta = { parse_error: err.message };
  }
  return buildResearchFactPack({ researchRoot, landingSlug, meta, body });
}

module.exports = {
  buildResearchFactPack,
  loadFactPack,
  hashGuide,
  extractAttractionNames,
};

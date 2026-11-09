'use strict';

function sectionBody(body, heading) {
  const re = new RegExp(`^## ${heading}\\s*$`, 'im');
  const m = re.exec(body);
  if (!m) return '';
  const start = m.index + m[0].length;
  const rest = body.slice(start);
  const next = rest.search(/^## /m);
  const chunk = next >= 0 ? rest.slice(0, next) : rest;
  return chunk.trim();
}

function subsectionBody(sectionText, heading) {
  const re = new RegExp(`^### ${heading}\\s*$`, 'im');
  const m = re.exec(sectionText);
  if (!m) return '';
  const start = m.index + m[0].length;
  const rest = sectionText.slice(start);
  const next = rest.search(/^### /m);
  const chunk = next >= 0 ? rest.slice(0, next) : rest;
  return chunk.trim();
}

function bulletLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').replace(/\s*\[[^\]]+\]\s*$/g, '').trim())
    .filter(Boolean);
}

function numberedListLines(text) {
  return String(text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => /^\d+\.\s+/.test(line))
    .map((line) => line.replace(/^\d+\.\s+/, '').replace(/\s*\[[^\]]+\]\s*$/g, '').trim())
    .filter(Boolean);
}

function firstParagraph(text) {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const paras = [];
  let cur = [];
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('|') || line.startsWith('- ')) break;
    cur.push(line);
  }
  if (cur.length) paras.push(cur.join(' '));
  return paras[0] || '';
}

function markdownTableRows(sectionText) {
  return String(sectionText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|\s*---/.test(l));
}

function firstMarkdownTableDataRow(sectionText) {
  const rows = markdownTableRows(sectionText);
  if (rows.length < 2) return null;
  const headerCells = rows[0].split('|').map((c) => c.trim()).filter(Boolean);
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i].split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    if (cells.every((c) => /^-+$/.test(c))) continue;
    const name = cells[0];
    const caveat = cells[cells.length - 1];
    const facilityType = cells.length > 1 ? cells[1] : '';
    return { name, facilityType, caveat, headerCells };
  }
  return null;
}

function proseAfterMarkdownTable(sectionText) {
  const lines = String(sectionText || '').split('\n');
  let inTable = false;
  let tableEnded = false;
  const prose = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith('|')) {
      inTable = true;
      continue;
    }
    if (inTable && line) tableEnded = true;
    if (tableEnded && line && !line.startsWith('#')) prose.push(line);
  }
  return prose.join(' ').trim();
}

/** Claire deliverables occasionally truncate the last table column mid-word; do not publish. */
function isTruncatedResearchTableCell(text) {
  const s = String(text || '').trim();
  if (!s || s.length < 24) return false;
  if (/[.!?…)"'\]]$/.test(s)) return false;
  const tail = (s.split(/\s+/).pop() || '').toLowerCase();
  if (tail.length <= 3) return true;
  if (/^(cr|cal|doc|htt|por)$/i.test(tail)) return true;
  return false;
}

/** Passenger-facing berth summary from research Cruise terminals section (no invented times). */
function extractCruiseTerminalArrival(body) {
  const section = sectionBody(body, 'Cruise terminals');
  if (!section) return '';
  const lead = firstParagraph(section);
  if (lead) return stripCitationMarkers(lead);
  const row = firstMarkdownTableDataRow(section);
  const afterTable = proseAfterMarkdownTable(section);
  const postTableProse = stripCitationMarkers(firstParagraph(afterTable));
  if (row?.name) {
    const caveat = row.caveat && !/^-?\d+\.?\d*,\s*-?\d+\.?\d*$/.test(row.caveat) ? row.caveat : '';
    const caveatUsable = caveat && !isTruncatedResearchTableCell(caveat);
    if (caveatUsable) {
      return stripCitationMarkers(`${row.name} — ${caveat}`);
    }
    if (postTableProse) {
      return stripCitationMarkers(`${row.name} — ${postTableProse}`);
    }
    return stripCitationMarkers(row.name);
  }
  return postTableProse || stripCitationMarkers(firstParagraph(section));
}

function subsectionByPrefix(sectionText, prefix) {
  const lines = String(sectionText || '').split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('### ') && line.slice(4).toLowerCase().startsWith(prefix.toLowerCase())) {
      start = i + 1;
      break;
    }
  }
  if (start < 0) return '';
  const rest = lines.slice(start);
  let end = rest.length;
  for (let j = 0; j < rest.length; j++) {
    if (rest[j].trim().startsWith('### ')) {
      end = j;
      break;
    }
  }
  return rest.slice(0, end).join('\n').trim();
}

function extractThingsToDo(body) {
  const section = sectionBody(body, 'Things to do');
  if (!section) return null;
  const topBlock = subsectionBody(section, 'Top things to do');
  return {
    intro: firstParagraph(section),
    topThings: bulletLines(topBlock || section),
    shortCall: subsectionByPrefix(section, 'Short call'),
    standardCall: subsectionByPrefix(section, 'Standard call'),
    longerCall: subsectionByPrefix(section, 'Longer call'),
    practicalTip: subsectionByPrefix(section, 'Practical cruise tip'),
  };
}

function extractTravelerQuestions(body) {
  const section = sectionBody(body, 'Traveler questions');
  if (!section) return [];
  return bulletLines(section).slice(0, 12);
}

function stripCitationMarkers(text) {
  return String(text || '')
    .replace(/\s*\[S\d+\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

module.exports = {
  sectionBody,
  extractThingsToDo,
  extractTravelerQuestions,
  extractCruiseTerminalArrival,
  isTruncatedResearchTableCell,
  firstMarkdownTableDataRow,
  proseAfterMarkdownTable,
  firstParagraph,
  bulletLines,
  numberedListLines,
  stripCitationMarkers,
};

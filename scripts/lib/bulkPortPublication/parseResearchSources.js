'use strict';

const fs = require('fs');
const path = require('path');
const { readResearchMarkdown } = require('../portResearchImport/transformResearchToPublic');

function parseSourcesTable(body) {
  const sectionMatch = /^## Sources & verification\s*$/im.exec(body);
  if (!sectionMatch) return [];
  const start = sectionMatch.index + sectionMatch[0].length;
  const rest = body.slice(start);
  const end = rest.search(/^## /m);
  const section = (end >= 0 ? rest.slice(0, end) : rest).trim();
  const rows = section
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('|') && !/^\|\s*---/.test(l));
  if (rows.length < 2) return [];
  const sources = [];
  for (let i = 1; i < rows.length; i += 1) {
    const cells = rows[i].split('|').map((c) => c.trim()).filter(Boolean);
    if (cells.length < 4) continue;
    const [id, publisher, url, accessed] = cells;
    sources.push({
      id,
      publisher,
      url: url && !url.startsWith('evidence/') ? url : null,
      evidence_path: url && url.startsWith('evidence/') ? url : null,
      accessed_utc: accessed || null,
      published_updated: cells[4] || null,
      claim_supported: cells[5] || null,
    });
  }
  return sources;
}

function loadResearchSources(researchRoot, landingSlug) {
  const raw = readResearchMarkdown(researchRoot, landingSlug);
  const body = raw.includes('\n---\n') ? raw.slice(raw.indexOf('\n---\n', 3) + 4) : raw;
  return parseSourcesTable(body);
}

module.exports = { parseSourcesTable, loadResearchSources };

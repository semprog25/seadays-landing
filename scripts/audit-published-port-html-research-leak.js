#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { containsInternalResearchLeak, INTERNAL_RESEARCH_LEAK_RE } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const PORTS_DIR = path.join(REPO, 'ports');

const EXTRA_SURFACE_PATTERNS = [
  /\bDoor[- ]?GPS\b/i,
  /\bdoor-threshold\b/i,
  /\bWGS\s*84\b/i,
  /\bCatalog flag:/i,
  /\bresearch notes\b/i,
  /\bbefore import\b/i,
  /\bcaptured page/i,
  /\bpins remain null\b/i,
  /\b\[S\d+/i,
];

function extractProseTextFromMain(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  if (!main) return '';
  const chunks = [];
  const proseRe = /<p[^>]*class="[^"]*pg-(?:prose|lead-guide|call-plan-body|cruise-tip-body)[^"]*"[^>]*>([\s\S]*?)<\/p>/gi;
  const faqRe = /<section[^>]*id="traveler-questions"[\s\S]*?<\/section>/i;
  let m;
  while ((m = proseRe.exec(main[0]))) {
    chunks.push(m[1].replace(/<[^>]+>/g, ' '));
  }
  const faq = main[0].match(faqRe);
  if (faq) chunks.push(faq[0].replace(/<[^>]+>/g, ' '));
  return chunks.join('\n');
}

function extractPassengerSurfaces(html) {
  const surfaces = [];
  const prose = extractProseTextFromMain(html);
  if (prose.trim()) surfaces.push({ where: 'main-prose', text: prose });
  for (const m of html.matchAll(/<meta[^>]+content="([^"]+)"/gi)) {
    surfaces.push({ where: 'meta', text: m[1] });
  }
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    surfaces.push({ where: 'json-ld', text: m[1] });
  }
  return surfaces;
}

function classifyLeak(text) {
  const hits = [];
  if (containsInternalResearchLeak(text)) hits.push('sanitizer');
  for (const re of EXTRA_SURFACE_PATTERNS) {
    if (re.test(text)) hits.push(re.source.slice(0, 36));
  }
  return [...new Set(hits)];
}

function main() {
  const out = [];
  for (const ent of fs.readdirSync(PORTS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const file = path.join(PORTS_DIR, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
  const reasons = new Set();
    for (const surface of extractPassengerSurfaces(html)) {
      for (const hit of classifyLeak(surface.text)) reasons.add(`${surface.where}:${hit}`);
    }
    if (reasons.size) out.push({ slug: ent.name, reasons: [...reasons].sort() });
  }
  const summary = {
    patternCount: INTERNAL_RESEARCH_LEAK_RE.length,
    publishedPortPagesWithLeaks: out.length,
    slugs: out.map((r) => r.slug).sort(),
    detail: out.sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (out.length) process.exitCode = 1;
}

main();

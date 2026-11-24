#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..');
const PORTS_DIR = path.join(REPO, 'ports');

const NOT_VERIFIED_RE = /\bnot verified\b/i;
const WGS84_RE = /\bWGS\s*84\b/i;
const REMAIN_NULL_RE = /\b(?:remain|stays?|keep)\s+null\b/i;

function stripScripts(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
}

function passengerProseAndMeta(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  const body = main ? main[0] : html;
  const prose = stripScripts(body).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const metas = [...html.matchAll(/<meta[^>]+content="([^"]+)"/gi)].map((m) => m[1]).join(' ');
  return { prose, metas, combined: `${prose} ${metas}` };
}

function classifySlug(slug, html) {
  const { prose, metas, combined } = passengerProseAndMeta(html);
  const hits = [];
  if (NOT_VERIFIED_RE.test(prose) || NOT_VERIFIED_RE.test(metas)) hits.push('not_verified');
  if (WGS84_RE.test(prose) || WGS84_RE.test(metas)) hits.push('wgs84');
  if (REMAIN_NULL_RE.test(prose) || REMAIN_NULL_RE.test(metas)) hits.push('remain_null');
  const onerrorOnly =
    /\bonerror=null\b/i.test(html) &&
    !/\bnull\b/i.test(prose) &&
    !/\bnull\b/i.test(metas);
  return { slug, hits, onerrorOnly, combinedSample: combined.slice(0, 120) };
}

function main() {
  const slugFilter = (process.env.SEADAYS_AUDIT_PORT_SLUGS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const rows = [];
  for (const ent of fs.readdirSync(PORTS_DIR, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    if (slugFilter.length && !slugFilter.includes(ent.name)) continue;
    const file = path.join(PORTS_DIR, ent.name, 'index.html');
    if (!fs.existsSync(file)) continue;
    const row = classifySlug(ent.name, fs.readFileSync(file, 'utf8'));
    if (row.hits.length) rows.push(row);
  }
  const summary = {
    scope: slugFilter.length ? slugFilter : 'all',
    portPagesScanned: slugFilter.length || fs.readdirSync(PORTS_DIR).filter((n) => fs.existsSync(path.join(PORTS_DIR, n, 'index.html'))).length,
    passengerVisibleNotVerified: rows.filter((r) => r.hits.includes('not_verified')).length,
    passengerVisibleWgs84: rows.filter((r) => r.hits.includes('wgs84')).length,
    passengerVisibleRemainNull: rows.filter((r) => r.hits.includes('remain_null')).length,
    slugsWithHits: rows.map((r) => r.slug).sort(),
    detail: rows.sort((a, b) => a.slug.localeCompare(b.slug)),
  };
  console.log(JSON.stringify(summary, null, 2));
  if (rows.length) process.exitCode = 1;
}

main();
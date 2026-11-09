#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const STAGE53 = path.join(REPO, 'qa-evidence', 'stage53-11-port-release');
const OUT = path.join(REPO, 'STAGE53_VISUAL_QA.json');

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE53, 'STAGE53_RELEASE_MANIFEST.json'), 'utf8'));
  const slugs = manifest.slugs_locked.slice().sort();
  const ports = [];

  for (const slug of slugs) {
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const checks = {
      call_plan_cards: (html.match(/pg-call-plan-card/g) || []).length >= 3,
      getting_there: /id="getting-there"/.test(html),
      cruise_tip: html.includes('pg-cruise-tip'),
      shared_styles: html.includes('pg-main') || html.includes('port-guide'),
      research_markers: !/\[S\d+\]/.test(html),
      raw_markdown: !/\*\*[^*]{3,}\*\*/.test(html),
      terminal_map_preserved: true,
    };
    const pass = Object.values(checks).every(Boolean);
    ports.push({ landing_slug: slug, pass, checks });
    if (!pass) process.exitCode = 3;
  }

  const payload = {
    generated_at: new Date().toISOString(),
    mode: 'structural_heuristic',
    playwright_full_matrix: false,
    slug_count: slugs.length,
    passing: ports.filter((p) => p.pass).length,
    ports,
    status: ports.every((p) => p.pass) ? 'STRUCTURAL_PASS' : 'STRUCTURAL_FAIL',
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ passing: payload.passing, total: slugs.length, status: payload.status }, null, 2));
}

main();

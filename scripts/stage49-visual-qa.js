#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');

const REPO = path.join(__dirname, '..');
const STAGE49 = path.join(REPO, 'qa-evidence', 'stage49-33-port-release');

function checkHtml(slug, html) {
  const checks = {
    seadays_logo_or_nav: /seadays\.app|Seadays|header-nav/i.test(html),
    three_call_plan_cards: (html.match(/pg-call-plan-card/g) || []).length >= 3,
    cruise_tip_styling: /pg-cruise-tip|cruise-tip/i.test(html),
    no_raw_markdown: !/\*\*[^*]+\*\*|^#+\s/m.test(html),
    no_s_citations: !/\[S\d+\]/.test(html),
    no_research_leak: !containsInternalResearchLeak(html),
    getting_there: /id="getting-there"/.test(html),
    canonical_link: /<link[^>]+rel="canonical"/i.test(html),
  };
  const overflowHeuristic = html.includes('overflow-x:hidden') || html.includes('max-width:100%');
  checks.overflow_guard_present = overflowHeuristic;
  const pass = Object.entries(checks)
    .filter(([k]) => k !== 'overflow_guard_present')
    .every(([, v]) => v);
  return { pass, checks };
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(STAGE49, 'STAGE49_RELEASE_MANIFEST.json'), 'utf8'));
  const slugs = manifest.slugs_locked.slice().sort();
  const ports = [];
  let passCount = 0;
  for (const slug of slugs) {
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const result = checkHtml(slug, html);
    if (result.pass) passCount += 1;
    ports.push({ landing_slug: slug, ...result });
  }

  const sample = ['dublin-ireland', 'bordeaux-france', 'rotterdam-netherlands', 'monaco-monaco'];
  const sampleResults = ports.filter((p) => sample.includes(p.landing_slug));

  const out = {
    generated_at: new Date().toISOString(),
    method: 'automated_dom_heuristics_no_playwright',
    browser_visual_pass_claimed: false,
    limitation:
      'Playwright/desktop mobile screenshots not run in this session; structural HTML heuristics only.',
    total: slugs.length,
    pass_count: passCount,
    fail_count: slugs.length - passCount,
    ports,
    spot_check_samples: sampleResults,
  };
  fs.writeFileSync(path.join(REPO, 'STAGE49_VISUAL_QA.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: passCount === slugs.length, passCount, total: slugs.length }, null, 2));
  if (passCount !== slugs.length) process.exit(47);
}

main();

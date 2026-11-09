#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { passengerEditorialBodyScore } = require('./lib/publishedPortHtmlPreserve');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-publication-41');

function shaFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  const slugs = apply.slugs.slice().sort();
  const before = {};
  for (const slug of slugs) {
    const p = path.join(REPO, 'ports', slug, 'index.html');
    before[slug] = { hash: shaFile(p), score: passengerEditorialBodyScore(fs.readFileSync(p, 'utf8')) };
  }
  const cococay = 'perfect-day-at-cococay-bahamas';
  const cococayBefore = fs.existsSync(path.join(REPO, 'ports', cococay, 'index.html'))
    ? shaFile(path.join(REPO, 'ports', cococay, 'index.html'))
    : null;

  execSync(`node scripts/generateBlogs.js --ports-only --only=${slugs.join(',')}`, { cwd: REPO, stdio: 'pipe' });

  const degradations = [];
  for (const slug of slugs) {
    const p = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(p, 'utf8');
    const afterHash = shaFile(p);
    const afterScore = passengerEditorialBodyScore(html);
    const cards = (html.match(/pg-call-plan-card pg-call-plan-card--/g) || []).length;
    if (afterScore < before[slug].score) {
      degradations.push({ slug, reason: 'passenger_body_score_downgraded', before: before[slug].score, after: afterScore });
    }
    if (cards < 3) degradations.push({ slug, reason: 'call_plan_cards_below_3', cards });
    if (afterHash !== before[slug].hash && afterScore >= before[slug].score && cards >= 3) {
      /* non-destructive hash drift (related-reading cards, etc.) */
    }
  }
  let cococayOk = true;
  if (cococayBefore) {
    const afterCoco = shaFile(path.join(REPO, 'ports', cococay, 'index.html'));
    cococayOk = afterCoco === cococayBefore;
    const cards = (fs.readFileSync(path.join(REPO, 'ports', cococay, 'index.html'), 'utf8').match(/pg-call-plan-card/g) || [])
      .length;
    if (cards < 3) cococayOk = false;
  }

  const out = {
    checked_at_utc: new Date().toISOString(),
    slug_count: slugs.length,
    degradations,
    cococay_unchanged: cococayOk,
    ok: degradations.length === 0 && cococayOk,
  };
  fs.writeFileSync(path.join(EVIDENCE, 'CATALOGUE_REGEN_QA.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(out, null, 2));
  if (!out.ok) process.exit(47);
}

main();

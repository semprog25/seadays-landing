#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage67-next-50-recovery');

function main() {
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE67_NEXT_50_MANIFEST.json'), 'utf8'));
  const slugs = manifest.slugs_approved || [];
  const fails = [];
  for (const slug of slugs) {
    const htmlPath = path.join(REPO, 'ports', slug, 'index.html');
    const html = fs.readFileSync(htmlPath, 'utf8');
    const cards = (html.match(/class="pg-call-plan-card/g) || []).length;
    const gettingThere = html.includes('id="getting-there"');
    if (cards < 3 || !gettingThere) fails.push({ slug, cards, gettingThere });
  }
  assert.strictEqual(fails.length, 0, JSON.stringify(fails));
  console.log('test-stage67-approved-html-call-plans PASS', { slugs: slugs.length });
}

main();

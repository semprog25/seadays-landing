#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const {
  STAGE15_PILOT_SLUGS,
  STAGE15_PILOT_GUIDES,
} = require('./lib/stage15PilotEditorial');
const { assertPassengerReadyGuideFields, containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { buildPhase1GuideHtml, hasRichThingsToDo } = require('./lib/portGuideSections');

const SLUG_TO_APP = Object.fromEntries(
  Object.values(STAGE15_PILOT_GUIDES).map((g) => [g.researchImport.landing_slug, g.appPortId])
);

function main() {
  const guides = JSON.parse(
    fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8')
  );

  for (const slug of STAGE15_PILOT_SLUGS) {
    const appPortId = SLUG_TO_APP[slug];
    assert.ok(appPortId, `map slug ${slug}`);
    const guide = guides.byAppPortId[appPortId];
    assert.ok(guide, `guide ${appPortId}`);
    assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial', slug);
    assertPassengerReadyGuideFields(guide, appPortId);
    assert.ok(hasRichThingsToDo(guide), `${slug} rich thingsToDo`);
    assert.ok(guide.shorePlansFirst, `${slug} shorePlansFirst`);

    const pagePath = path.join(repoRoot, 'ports', slug, 'index.html');
    assert.ok(fs.existsSync(pagePath), `page ${slug}`);
    const page = fs.readFileSync(pagePath, 'utf8');
    assert.ok(!page.includes('**'), `${slug}: no raw markdown bold`);
    assert.ok(!/\d+\+\d+\+\d+=/.test(page), `${slug}: no arithmetic worksheet`);
    assert.ok(page.includes('pg-cruise-tip'), `${slug}: cruise tip`);
    assert.ok(/\.pg-call-plan-card\s*\{/.test(page), `${slug}: call-plan css`);
    assert.ok(/\.pg-cruise-tip\s*\{/.test(page), `${slug}: cruise tip css`);
    assert.ok(!page.includes('null/unverified'), `${slug}: no QA leak`);

    const mainBlock = page.match(/<main\b[\s\S]*?<\/main>/i);
    assert.ok(mainBlock, `${slug}: main`);
    assert.ok(!containsInternalResearchLeak(mainBlock[0]), `${slug}: main leaks`);

    const fragment = buildPhase1GuideHtml({
      port: { name: guide.portName, slug, appPortId, country: guide.country },
      guide,
      terminals: [],
      affiliate: { show: false },
    });
    assert.ok(fragment.includes('pg-call-plan-card--short'), `${slug} short card`);
    assert.ok(fragment.includes('pg-call-plan-card--standard'), `${slug} standard card`);
    assert.ok(fragment.includes('pg-call-plan-card--longer'), `${slug} longer card`);
    assert.ok(!fragment.includes('port-terminal-map'), `${slug}: no terminal map in fragment`);
  }

  const aarhusPage = fs.readFileSync(path.join(repoRoot, 'ports', 'aarhus-denmark', 'index.html'), 'utf8');
  assert.ok(aarhusPage.includes('um.dk/en/travel-and-residence'), 'aarhus denmark entry link');
  assert.ok(!aarhusPage.includes('For Aarhus, Entry and visa'), 'no politics boilerplate faq on aarhus');

  console.log('test-stage15-five-port-pilot PASS');
}

main();

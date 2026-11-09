'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  countCallPlanArticleCards,
  mergePassengerEditorialBodyPreservation,
} = require('./lib/publishedPortHtmlPreserve');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');

const root = path.join(__dirname, '..');
const slug = 'perfect-day-at-cococay-bahamas';
const portPath = path.join(root, 'ports', slug, 'index.html');
const guidesPath = path.join(root, 'data', 'public-port-guides.json');

const guides = JSON.parse(fs.readFileSync(guidesPath, 'utf8'));
const portGuide = guides.byAppPortId['coco-cay'];
assert.ok(portGuide, 'coco-cay guide in JSON');
assert.strictEqual(portGuide.researchImport?.publication_tier, 'passenger_editorial');

const richHtml = fs.readFileSync(portPath, 'utf8');
assert.ok(countCallPlanArticleCards(richHtml) >= 3, 'branch HTML must have passenger call-plan cards');

function thinHtmlFromOriginMain() {
  try {
    return execSync(`git show origin/main:ports/${slug}/index.html`, {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (e) {
    const stubPath = path.join(__dirname, 'fixtures', 'cococay-thin-stub.html');
    if (fs.existsSync(stubPath)) return fs.readFileSync(stubPath, 'utf8');
    throw e;
  }
}

const thinHtml = thinHtmlFromOriginMain();
assert.ok(
  countCallPlanArticleCards(thinHtml) < 3,
  'origin/main baseline should lack 3 passenger call-plan cards (regression repro)'
);

const degradedGenerated =
  '<!DOCTYPE html><html><body><main>' +
  '<section class="pg-section" id="things-to-do"><p>Generic list.</p></section>' +
  '<section class="pg-section" id="getting-there"><p>Stub.</p></section>' +
  '</main></body></html>';
const merged = mergePassengerEditorialBodyPreservation(degradedGenerated, richHtml, portGuide);
assert.ok(
  countCallPlanArticleCards(merged) >= 3,
  'mergePassengerEditorialBodyPreservation keeps richer on-disk things-to-do'
);
const stubMain = thinHtml;
const noGuideMerge = mergePassengerEditorialBodyPreservation(stubMain, richHtml, null);
assert.ok(
  countCallPlanArticleCards(noGuideMerge) >= 3,
  'call-plan downgrade guard works without portGuide (full CI regen path)'
);
assert.ok(/id="getting-there"[\s\S]*?<dl class="pg-facts">/.test(merged), 'preserves rich getting-there');

const backup = fs.readFileSync(portPath, 'utf8');
try {
  fs.writeFileSync(portPath, thinHtml, 'utf8');
  execSync(`node scripts/generateBlogs.js --catalogue-only --only=${slug}`, {
    cwd: root,
    stdio: 'pipe',
    encoding: 'utf8',
    timeout: 120000,
  });
  const after = fs.readFileSync(portPath, 'utf8');
  const main = after.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || '';
  assert.ok(!containsInternalResearchLeak(main), 'no research leak markers in main');
  assert.strictEqual(countCallPlanArticleCards(after), 3, 'catalogue regen keeps 3 call-plan article cards');
  assert.ok(/id="getting-there"[\s\S]*?<dl class="pg-facts">/.test(after), 'getting-there dl retained');
  assert.ok(/id="traveler-questions"[\s\S]*?pg-qa-grid/.test(after), 'FAQ grid retained');
  const validation = validateGeneratedPortHtml(after, { slug });
  assert.ok(validation.ok, `validateGeneratedPortHtml: ${validation.issues.join(', ')}`);
} finally {
  fs.writeFileSync(portPath, backup, 'utf8');
}

console.log('test-cococay-catalogue-regen-preserve: OK');

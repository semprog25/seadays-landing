'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const {
  countCallPlanArticleCards,
  mergePassengerEditorialBodyPreservation,
  mergePublishedPortHtmlPreservation,
} = require('./lib/publishedPortHtmlPreserve');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml');

const root = path.join(__dirname, '..');
const slug = 'perfect-day-at-cococay-bahamas';
const portPath = path.join(root, 'ports', slug, 'index.html');
const thinFixturePath = path.join(__dirname, 'fixtures', 'cococay-catalogue-thin.html');
const richFixturePath = path.join(__dirname, 'fixtures', 'cococay-passenger-rich.html');
const guidesPath = path.join(root, 'data', 'public-port-guides.json');

assert.ok(fs.existsSync(thinFixturePath), 'thin catalogue fixture required');
assert.ok(fs.existsSync(richFixturePath), 'rich passenger fixture required');

const thinHtml = fs.readFileSync(thinFixturePath, 'utf8');
const richHtml = fs.readFileSync(richFixturePath, 'utf8');
assert.ok(
  countCallPlanArticleCards(thinHtml) < 3,
  'thin fixture must lack 3 passenger call-plan article cards'
);
assert.strictEqual(
  countCallPlanArticleCards(richHtml),
  3,
  'rich fixture must have 3 passenger call-plan article cards'
);

const guides = JSON.parse(fs.readFileSync(guidesPath, 'utf8'));
const portGuide = guides.byAppPortId['coco-cay'];
assert.ok(portGuide, 'coco-cay guide in JSON');
assert.strictEqual(portGuide.researchImport?.publication_tier, 'passenger_editorial');

const degradedGenerated =
  '<!DOCTYPE html><html><body><main>' +
  '<section class="pg-section" id="things-to-do"><p>Generic list.</p></section>' +
  '<section class="pg-section" id="getting-there"><p>Stub.</p></section>' +
  '</main></body></html>';
const merged = mergePassengerEditorialBodyPreservation(degradedGenerated, richHtml, portGuide);
assert.ok(
  countCallPlanArticleCards(merged) >= 3,
  'mergePassengerEditorialBodyPreservation keeps richer passenger body'
);
assert.ok(/id="getting-there"[\s\S]*?<dl class="pg-facts">/.test(merged), 'preserves rich getting-there');

const preservedFull = mergePublishedPortHtmlPreservation(thinHtml, richHtml, {
  portGuide,
  affiliate: { url: 'https://example.test/viator' },
});
assert.strictEqual(
  countCallPlanArticleCards(preservedFull),
  3,
  'mergePublishedPortHtmlPreservation must not downgrade call-plan cards'
);
const withoutExistingDisk = mergePublishedPortHtmlPreservation(thinHtml, '', {
  portGuide,
  affiliate: { url: null },
});
assert.ok(
  countCallPlanArticleCards(withoutExistingDisk) < 3,
  'regression control: no on-disk rich HTML → preservation cannot restore cards'
);

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

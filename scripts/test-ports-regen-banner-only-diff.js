'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  stripBookableSection,
  assertApprovedBannerCopy,
  resolveGateModeFromPushFiles,
  SENTINEL,
} = require('./assert-ports-regen-banner-only-diff');

const root = path.join(__dirname, '..');

const BOOKABLE_OLD =
  '<section class="pg-section pg-booking" id="bookable-experiences" aria-label="Bookable experiences">' +
  '<span class="pg-booking-badge">Top Rated Experiences</span>' +
  '<a class="pg-booking-cta" href="https://www.viator.com/searchResults/all?text=Barcelona&amp;pid=P00314321&amp;mcid=42383&amp;medium=link&amp;campaign=seadays-web-pbarcelona">Browse</a>' +
  '</section>';

const BOOKABLE_NEW =
  '<section class="pg-section pg-booking" id="bookable-experiences" aria-label="Bookable experiences">' +
  '<span class="pg-booking-badge">Explore Shore Experiences</span>' +
  '<p>Browse shore excursions, tours, and activities on our booking partner’s site.</p>' +
  '<a class="pg-booking-cta" href="https://www.viator.com/searchResults/all?text=Barcelona&amp;pid=P00314321&amp;mcid=42383&amp;medium=link&amp;campaign=seadays-web-pbarcelona">Browse</a>' +
  '<p class="pg-affiliate-note">SeaDays may earn a commission</p>' +
  '</section>';

const PRIVATE_ISLAND =
  '<section class="pg-section pg-booking" id="bookable-experiences" aria-label="Shore excursions">' +
  '<h2>Shore excursions</h2><p class="pg-prose">Excursions are sold by your cruise line.</p></section>';

function wrapPage(bookable, extraBefore = '') {
  return (
    `<!doctype html><html><head>` +
    `<meta name="robots" content="index, follow">` +
    `<link rel="canonical" href="https://seadays.app/ports/foo/">` +
    `<script type="application/ld+json">{"@type":"TouristDestination","name":"Foo"}</script>` +
    `</head><body><main>${extraBefore}${bookable}</main></body></html>`
  );
}

assert.ok(stripBookableSection(wrapPage(BOOKABLE_OLD)).stripped.includes(SENTINEL));
assert.strictEqual(
  stripBookableSection(wrapPage(BOOKABLE_OLD)).stripped,
  stripBookableSection(wrapPage(BOOKABLE_NEW)).stripped
);

assert.doesNotThrow(() => assertApprovedBannerCopy(BOOKABLE_OLD, BOOKABLE_NEW, 'barcelona-spain'));

assert.throws(() => assertApprovedBannerCopy(BOOKABLE_OLD, BOOKABLE_OLD, 'x'), /Top Rated/);

const badViator = BOOKABLE_NEW.replace(
  'campaign=seadays-web-pbarcelona',
  'campaign=seadays-web-hacked'
);
assert.throws(() => assertApprovedBannerCopy(BOOKABLE_OLD, badViator, 'x'), /campaign/);

assert.throws(() => assertApprovedBannerCopy(PRIVATE_ISLAND, BOOKABLE_NEW, 'cococay'), /private-island/);

const PR124_FILES = [
  'scripts/lib/portGuideSections.js',
  'scripts/lib/publishGate.js',
  'scripts/test-ports-phase1.js',
];

assert.strictEqual(resolveGateModeFromPushFiles(['scripts/lib/portGuideSections.js']), 'banner-only');
assert.strictEqual(resolveGateModeFromPushFiles(PR124_FILES), 'banner-only');
assert.strictEqual(resolveGateModeFromPushFiles(['scripts/lib/publishGate.js']), 'off');
assert.strictEqual(
  resolveGateModeFromPushFiles([
    'scripts/lib/portGuideSections.js',
    'data/public-port-guides.json',
  ]),
  'block'
);
assert.strictEqual(
  resolveGateModeFromPushFiles([
    ...PR124_FILES,
    'scripts/generate-all-ports.js',
  ]),
  'block'
);
assert.strictEqual(resolveGateModeFromPushFiles([]), 'off');

const MAIN_BEFORE = 'bdd1802dd639a388268dcba5d154c5c12fd93e79';
const PR124_SHA = 'ef6f3e7766399e73b4cd974ba1e15bf53bbe5f94';
const AUTO_PROBE = [
  '-e',
  "const { resolveGateMode } = require('./scripts/assert-ports-regen-banner-only-diff'); console.log(resolveGateMode());",
];

function runGateAutoProbe(envExtra, expectFail, expectedMode) {
  let status = 0;
  let out = '';
  try {
    out = execFileSync('node', AUTO_PROBE, {
      cwd: root,
      env: { ...process.env, ...envExtra },
      encoding: 'utf8',
    });
  } catch (err) {
    status = err.status || 1;
    out = String(err.stdout || err.stderr || '');
  }
  if (expectFail) assert.ok(status !== 0, `expected auto probe failure; got: ${out}`);
  else {
    assert.strictEqual(status, 0, `auto probe failed: ${out}`);
    const modeLine = out.trim().split('\n').pop();
    assert.strictEqual(modeLine, expectedMode);
  }
  return out;
}

runGateAutoProbe(
  {
    SEADAYS_PORTS_REGEN_DIFF_GATE: 'auto',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_BEFORE: '',
    SOURCE_SHA: MAIN_BEFORE,
  },
  true
);

runGateAutoProbe(
  {
    SEADAYS_PORTS_REGEN_DIFF_GATE: 'auto',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_BEFORE: MAIN_BEFORE,
    SOURCE_SHA: '',
  },
  true
);

runGateAutoProbe(
  {
    SEADAYS_PORTS_REGEN_DIFF_GATE: 'auto',
    GITHUB_EVENT_NAME: 'workflow_dispatch',
    GITHUB_EVENT_BEFORE: '',
    SOURCE_SHA: '',
  },
  false,
  'off'
);

runGateAutoProbe(
  {
    SEADAYS_PORTS_REGEN_DIFF_GATE: 'auto',
    GITHUB_EVENT_NAME: 'push',
    GITHUB_EVENT_BEFORE: MAIN_BEFORE,
    SOURCE_SHA: PR124_SHA,
  },
  false,
  'banner-only'
);

const fixtureRoot = path.join(root, 'scripts', '.tmp-ports-regen-gate-fixture');
const slug = 'zz-gate-fixture-port';
const rel = `ports/${slug}/index.html`;
const htmlDir = path.join(fixtureRoot, 'ports', slug);
fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(htmlDir, { recursive: true });

const baseHtml = wrapPage(BOOKABLE_OLD, '<p id="editorial">Terminal A is 0.4 km away.</p>');
const goodHtml = wrapPage(BOOKABLE_NEW, '<p id="editorial">Terminal A is 0.4 km away.</p>');
const badCanon = goodHtml.replace('https://seadays.app/ports/foo/', 'https://seadays.app/ports/bar/');

execFileSync('git', ['init', '-q'], { cwd: fixtureRoot });
execFileSync('git', ['config', 'user.email', 'gate@test.local'], { cwd: fixtureRoot });
execFileSync('git', ['config', 'user.name', 'gate-test'], { cwd: fixtureRoot });
fs.writeFileSync(path.join(htmlDir, 'index.html'), baseHtml, 'utf8');
execFileSync('git', ['add', rel], { cwd: fixtureRoot });
execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: fixtureRoot });
const baseSha = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: fixtureRoot, encoding: 'utf8' }).trim();

function runGateCli(workHtml, expectFail) {
  fs.writeFileSync(path.join(htmlDir, 'index.html'), workHtml, 'utf8');
  let status = 0;
  try {
    execFileSync('node', [path.join(root, 'scripts/assert-ports-regen-banner-only-diff.js')], {
      cwd: fixtureRoot,
      env: {
        ...process.env,
        PORTS_REGEN_GATE_REPO_ROOT: fixtureRoot,
        SOURCE_SHA: baseSha,
        SEADAYS_PORTS_REGEN_DIFF_GATE: 'banner-only',
      },
      stdio: 'pipe',
    });
  } catch (err) {
    status = err.status || 1;
  }
  if (expectFail) assert.ok(status !== 0, 'expected non-zero exit');
  else assert.strictEqual(status, 0, 'expected gate pass');
}

runGateCli(goodHtml, false);
runGateCli(baseHtml, false);
runGateCli(badCanon, true);

const badHero = goodHtml.replace('Terminal A is 0.4 km away.', 'Terminal A is 99 km away.');
runGateCli(badHero, true);

const badAffiliateHtml = wrapPage(
  BOOKABLE_NEW.replace('campaign=seadays-web-pbarcelona', 'campaign=other'),
  '<p id="editorial">Terminal A is 0.4 km away.</p>'
);
runGateCli(badAffiliateHtml, true);

const addedSlug = 'ports/zz-gate-new-port/index.html';
const addedDir = path.join(fixtureRoot, 'ports', 'zz-gate-new-port');
fs.mkdirSync(addedDir, { recursive: true });
fs.writeFileSync(path.join(addedDir, 'index.html'), goodHtml, 'utf8');
let addedStatus = 0;
try {
  execFileSync('node', [path.join(root, 'scripts/assert-ports-regen-banner-only-diff.js')], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      PORTS_REGEN_GATE_REPO_ROOT: fixtureRoot,
      SOURCE_SHA: baseSha,
      SEADAYS_PORTS_REGEN_DIFF_GATE: 'banner-only',
    },
    stdio: 'pipe',
  });
} catch (err) {
  addedStatus = err.status || 1;
}
assert.ok(addedStatus !== 0, 'expected added port HTML to fail gate');
fs.rmSync(path.join(fixtureRoot, addedSlug), { force: true });

assert.throws(() => {
  execFileSync('node', [path.join(root, 'scripts/assert-ports-regen-banner-only-diff.js')], {
    cwd: fixtureRoot,
    env: {
      ...process.env,
      PORTS_REGEN_GATE_REPO_ROOT: fixtureRoot,
      SOURCE_SHA: 'notasha',
      SEADAYS_PORTS_REGEN_DIFF_GATE: 'banner-only',
    },
    stdio: 'pipe',
  });
});

const workflow = fs.readFileSync(path.join(root, '.github/workflows/generate-ports.yml'), 'utf8');
const gateIdx = workflow.indexOf('Assert ports regen banner-only diff');
const changeIdx = workflow.indexOf('Check for changes');
const commitIdx = workflow.indexOf('Commit and push (safe)');
assert.ok(gateIdx > 0, 'workflow missing gate step');
assert.ok(gateIdx < changeIdx && gateIdx < commitIdx, 'gate must run before check/commit');
assert.ok(workflow.includes('SEADAYS_PORTS_REGEN_DIFF_GATE: auto'), 'workflow uses auto activation');
assert.ok(workflow.includes('GITHUB_EVENT_NAME:'), 'workflow passes event name for fail-closed auto');

fs.rmSync(fixtureRoot, { recursive: true, force: true });

console.log('test-ports-regen-banner-only-diff: OK');

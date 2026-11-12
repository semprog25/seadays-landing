'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseGenerateMode } = require('./lib/generateMode');
const {
  shouldPreserveGlobalSiteArtifacts,
  isPortsOnlyBannerRegenGeneration,
} = require('./lib/portsRegenScope');
const {
  resolveGateModeFromPushFiles,
  VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST,
} = require('./assert-ports-regen-banner-only-diff');

const root = path.join(__dirname, '..');
const portsOnlyMode = parseGenerateMode(['node', 'generateBlogs.js', '--ports-only']);
const catalogueMode = parseGenerateMode(['node', 'generateBlogs.js', '--catalogue-only']);
const blogsMode = parseGenerateMode(['node', 'generateBlogs.js', '--blogs-only']);

assert.strictEqual(shouldPreserveGlobalSiteArtifacts(portsOnlyMode, { targetedOnly: false }), false);
assert.strictEqual(shouldPreserveGlobalSiteArtifacts(catalogueMode, { targetedOnly: false }), false);
assert.strictEqual(shouldPreserveGlobalSiteArtifacts(portsOnlyMode, { targetedOnly: true }), true);

process.env.SEADAYS_PORTS_REGEN_DIFF_GATE = 'banner-only';
assert.strictEqual(shouldPreserveGlobalSiteArtifacts(portsOnlyMode, { targetedOnly: false }), true);
assert.strictEqual(isPortsOnlyBannerRegenGeneration(portsOnlyMode), true);
assert.strictEqual(isPortsOnlyBannerRegenGeneration(catalogueMode), false);
assert.strictEqual(isPortsOnlyBannerRegenGeneration(blogsMode), false);
delete process.env.SEADAYS_PORTS_REGEN_DIFF_GATE;

const recoveryFiles = [...VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST];
assert.strictEqual(
  resolveGateModeFromPushFiles([
    'scripts/lib/portGuideSections.js',
    'scripts/lib/publishGate.js',
    'scripts/test-ports-phase1.js',
  ]),
  'banner-only'
);
const offFixture = path.join(root, 'scripts', '.tmp-ports-regen-scope-off-fixture');
fs.rmSync(offFixture, { recursive: true, force: true });
fs.mkdirSync(path.join(offFixture, 'scripts', 'lib'), { recursive: true });
fs.writeFileSync(
  path.join(offFixture, 'scripts', 'lib', 'portGuideSections.js'),
  'module.exports = {}; // Top Rated Experiences legacy\n',
  'utf8'
);
execFileSync('git', ['init', '-q'], { cwd: offFixture });
execFileSync('git', ['config', 'user.email', 'off@test.local'], { cwd: offFixture });
execFileSync('git', ['config', 'user.name', 'off-test'], { cwd: offFixture });
execFileSync('git', ['add', '.'], { cwd: offFixture });
execFileSync('git', ['commit', '-q', '-m', 'legacy'], { cwd: offFixture });
const savedRoot = process.env.PORTS_REGEN_GATE_REPO_ROOT;
process.env.PORTS_REGEN_GATE_REPO_ROOT = offFixture;
assert.strictEqual(
  resolveGateModeFromPushFiles(['scripts/generateBlogs.js', 'scripts/lib/portsRegenScope.js']),
  'off'
);
process.env.PORTS_REGEN_GATE_REPO_ROOT = savedRoot;
fs.rmSync(offFixture, { recursive: true, force: true });
assert.strictEqual(
  resolveGateModeFromPushFiles([
    ...recoveryFiles,
    'scripts/lib/portGuideSections.js',
  ]),
  'block'
);

const fixtureRoot = path.join(root, 'scripts', '.tmp-ports-regen-scope-fixture');
fs.rmSync(fixtureRoot, { recursive: true, force: true });
fs.mkdirSync(fixtureRoot, { recursive: true });
const guidePath = path.join(fixtureRoot, 'scripts', 'lib', 'portGuideSections.js');
fs.mkdirSync(path.dirname(guidePath), { recursive: true });
fs.writeFileSync(
  guidePath,
  'module.exports = { buildBookableExperiences: () => "<span>Explore Shore Experiences</span>" };\n',
  'utf8'
);
fs.writeFileSync(path.join(fixtureRoot, 'ads.txt'), 'google.com, pub-test, DIRECT\n', 'utf8');
fs.writeFileSync(path.join(fixtureRoot, 'sitemap.xml'), '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n', 'utf8');
fs.mkdirSync(path.join(fixtureRoot, 'blog', 'sample'), { recursive: true });
fs.writeFileSync(path.join(fixtureRoot, 'blog', 'sample', 'index.html'), '<html><body>blog</body></html>', 'utf8');

execFileSync('git', ['init', '-q'], { cwd: fixtureRoot });
execFileSync('git', ['config', 'user.email', 'scope@test.local'], { cwd: fixtureRoot });
execFileSync('git', ['config', 'user.name', 'scope-test'], { cwd: fixtureRoot });
execFileSync('git', ['add', '.'], { cwd: fixtureRoot });
execFileSync('git', ['commit', '-q', '-m', 'base'], { cwd: fixtureRoot });

const priorEnv = { ...process.env };
process.env.PORTS_REGEN_GATE_REPO_ROOT = fixtureRoot;
assert.strictEqual(
  resolveGateModeFromPushFiles([...recoveryFiles.filter((f) => f.startsWith('scripts/'))]),
  'banner-only'
);
assert.strictEqual(resolveGateModeFromPushFiles(['scripts/generateBlogs.js', 'data/foo.json']), 'block');
Object.assign(process.env, priorEnv);
delete process.env.PORTS_REGEN_GATE_REPO_ROOT;

const workflow = fs.readFileSync(path.join(root, '.github/workflows/generate-ports.yml'), 'utf8');
assert.ok(workflow.includes('scripts/generateBlogs.js'), 'workflow triggers on generateBlogs.js');
assert.match(workflow, /Generate channel[\s\S]*SEADAYS_PORTS_REGEN_DIFF_GATE: auto/, 'generate step shares gate env');

fs.rmSync(fixtureRoot, { recursive: true, force: true });

console.log('test-ports-regen-banner-scope: OK');

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { evaluatePublishGate } = require('./lib/publishGate');
const { isShipDetailIndexable } = require('./lib/adsenseIndexability');
const { isAuditNoindexPort } = require('./lib/auditHoldback');
const { buildRestoreContext, mayRestorePageToIndex } = require('./lib/publishGateRestoreEligibility');
const {
  classifySlugForRestoreProposal,
  isExplicitlyApprovedForIndexRestore,
  loadOct27AuditClassMap,
} = require('./lib/publishGateIndexRestoreManifest');

const root = path.join(__dirname, '..');

function loadBatchPages() {
  const slugs = [
    'barcelona-spain',
    'miami-fl-united-states',
    'marigot-st-maarten',
    'hamburg-germany',
    'bergen-norway',
    'abu-dhabi-united-arab-emirates',
    'carnival-breeze',
  ];
  const pages = slugs.map((slug) => {
    const kind = slug === 'carnival-breeze' ? 'ship' : 'port';
    const rel = kind === 'ship' ? `ships/${slug}/index.html` : `ports/${slug}/index.html`;
    return {
      file: rel,
      slug,
      kind,
      html: fs.readFileSync(path.join(root, rel), 'utf8'),
    };
  });
  for (const ent of fs.readdirSync(path.join(root, 'ports'), { withFileTypes: true })) {
    if (!ent.isDirectory() || pages.some((p) => p.slug === ent.name)) continue;
    pages.push({
      file: `ports/${ent.name}/index.html`,
      slug: ent.name,
      kind: 'port',
      html: fs.readFileSync(path.join(root, 'ports', ent.name, 'index.html'), 'utf8'),
    });
  }
  return pages;
}

function issuesFor(slug, results) {
  const row = results.find((r) => r.slug === slug);
  return row ? row.issues : ['missing'];
}

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('guest-reviews CTA does not trigger shared-sentence on Barcelona batch', () => {
  const results = evaluatePublishGate(loadBatchPages());
  for (const slug of [
    'barcelona-spain',
    'miami-fl-united-states',
    'marigot-st-maarten',
    'hamburg-germany',
    'bergen-norway',
    'abu-dhabi-united-arab-emirates',
    'carnival-breeze',
  ]) {
    const issues = issuesFor(slug, results);
    assert.ok(
      !issues.some((i) => i.startsWith('shared sentence') && /share your experience/i.test(i)),
      `${slug} still fails guest-review CTA: ${issues.join('; ')}`
    );
  }
});

test('audit holdback port keeps audit noindex issue', () => {
  const html = fs.readFileSync(path.join(root, 'ports/acapulco-mexico/index.html'), 'utf8');
  const results = evaluatePublishGate([
    { file: 'ports/acapulco-mexico/index.html', slug: 'acapulco-mexico', kind: 'port', html },
  ]);
  assert.ok(isAuditNoindexPort('acapulco-mexico'));
  assert.ok(results[0].issues.includes('audit noindex'));
});

test('genuine duplicated editorial prose still fails shared-sentence check', () => {
  const dup =
    'Cruisers often underestimate how long the walk from the cruise terminal pier back to the city center can take on a hot afternoon.';
  const pages = [];
  for (let i = 0; i < 8; i += 1) {
    pages.push({
      file: `ports/fake-${i}/index.html`,
      slug: `fake-${i}`,
      kind: 'port',
      html: `<main><article class="seo-body"><p>${dup}</p></article></main>`,
    });
  }
  const results = evaluatePublishGate(pages);
  assert.ok(results.every((r) => r.issues.some((i) => i.startsWith('shared sentence'))));
});

test('Carnival Breeze passes gate and ship indexability for restore eligibility', () => {
  const overrides = JSON.parse(
    fs.readFileSync(path.join(root, 'data/landing-cruise-content-overrides.json'), 'utf8')
  );
  const ov = overrides.ships['carnival-breeze'] || {};
  assert.ok(
    isShipDetailIndexable({
      slug: 'carnival-breeze',
      description: String(ov.description || '').trim(),
      confidenceScore: ov.confidenceScore,
      hasContentOverride: Boolean(ov.description),
    })
  );
  const html = fs.readFileSync(path.join(root, 'ships/carnival-breeze/index.html'), 'utf8');
  const batch = loadBatchPages();
  const results = evaluatePublishGate(batch);
  const row = results.find((r) => r.slug === 'carnival-breeze');
  assert.deepStrictEqual(row.issues, []);
});

test('sky-princess stays ineligible for ship index restore', () => {
  const overrides = JSON.parse(
    fs.readFileSync(path.join(root, 'data/landing-cruise-content-overrides.json'), 'utf8')
  );
  const ov = overrides.ships['sky-princess'] || {};
  assert.ok(
    !isShipDetailIndexable({
      slug: 'sky-princess',
      description: String(ov.description || '').trim(),
      confidenceScore: ov.confidenceScore,
      hasContentOverride: Boolean(ov.description),
    })
  );
  const html = fs.readFileSync(path.join(root, 'ships/sky-princess/index.html'), 'utf8');
  const ctx = buildRestoreContext(root);
  assert.ok(!mayRestorePageToIndex({ kind: 'ship', slug: 'sky-princess', html }, { ...ctx, gateIssues: [], html }));
});

test('scheduled CI default does not restore Barcelona without approved manifest', () => {
  const prev = process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY;
  delete process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY;
  const html = fs.readFileSync(path.join(root, 'ports/barcelona-spain/index.html'), 'utf8');
  const batch = loadBatchPages();
  const results = evaluatePublishGate(batch);
  const row = results.find((r) => r.slug === 'barcelona-spain');
  const ctx = buildRestoreContext(root);
  assert.deepStrictEqual(row.issues, []);
  assert.ok(
    !mayRestorePageToIndex(
      { kind: 'port', slug: 'barcelona-spain', html },
      { ...ctx, gateIssues: row.issues, html }
    )
  );
  if (prev === undefined) delete process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY;
  else process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY = prev;
});

test('NOINDEX_CANDIDATE slug is never approved for restore even with APPLY=1', () => {
  const auditMap = loadOct27AuditClassMap(root);
  const sample = [...auditMap.entries()].find(([, v]) => v === 'NOINDEX_CANDIDATE');
  assert.ok(sample, 'expected NOINDEX sample in Oct27 CSV');
  const prev = process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY;
  process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY = '1';
  const [key] = sample;
  const [kind, slug] = key.split(':');
  const manifest = {
    entries: [{ kind, slug, auditClass: 'NOINDEX_CANDIDATE' }],
  };
  assert.ok(!isExplicitlyApprovedForIndexRestore(kind, slug, manifest));
  if (prev === undefined) delete process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY;
  else process.env.PUBLISH_GATE_INDEX_RESTORE_APPLY = prev;
});

test('unclassified slug stays fail-closed without manifest entry', () => {
  const auditMap = loadOct27AuditClassMap(root);
  assert.strictEqual(classifySlugForRestoreProposal('port', 'this-slug-not-in-audit-2026', auditMap), 'UNCLASSIFIED');
  const ctx = buildRestoreContext(root);
  assert.ok(
    !mayRestorePageToIndex(
      { kind: 'port', slug: 'this-slug-not-in-audit-2026', html: '<meta name="robots" content="noindex, follow">' },
      { ...ctx, gateIssues: [], html: '' }
    )
  );
});

test('le-commandant-charcot spec failure blocks restore', () => {
  const html = fs.readFileSync(path.join(root, 'ships/le-commandant-charcot/index.html'), 'utf8');
  const row = evaluatePublishGate([
    { file: 'ships/le-commandant-charcot/index.html', slug: 'le-commandant-charcot', kind: 'ship', html },
  ])[0];
  assert.ok(row.issues.some((i) => i.includes('spec')));
  const ctx = buildRestoreContext(root);
  assert.ok(!mayRestorePageToIndex({ kind: 'ship', slug: 'le-commandant-charcot', html }, { ...ctx, gateIssues: row.issues, html }));
});

console.log('publish-gate guest-reviews CTA tests passed');

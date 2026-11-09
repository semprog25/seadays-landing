#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha');
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot');
const { removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards');
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards');
const { buildPublishedSlugSet, exclusionReasonForSlug } = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-held-recovery-6');
const PARENT = path.join(EVIDENCE, 'PARENT_STAGE68_MANIFEST.json');
const RECOVERY = path.join(EVIDENCE, 'STAGE68_HELD_RECOVERY_MANIFEST.json');
const PREP_BUNDLE = 'd5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE68_HELD_APPLY_STOP', message: msg }, null, 2));
  process.exit(42);
}

function loadProposed(slug) {
  const p = path.join(EVIDENCE, 'proposed-guides', `${slug}.json`);
  const g = JSON.parse(fs.readFileSync(p, 'utf8'));
  if (!String(g.portInfo?.description || '').trim()) fail(`portInfo.description required: ${slug}`);
  return g;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const recovery = JSON.parse(fs.readFileSync(RECOVERY, 'utf8'));
  const parent = JSON.parse(fs.readFileSync(PARENT, 'utf8'));
  if (parent.bundle_idempotency_hash !== PREP_BUNDLE) fail('parent bundle mismatch');
  if (recovery.preparation_bundle_hash !== PREP_BUNDLE) fail('recovery prep bundle mismatch');

  const slugs = (recovery.slugs_approved || []).slice().sort();
  if (!slugs.length) fail('no approved slugs in recovery manifest');
  for (const h of ['falmouth-jamaica']) {
    if (slugs.includes(h)) fail(`excluded slug in apply list: ${h}`);
  }

  const portsBySlug = new Map(parent.ports.map((p) => [p.landing_slug, p]));
  const publishedSet = buildPublishedSlugSet(REPO);
  const guidesBefore = loadPublicPortGuidesFile(REPO);

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO });
  try {
    for (const landingSlug of slugs) {
      const row = portsBySlug.get(landingSlug);
      if (!row) fail(`missing row ${landingSlug}`);
      const rowRecovery = recovery.rows.find((r) => r.landing_slug === landingSlug);
      if (!rowRecovery?.publication_gates_pass) fail(`gates not pass at prep: ${landingSlug}`);
      const ex = exclusionReasonForSlug(landingSlug, publishedSet);
      if (ex) fail(`not net-new: ${landingSlug} (${ex})`);
      const prior = guidesBefore.byAppPortId?.[row.app_port_id];
      if (prior && usesPassengerEditorialLead(prior)) fail(`slot already passenger_editorial: ${landingSlug}`);
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug,
        manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
      });
      if (!sha.ok) fail(`research sha ${landingSlug}: ${sha.reason}`);
    }
  } finally {
    cleanup();
  }

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply');
  if (!dryRun) {
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'));
    if (fs.existsSync(path.join(REPO, 'data/public-port-terminals.json'))) {
      fs.copyFileSync(path.join(REPO, 'data/public-port-terminals.json'), path.join(rollbackDir, 'public-port-terminals.json'));
    }
    const cococay = path.join(REPO, 'ports/perfect-day-at-cococay-bahamas/index.html');
    if (fs.existsSync(cococay)) {
      fs.mkdirSync(path.join(rollbackDir, 'ports/perfect-day-at-cococay-bahamas'), { recursive: true });
      fs.copyFileSync(cococay, path.join(rollbackDir, 'ports/perfect-day-at-cococay-bahamas/index.html'));
    }
    for (const landingSlug of slugs) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) {
        fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true });
        fs.copyFileSync(page, path.join(rollbackDir, 'ports', landingSlug, 'index.html'));
      }
    }
  }

  const nextGuides = JSON.parse(JSON.stringify(guidesBefore));
  const appliedAt = new Date().toISOString();
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const proposed = loadProposed(landingSlug);
    const g = JSON.parse(JSON.stringify(proposed));
    g.researchImport = {
      ...(g.researchImport || {}),
      publication_tier: 'passenger_editorial',
      stage68_held_recovery_publication: true,
      stage68_preparation_bundle_hash: PREP_BUNDLE,
      stage68_held_recovery_bundle_hash: recovery.bundle_idempotency_hash,
      applied_at_utc: appliedAt,
    };
    assignPublicPortGuideByAppPortId(nextGuides, {
      landingSlug,
      appPortId: row.app_port_id,
      guide: g,
      priorGuideAtSlot: guidesBefore.byAppPortId[row.app_port_id],
    });
  }
  removeStage65ExcludedGuideEntries(nextGuides);

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, slugs, recovery_bundle: recovery.bundle_idempotency_hash }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const prior = guidesBefore.byAppPortId?.[row.app_port_id];
    if (!prior || !usesPassengerEditorialLead(prior)) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) fs.unlinkSync(page);
    }
  }

  const slugMap = {};
  for (const landingSlug of slugs) {
    slugMap[landingSlug] = portsBySlug.get(landingSlug).app_port_id;
  }
  const slugMapPath = path.join(EVIDENCE, 'STAGE68_HELD_RECOVERY_SLUG_MAP.json');
  fs.writeFileSync(slugMapPath, `${JSON.stringify(slugMap, null, 2)}\n`, 'utf8');
  execSync(`node scripts/generateBlogs.js --ports-only --only=${slugs.join(',')}`, {
    cwd: REPO,
    stdio: 'inherit',
    env: { ...process.env, STAGE68_PUBLICATION_SLUG_MAP: slugMapPath },
  });

  execSync(`SEADAYS_HTML_POSTPROCESS_DIRS=ports node scripts/rewrite-download-ctas.js`, { cwd: REPO, stdio: 'pipe' });

  const applyReport = {
    applied_at_utc: appliedAt,
    slugs,
    slug_count: slugs.length,
    preparation_bundle_hash: PREP_BUNDLE,
    recovery_bundle_hash: recovery.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
  };
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(applyReport, null, 2));
}

main();

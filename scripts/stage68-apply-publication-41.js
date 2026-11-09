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
const { getAliasRedirectTarget } = require('./lib/portSeoRedirects');
const { buildPublishedSlugSet, exclusionReasonForSlug } = require('./lib/bulkPortPublication/stage43PublishedBaseline');
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');

const REPO = path.join(__dirname, '..');
const PREP = path.join(REPO, 'qa-evidence/stage68-bootstrap-47');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-publication-41');
const MANIFEST = path.join(PREP, 'STAGE68_MANIFEST.json');
const EXPECTED_BUNDLE = 'd5095e1ef878d8cc1fd8a437a0ff9bdc48b2c6d169a3f899e6fa17fed06d6583';

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE68_PUBLICATION_APPLY_STOP', message: msg }, null, 2));
  process.exit(42);
}

function loadGuideForApply(row) {
  const proposed = JSON.parse(fs.readFileSync(path.join(REPO, row.proposed_guide_ref), 'utf8'));
  const correctedPath = path.join(REPO, row.corrected_draft_ref || '');
  if (row.corrected_draft_ref && fs.existsSync(correctedPath)) {
    const correctedWrap = JSON.parse(fs.readFileSync(correctedPath, 'utf8'));
  const corrected = correctedWrap.draft || correctedWrap;
    if (!String(proposed.portInfo?.description || '').trim() && String(corrected.portInfo?.description || '').trim()) {
      proposed.portInfo = { ...(proposed.portInfo || {}), ...(corrected.portInfo || {}) };
    }
  }
  if (!String(proposed.portInfo?.description || '').trim()) {
    fail(`portInfo.description required for HTML gen: ${row.landing_slug}`);
  }
  return proposed;
}

function main() {
  const dryRun = process.argv.includes('--dry-run');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  if (manifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) {
    fail(`bundle hash mismatch (expected ${EXPECTED_BUNDLE})`);
  }
  const approvedAll = (manifest.slugs_approved || []).slice().sort();
  if (approvedAll.length !== 41) fail(`expected 41 approved slugs, got ${approvedAll.length}`);
  const held = ['oslo-norway', 'st-croix-frederiksted-us-virgin-islands', 'new-york-ny-united-states', 'ocean-cay-msc-reserve-bahamas', 'kefalonia-greece', 'wilhelmshaven-germany', 'falmouth-jamaica'];
  for (const h of held) {
    if (approvedAll.includes(h)) fail(`held/excluded slug in approved list: ${h}`);
  }

  const portsBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]));
  const publishedSet = buildPublishedSlugSet(REPO);
  const guidesBefore = loadPublicPortGuidesFile(REPO);

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO });
  try {
    for (const landingSlug of approvedAll) {
      const row = portsBySlug.get(landingSlug);
      if (!row?.production_apply_allowed || !row.publication_gates_pass) fail(`not allowed: ${landingSlug}`);
      const ex = exclusionReasonForSlug(landingSlug, publishedSet);
      if (ex) fail(`not net-new: ${landingSlug} (${ex})`);
      const prior = guidesBefore.byAppPortId?.[row.app_port_id];
      if (prior && usesPassengerEditorialLead(prior)) fail(`slot already passenger_editorial: ${landingSlug}`);
      const proposedPath = path.join(REPO, row.proposed_guide_ref);
      if (!fs.existsSync(proposedPath)) fail(`missing proposed: ${landingSlug}`);
      const proposed = loadGuideForApply(row);
      const contentHash = crypto.createHash('sha256').update(stableStringify(JSON.parse(fs.readFileSync(proposedPath, 'utf8')))).digest('hex');
      if (row.proposed_content_hash && contentHash !== row.proposed_content_hash) {
        fail(`proposed content hash mismatch: ${landingSlug}`);
      }
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

  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json');
  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply');
  const slugs = approvedAll.slice();

  if (!dryRun) {
    fs.mkdirSync(rollbackDir, { recursive: true });
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'));
    if (fs.existsSync(terminalsPath)) {
      fs.copyFileSync(terminalsPath, path.join(rollbackDir, 'public-port-terminals.json'));
    }
    for (const landingSlug of slugs) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) {
        fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true });
        fs.copyFileSync(page, path.join(rollbackDir, 'ports', landingSlug, 'index.html'));
      }
    }
    const cococay = path.join(REPO, 'ports/perfect-day-at-cococay-bahamas/index.html');
    if (fs.existsSync(cococay)) {
      fs.mkdirSync(path.join(rollbackDir, 'ports', 'perfect-day-at-cococay-bahamas'), { recursive: true });
      fs.copyFileSync(cococay, path.join(rollbackDir, 'ports/perfect-day-at-cococay-bahamas/index.html'));
    }
  }

  const nextGuides = JSON.parse(JSON.stringify(guidesBefore));
  const appliedAt = new Date().toISOString();
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const proposed = loadGuideForApply(row);
    const g = JSON.parse(JSON.stringify(proposed));
    g.researchImport = {
      ...(g.researchImport || {}),
      publication_tier: 'passenger_editorial',
      stage68_bootstrap_41_publication: true,
      stage68_preparation_bundle_hash: manifest.bundle_idempotency_hash,
      preparation_pr_head: 'cfe0cfb6eb85359062052f954bedba9c24f6e247',
      applied_at_utc: appliedAt,
      field_exclusions: row.field_exclusions || [],
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
    console.log(JSON.stringify({ dry_run: true, slugs, bundle_hash: manifest.bundle_idempotency_hash }, null, 2));
    return;
  }

  writePublicPortGuidesFile(REPO, nextGuides);
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug);
    const prior = guidesBefore.byAppPortId?.[row.app_port_id];
    const wasPassenger =
      prior && usesPassengerEditorialLead(prior);
    if (!wasPassenger) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html');
      if (fs.existsSync(page)) fs.unlinkSync(page);
    }
  }
  const standaloneAliases = slugs.filter((s) => getAliasRedirectTarget(s)).sort();
  const slugMap = {};
  for (const landingSlug of slugs) {
    slugMap[landingSlug] = portsBySlug.get(landingSlug).app_port_id;
  }
  const slugMapPath = path.join(EVIDENCE, 'STAGE68_PUBLICATION_SLUG_MAP.json');
  fs.writeFileSync(slugMapPath, `${JSON.stringify(slugMap, null, 2)}\n`, 'utf8');
  const only = slugs.join(',');
  const genEnv = {
    ...process.env,
    STAGE68_PUBLICATION_STANDALONE_ALIAS_SLUGS: standaloneAliases.join(','),
    STAGE68_PUBLICATION_SLUG_MAP: slugMapPath,
  };
  execSync(`node scripts/generateBlogs.js --ports-only --only=${only}`, { cwd: REPO, stdio: 'inherit', env: genEnv });

  const applyReport = {
    applied_at_utc: appliedAt,
    slugs,
    slug_count: slugs.length,
    bundle_hash: manifest.bundle_idempotency_hash,
    preparation_bundle_hash: manifest.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
    manifest_lock: manifest.lock_version,
  };
  fs.mkdirSync(EVIDENCE, { recursive: true });
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE68_PUBLICATION_MANIFEST.json'),
    `${JSON.stringify(
      {
        schema_version: 1,
        status: 'READY_FOR_OWNER_REVIEW',
        slugs_approved: slugs,
        preparation_bundle_hash: manifest.bundle_idempotency_hash,
        preparation_pr: 'https://github.com/semprog25/seadays-landing/pull/94',
        baseline_main: 'cade908f94b1ff2fbcac86e14adca61c59db2f0b',
      },
      null,
      2
    )}\n`,
    'utf8'
  );
  console.log(JSON.stringify(applyReport, null, 2));
}

main();

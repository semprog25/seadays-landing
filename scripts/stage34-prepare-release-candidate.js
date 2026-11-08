#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { stableStringify } = require('./lib/portResearchImport/jsonDiff');

const REPO = path.join(__dirname, '..');
const STAGE33 = path.join(REPO, 'qa-evidence', 'stage33-remaining-ports');
const OUT = path.join(REPO, 'qa-evidence', 'stage34-14-port-release');
const EXPECTED_STAGE33_BUNDLE = '2b15a9d47cd2a964ab9fb9a214522b4116ddde4b514b978d8c70e308cbfd80fa';
const LOCK = 'stage34-14-port-release-v1';

const LOCKED_SLUGS = [
  'helsinki-finland',
  'hvar-croatia',
  'isafjordur-iceland',
  'klaipeda-lithuania',
  'koper-slovenia',
  'kotor-montenegro',
  'kuala-lumpur-port-klang-malaysia',
  'limassol-cyprus',
  'muscat-oman',
  'nice-france',
  'philipsburg-st-maarten',
  'san-juan-puerto-rico',
  'sicily-catania-italy',
  'singapore-singapore',
];

const GATEWAY_NOTES = {
  'nice-france': 'Port Lympia vs Villefranche called out in practical tip.',
  'muscat-oman': 'Port Sultan Qaboos (PSQ) framing; not generic Muscat city arrival.',
  'kuala-lumpur-port-klang-malaysia': 'Port Klang / PKCT — not downtown KL.',
  'philipsburg-st-maarten': 'Pier 2 Wathey — Philipsburg vs Marigot transfer clarity.',
  'singapore-singapore': 'MBCCS vs HarbourFront SCC distinction in tip.',
};

function main() {
  const lockedAt = new Date().toISOString();
  const s33 = JSON.parse(fs.readFileSync(path.join(STAGE33, 'STAGE33_RELEASE_CANDIDATES.json'), 'utf8'));
  if (s33.bundle_idempotency_hash !== EXPECTED_STAGE33_BUNDLE) {
    throw new Error(`Stage 33 bundle mismatch: ${s33.bundle_idempotency_hash}`);
  }
  const s33Slugs = s33.slugs.slice().sort();
  const want = LOCKED_SLUGS.slice().sort();
  if (JSON.stringify(s33Slugs) !== JSON.stringify(want)) {
    throw new Error('Stage 33 slugs differ from Stage 34 lock');
  }

  const ports = want.map((slug) => {
    const row = s33.ports.find((p) => p.landing_slug === slug);
    if (!row || !row.publication_gates_pass) throw new Error(`missing/failed row: ${slug}`);
    return {
      ...row,
      production_apply_allowed: true,
      owner_approval_status: 'PENDING',
      proposed_guide_ref: `qa-evidence/stage33-remaining-ports/proposed-guides/${slug}.json`,
      rollback_ref: `qa-evidence/stage33-remaining-ports/rollback/${slug}.production-snapshot.json`,
      preview_ref: `qa-evidence/stage33-remaining-ports/previews/${slug}/index.html`,
      stage33_source_bundle_hash: EXPECTED_STAGE33_BUNDLE,
      gateway_note: GATEWAY_NOTES[slug] || null,
    };
  });

  const releaseBundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        ports.map((p) => ({
          landing_slug: p.landing_slug,
          candidate_content_hash: p.candidate_content_hash,
          draft_file_sha256: p.draft_file_sha256,
        }))
      )
    )
    .digest('hex');

  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true });

  const manifest = {
    schema_version: 1,
    lock_version: LOCK,
    status: 'IMMUTABLE_CANDIDATE_PENDING_OWNER',
    owner_publication_authorized: false,
    created_at_utc: lockedAt,
    stage33_source_bundle_hash: EXPECTED_STAGE33_BUNDLE,
    bundle_idempotency_hash: releaseBundleHash,
    production_baseline_sha: s33.production_baseline_sha,
    candidate_count: ports.length,
    passing_all_gates: ports.length,
    slugs_locked: want,
    ports,
    gateway_identity_review: GATEWAY_NOTES,
  };

  fs.writeFileSync(path.join(OUT, 'STAGE34_RELEASE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  fs.writeFileSync(
    path.join(OUT, 'STAGE34_LOCKED_COHORT.json'),
    `${JSON.stringify({ locked_slugs: LOCKED_SLUGS, stage33_bundle: EXPECTED_STAGE33_BUNDLE, release_bundle: releaseBundleHash }, null, 2)}\n`,
    'utf8'
  );
  fs.writeFileSync(
    path.join(OUT, 'STAGE34_ROLLBACK.md'),
    `# Stage 34 rollback\n\nRestore \`qa-evidence/stage34-14-port-release/rollback-pre-apply/public-port-guides.json\` and per-port HTML under \`rollback-pre-apply/ports/\`.\n\nStage 33 bundle: \`${EXPECTED_STAGE33_BUNDLE}\`\nRelease bundle: \`${releaseBundleHash}\`\n`,
    'utf8'
  );

  console.log(
    JSON.stringify({ ok: true, count: ports.length, releaseBundleHash, out: OUT }, null, 2)
  );
}

main();

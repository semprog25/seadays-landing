#!/usr/bin/env node
'use strict';

/**
 * Rebuild APPLY_REPORT.json + RELEASE_VALIDATION.json from manifest slugs_approved
 * without re-applying guides or regenerating HTML.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execSync } = require('child_process');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage66-next-50-recovery');
const MANIFEST_PATH = path.join(EVIDENCE, 'STAGE66_NEXT_50_MANIFEST.json');

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  const slugs = (manifest.slugs_approved || []).slice().sort();
  if (slugs.length !== 50) {
    throw new Error(`expected 50 approved slugs, got ${slugs.length}`);
  }

  const priorApply = fs.existsSync(path.join(EVIDENCE, 'APPLY_REPORT.json'))
    ? JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
    : null;

  const applyReport = {
    applied_at_utc: priorApply?.applied_at_utc || manifest.created_at_utc,
    slugs,
    bundle_hash: manifest.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
    swap_note: manifest.swap_note || 'rostock-germany -> thessaloniki-greece',
    evidence_repaired_at_utc: new Date().toISOString(),
    evidence_repair_note:
      'Full cohort slugs restored in APPLY_REPORT after partial --only= apply overwrote evidence (no guide/HTML mutation).',
  };

  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8');
  execSync('node scripts/stage66-validate-next-50-release.js', { cwd: REPO, stdio: 'inherit' });

  const validation = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), 'utf8'));
  if (!validation.ok || validation.slugs.length !== 50) {
    throw new Error('RELEASE_VALIDATION did not pass 50/50');
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        slugs: slugs.length,
        bundle_hash: applyReport.bundle_hash,
        guides_sha256: applyReport.guides_sha256,
      },
      null,
      2
    )
  );
}

main();

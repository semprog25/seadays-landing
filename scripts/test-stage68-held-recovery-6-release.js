#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const EVIDENCE = path.join(REPO, 'qa-evidence/stage68-held-recovery-6');

function countPassengerEditorial(guides) {
  let n = 0;
  for (const g of Object.values(guides.byAppPortId || {})) {
    if (g?.researchImport?.publication_tier === 'passenger_editorial') n += 1;
  }
  return n;
}

function main() {
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'));
  const recovery = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE68_HELD_RECOVERY_MANIFEST.json'), 'utf8'));
  if (apply.recovery_bundle_hash !== recovery.bundle_idempotency_hash) throw new Error('bundle mismatch');
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'));
  const n = countPassengerEditorial(guides);
  const expected = 313 + apply.slug_count;
  if (n !== expected) throw new Error(`expected ${expected} passenger_editorial, got ${n}`);
  if (!fs.existsSync(path.join(REPO, 'ports/falmouth-jamaica/index.html'))) {
    throw new Error('missing falmouth-jamaica guard page');
  }
  console.log('test-stage68-held-recovery-6-release PASS', { passenger_editorial: n, added: apply.slug_count });
}

main();

#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')

function main() {
  const cohort = JSON.parse(fs.readFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), 'utf8'))
  const report = JSON.parse(fs.readFileSync(path.join(OUT, 'EDITORIAL_REVIEW_REPORT.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))

  assert.strictEqual(cohort.selected_count, 25)
  assert.strictEqual(report.ports.length, 25)
  const sum =
    report.counts.EDITORIAL_PASS +
    report.counts.EDITORIAL_REPAIR_REQUIRED +
    report.counts.EDITORIAL_HOLD
  assert.strictEqual(sum, 25)

  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  for (const row of manifest.ports) {
    assert.strictEqual(row.production_apply_allowed, false)
    assert.strictEqual(row.owner_approval_status, 'PENDING')
    assert.ok(row.editorial_verdict)
  }

  const shaVal = JSON.parse(fs.readFileSync(path.join(OUT, 'RESEARCH_SHA_VALIDATION.json'), 'utf8'))
  assert.strictEqual(shaVal.verified_count, 25)

  let applyBlocked = false
  try {
    execSync('node scripts/stage71-apply-bootstrap-25.js', { cwd: REPO, stdio: 'pipe' })
  } catch (err) {
    applyBlocked = err.status === 42
  }
  assert.strictEqual(applyBlocked, true)

  const diff = execSync('git diff origin/main --name-only -- data/ ports/', { cwd: REPO, encoding: 'utf8' }).trim()
  assert.strictEqual(diff, '', 'production data/ports must be unchanged')

  console.log('test-stage72-editorial-review-25 PASS', {
    counts: report.counts,
    max_safe: report.maximum_safe_publication_cohort.length,
    bundle: manifest.bundle_idempotency_hash,
  })
}

main()

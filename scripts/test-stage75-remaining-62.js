#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage75-remaining-62')
const PREP = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep')

function main() {
  assert.ok(fs.existsSync(path.join(OUT, 'RECONCILE_SUMMARY.json')))
  const summary = JSON.parse(fs.readFileSync(path.join(OUT, 'RECONCILE_SUMMARY.json'), 'utf8'))
  assert.strictEqual(summary.remaining_unpublished_count, 62)
  assert.strictEqual(summary.live_passenger_editorial_guide_count, 344)
  assert.ok(fs.existsSync(path.join(OUT, 'STAGE75_COMPLETION_LEDGER.json')))
  const ledger = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE75_COMPLETION_LEDGER.json'), 'utf8'))
  assert.strictEqual(ledger.rows.length, 62)
  assert.strictEqual(ledger.totals.recovered_publication_ready, 6)

  const manifest = JSON.parse(fs.readFileSync(path.join(PREP, 'STAGE71_MANIFEST.json'), 'utf8'))
  assert.strictEqual(manifest.passing_all_gates, 6)
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)

  execSync('node scripts/stage75-reconcile-remaining-62.js', { cwd: REPO, stdio: 'pipe' })
  console.log('test-stage75-remaining-62: PASS')
}

main()

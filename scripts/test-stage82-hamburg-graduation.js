#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage82-hamburg-graduation')

function main() {
  assert.ok(fs.existsSync(path.join(EVIDENCE, 'STAGE82_PUBLICATION_MANIFEST.json')))
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE82_PUBLICATION_MANIFEST.json'), 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.owner_indexing_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.deepStrictEqual(manifest.slugs_publication_candidate, ['hamburg-germany'])
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 355)
  assert.strictEqual(manifest.projected_passenger_editorial_if_merged, 356)
  assert.strictEqual(manifest.upgrade_in_place, true)

  execSync('node scripts/stage82-validate-hamburg-candidate.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/test-stage82-candidate-leak-guard.js', { cwd: REPO, stdio: 'pipe' })
  console.log('test-stage82-hamburg-graduation PASS', { projected: 356 })
}

main()

#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage78-publication-5')
const MANIFEST = path.join(EVIDENCE, 'STAGE78_PUBLICATION_MANIFEST.json')

function main() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.slugs_publication_candidate.length, 5)
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 350)
  assert.strictEqual(manifest.projected_passenger_editorial_if_merged, 355)

  execSync('node scripts/stage78-validate-publication-candidate.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/test-stage78-candidate-leak-guard.js', { cwd: REPO, stdio: 'pipe' })
  console.log('test-stage78-publication-5 PASS', { slug_count: 5, projected: 355 })
}

main()

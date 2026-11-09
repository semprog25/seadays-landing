#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage76-publication-6')

function main() {
  assert.ok(fs.existsSync(path.join(EVIDENCE, 'STAGE76_PUBLICATION_MANIFEST.json')))
  const manifest = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE76_PUBLICATION_MANIFEST.json'), 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.slugs_publication_candidate.length, 6)
  assert.strictEqual(manifest.projected_passenger_editorial_if_merged, 350)
  assert.strictEqual(manifest.preparation_bundle_hash, '87483ccb0c21b1d92b6aa119231369b7e5309ec6ba5e020424f33478a2f8233c')
  assert.ok(fs.existsSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json')))
  const validation = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), 'utf8'))
  assert.strictEqual(validation.passenger_editorial_count, 350)
  assert.strictEqual(validation.baseline_rollback_passenger_editorial, 344)
  assert.strictEqual(validation.ok, true)
  execSync('node scripts/stage76-validate-publication-candidate.js', { cwd: REPO, stdio: 'pipe' })
  console.log('test-stage76-publication-6: PASS')
}

main()

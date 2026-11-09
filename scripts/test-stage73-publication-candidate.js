#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { execSync } = require('child_process')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage73-publication-25')
const BUNDLE = '0e115b7f34302350026a532e8c8f9add4bb9965e77584894181059f80f0f0f8b'

function main() {
  const prepManifest = JSON.parse(fs.readFileSync(path.join(PREP, 'STAGE71_MANIFEST.json'), 'utf8'))
  const candidate = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE73_PUBLICATION_MANIFEST.json'), 'utf8'))
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
  const validation = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), 'utf8'))
  const signoff = JSON.parse(fs.readFileSync(path.join(PREP, 'PUBLICATION_SIGNOFF_REPORT.json'), 'utf8'))

  const ready = signoff.buckets.PUBLICATION_READY.slice().sort()
  assert.strictEqual(ready.length, 25)
  assert.deepStrictEqual(candidate.slugs_publication_candidate.slice().sort(), ready)
  assert.deepStrictEqual(apply.slugs.slice().sort(), ready)
  assert.deepStrictEqual(validation.slugs.slice().sort(), ready)

  assert.strictEqual(apply.bundle_hash, BUNDLE)
  assert.strictEqual(prepManifest.bundle_idempotency_hash, BUNDLE)
  assert.strictEqual(candidate.preparation_bundle_hash, BUNDLE)
  assert.strictEqual(validation.ok, true)
  assert.strictEqual(validation.html_pass_count, 25)
  assert.strictEqual(validation.passenger_editorial_count, 344)
  assert.strictEqual(validation.baseline_rollback_passenger_editorial, 319)

  assert.strictEqual(prepManifest.owner_publication_authorized, false)
  assert.strictEqual(prepManifest.production_apply_permitted, false)
  assert.strictEqual((prepManifest.slugs_approved || []).length, 0)
  assert.strictEqual(candidate.owner_publication_authorized, false)
  assert.strictEqual(candidate.production_apply_permitted, false)
  assert.strictEqual((candidate.slugs_approved || []).length, 0)

  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE, 'rollback-pre-apply/public-port-guides.json'), 'utf8')
  )
  removeStage65ExcludedGuideEntries(rollbackGuides)
  assert.strictEqual(countPassengerEditorialGuides(rollbackGuides), 319)

  let reapplyBlocked = false
  try {
    execSync('node scripts/stage73-apply-publication-candidate.js', {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch (e) {
    const errText = `${e.stderr || ''}${e.stdout || ''}${e.message || ''}`
    reapplyBlocked = /already passenger_editorial|STAGE73_PUBLICATION_CANDIDATE_APPLY_STOP/.test(errText)
  }
  assert.strictEqual(reapplyBlocked, true, 'second apply must fail closed (idempotent)')

  let blocked = false
  try {
    execSync('node scripts/stage71-apply-bootstrap-25.js', {
      cwd: REPO,
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  } catch {
    blocked = true
  }
  assert.strictEqual(blocked, true, 'stage71 apply must remain fail-closed')

  console.log('test-stage73-publication-candidate PASS', { slug_count: 25, projected: 344 })
}

main()

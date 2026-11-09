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
  assert.strictEqual(cohort.selected_count, 25)
  assert.deepStrictEqual(cohort.category_a_deferred_preparation?.length, 6)
  assert.ok(!cohort.category_a_deferred_excluded, 'legacy mixed exclusion field must be absent')
  assert.strictEqual(
    cohort.pilot_held_from_cohort?.[0]?.landing_slug,
    'hamburg-germany'
  )
  assert.ok(
    !cohort.category_a_deferred_preparation.includes('hamburg-germany'),
    'hamburg must not appear in category_a_deferred_preparation'
  )
  assert.strictEqual(cohort.historical_owner_policy_excluded?.length, 6)
  for (const slug of cohort.selected_slugs) {
    assert.ok(!cohort.historical_owner_policy_excluded.includes(slug))
    assert.ok(!cohort.category_a_deferred_preparation.includes(slug))
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.slugs_technical_eligible?.length, 25)
  assert.strictEqual(manifest.slugs_approved?.length, 0)
  for (const row of manifest.ports) {
    assert.strictEqual(row.technical_apply_eligible, true, row.landing_slug)
    assert.strictEqual(row.production_apply_allowed, false, row.landing_slug)
    assert.strictEqual(row.owner_approval_status, 'PENDING', row.landing_slug)
  }

  let applyBlocked = false
  try {
    execSync('node scripts/stage71-apply-bootstrap-25.js', { cwd: REPO, stdio: 'pipe' })
  } catch (err) {
    applyBlocked = err.status === 42
  }
  assert.strictEqual(applyBlocked, true, 'stage71 apply must exit 42 without owner authorization')

  let stage68WrongBundle = false
  try {
    execSync('node scripts/stage68-apply-publication-41.js --dry-run', { cwd: REPO, stdio: 'pipe' })
  } catch (err) {
    stage68WrongBundle = err.status === 42
  }
  assert.strictEqual(
    stage68WrongBundle,
    true,
    'stage68 apply must not consume stage71 manifest (hard-coded stage68 bundle)'
  )

  const boundary = JSON.parse(fs.readFileSync(path.join(OUT, 'PUBLICATION_AUTHORIZATION_BOUNDARY.json'), 'utf8'))
  const stage73Validation = path.join(REPO, 'qa-evidence/stage73-publication-25/RELEASE_VALIDATION.json')
  if (!fs.existsSync(stage73Validation)) {
    assert.strictEqual(boundary.production_data_modified_on_branch, false)
    assert.strictEqual(boundary.live_passenger_editorial_baseline, 319)
  } else {
    const s73 = JSON.parse(fs.readFileSync(stage73Validation, 'utf8'))
    assert.strictEqual(s73.passenger_editorial_count, 344)
    assert.strictEqual(s73.baseline_rollback_passenger_editorial, 319)
  }

  console.log('test-stage71-publication-safety PASS', {
    cohort_exclusions: {
      category_a_deferred: 6,
      pilot: 1,
      historical: 6,
    },
    apply_fail_closed: true,
    prod_hash_unchanged: boundary.production_public_port_guides_sha256,
  })
}

main()

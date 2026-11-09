#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')
const STAGE70 = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31')
const MERGED_RESEARCH = '77968a38ba420a4011af3b83b9d444c3e1552ad1'

function main() {
  const cohort = JSON.parse(fs.readFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  const shaVal = JSON.parse(fs.readFileSync(path.join(OUT, 'RESEARCH_SHA_VALIDATION.json'), 'utf8'))
  const post = JSON.parse(fs.readFileSync(path.join(STAGE70, 'post_repair_COHORT_MANIFEST.json'), 'utf8'))

  assert.strictEqual(cohort.selected_count, 25)
  assert.deepStrictEqual([...cohort.selected_slugs].sort(), [...post.selected_slugs].sort())
  assert.strictEqual(cohort.merged_research_commit, MERGED_RESEARCH)
  assert.strictEqual(manifest.candidate_count_selected, 25)
  assert.strictEqual(manifest.passing_all_gates, 25)
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.verified_research_commit, MERGED_RESEARCH)
  assert.strictEqual(shaVal.verified_count, 25)
  assert.ok(!cohort.selected_slugs.includes('hamburg-germany'))
  assert.strictEqual(cohort.category_a_deferred_preparation.length, 6)
  assert.strictEqual(cohort.historical_owner_policy_excluded.length, 6)
  assert.ok(!cohort.category_a_deferred_preparation.includes('hamburg-germany'))

  const recovery = JSON.parse(fs.readFileSync(path.join(OUT, 'RECOVERY_RESULTS.json'), 'utf8'))
  for (const row of recovery.ports) {
    assert.strictEqual(row.publication_gates_pass, true, row.landing_slug)
    assert.ok(row.call_plan_cards >= 3, row.landing_slug)
    const preview = fs.readFileSync(path.join(OUT, 'previews-local-only', `${row.landing_slug}.html`), 'utf8')
    assert.ok(preview.includes('pg-call-plan-card--short'), row.landing_slug)
    assert.ok(preview.includes('pg-call-plan-card--standard'), row.landing_slug)
    assert.ok(preview.includes('pg-call-plan-card--longer'), row.landing_slug)
    const draft = JSON.parse(
      fs.readFileSync(path.join(OUT, 'corrected-drafts', `${row.landing_slug}.json`), 'utf8')
    )
    assert.strictEqual(draft.owner_bucket, 'READY_FOR_OWNER_APPROVAL')
    assert.ok(draft.draft?.thingsToDo?.shortCall, row.landing_slug)
  }

  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.slugs_technical_eligible.length, 25)
  assert.strictEqual(manifest.slugs_approved.length, 0)
  for (const portRow of manifest.ports) {
    assert.strictEqual(portRow.technical_apply_eligible, true, portRow.landing_slug)
    assert.strictEqual(portRow.production_apply_allowed, false, portRow.landing_slug)
  }

  console.log('test-stage71-bootstrap-25-prep PASS', {
    preparation_pass: recovery.ports.length,
    bundle: manifest.bundle_idempotency_hash,
  })
}

main()

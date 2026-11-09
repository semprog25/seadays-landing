#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31')
const FIXTURE = path.join(REPO, 'scripts/fixtures/stage70-category-b-yaml.json')

function main() {
  const slugs = JSON.parse(fs.readFileSync(FIXTURE, 'utf8')).landing_slugs
  assert.strictEqual(slugs.length, 31)
  const summary = JSON.parse(fs.readFileSync(path.join(OUT, 'RECONCILE_SUMMARY.json'), 'utf8'))
  assert.strictEqual(summary.cohort_gate_pass.yaml_parse, 31)
  assert.strictEqual(summary.cohort_gate_pass.sha_match, 31)
  assert.strictEqual(summary.cohort_gate_pass.policy_dry_run_ok, 31)
  assert.strictEqual(summary.preparation_technical_gate_pass_count, 31)
  assert.strictEqual(summary.live_passenger_editorial_slug_count, 319)
  assert.strictEqual(summary.remaining_unpublished_slug_count, 87)
  const gates = JSON.parse(fs.readFileSync(path.join(OUT, 'GATE_REPORT.json'), 'utf8'))
  assert.strictEqual(gates.length, 31)
  for (const g of gates) {
    assert.strictEqual(g.yaml_parse, true, g.landing_slug)
    assert.strictEqual(g.policy_ok, true, g.landing_slug)
    assert.strictEqual(g.publication_bucket, 'NEEDS_REVIEW', g.landing_slug)
  }
  const delta = JSON.parse(fs.readFileSync(path.join(OUT, 'POST_REPAIR_CATEGORY_B_DELTA.json'), 'utf8'))
  assert.strictEqual(delta.still_category_b_among_original_31, 0)
  assert.strictEqual(delta.original_category_b_count, 31)
  assert.strictEqual(summary.cohort_gate_pass.bootstrap_policy_ok_cohort.count, 0)
  assert.strictEqual(summary.cohort_gate_pass.bootstrap_policy_ok_cohort.cohort_members_in_bootstrap_pool, 0)
  console.log('test-stage70-yaml-repair-31 PASS', {
    preparation_technical_gate_pass: summary.preparation_technical_gate_pass_count,
    post_repair_cohort: delta.cohort_selected,
  })
}

main()

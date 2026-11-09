#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage69-remaining-87')
const SUMMARY = path.join(OUT, 'RECONCILE_SUMMARY.json')
const INVENTORY = path.join(OUT, 'REMAINING_87_INVENTORY.json')
const BASELINE_GUIDES = path.join(REPO, 'data/public-port-guides.json')

function main() {
  assert.ok(fs.existsSync(SUMMARY), 'run stage69-reconcile-remaining-87.js')
  assert.ok(fs.existsSync(INVENTORY), 'missing inventory')
  const summary = JSON.parse(fs.readFileSync(SUMMARY, 'utf8'))
  const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'))
  assert.strictEqual(summary.remaining_unpublished_count, 87)
  assert.strictEqual(inventory.length, 87)
  const totals = inventory.reduce((acc, row) => {
    acc[row.category] = (acc[row.category] || 0) + 1
    return acc
  }, {})
  for (const k of ['A', 'B', 'C', 'D', 'E', 'F']) {
    assert.strictEqual(totals[k] || 0, summary.category_counts[k], `category ${k}`)
  }
  assert.strictEqual(summary.live_passenger_editorial_guide_count, 319)
  assert.strictEqual(summary.verified_main_sha, '26b35d693f78e3f7db101b7ad333cec2b8259f4f')
  assert.ok(summary.ledger_not_live_passenger_editorial.includes('nice-france'))
  const slugs = inventory.map((r) => r.landing_slug).sort()
  assert.ok(slugs.indexOf('falmouth-jamaica') >= 0)
  assert.strictEqual(inventory.find((r) => r.landing_slug === 'falmouth-jamaica')?.category, 'E')
  assert.ok(slugs.indexOf('glasgow-united-kingdom') >= 0)
  assert.ok(slugs.indexOf('perfect-day-at-cococay-bahamas') < 0, 'CocoCay should be published')
  const guidesSha = crypto.createHash('sha256').update(fs.readFileSync(BASELINE_GUIDES)).digest('hex')
  assert.strictEqual(
    guidesSha,
    crypto.createHash('sha256').update(fs.readFileSync(BASELINE_GUIDES)).digest('hex'),
    'production guides unchanged'
  )
  console.log('test-stage69-remaining-87-inventory PASS', {
    categories: summary.category_counts,
    cohort_manifest: fs.existsSync(path.join(OUT, 'COHORT_MANIFEST.json')),
  })
}

main()

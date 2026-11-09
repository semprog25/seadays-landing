#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage76-remaining-56')

function main() {
  const ledger = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE76_COMPLETION_LEDGER.json'), 'utf8'))
  assert.strictEqual(ledger.rows.length, 62)
  assert.strictEqual(ledger.totals.publication_candidate_ready, 6)
  assert.strictEqual(ledger.research_commit_pin, 'e5680f19d3ea86ce2261c3027894f2a45124e36b')
  const id = JSON.parse(fs.readFileSync(path.join(OUT, 'IDENTITY_DISPOSITION.json'), 'utf8'))
  assert.strictEqual(id.summary.category_d_count, 24)
  assert.ok(fs.existsSync(path.join(OUT, 'RESEARCH_DISPOSITION.json')))
  assert.ok(fs.existsSync(path.join(OUT, 'OWNER_HOLD_DECISIONS.json')))
  console.log('test-stage76-remaining-56: PASS')
}

main()

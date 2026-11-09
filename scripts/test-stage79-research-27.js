#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const REPORT = path.join(REPO, 'qa-evidence/stage79-research-27/STAGE79_RESEARCH_DISPOSITION.json')

assert.ok(fs.existsSync(REPORT), 'run stage79-research-disposition.js first')
const data = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
assert.strictEqual(data.rows.length, 27, '27 research-blocked ports')
assert.strictEqual(data.recovered, 0, 'no research PR without PASS')
assert.ok(data.still_blocked + data.needs_owner_evidence === 27)
const slugs = new Set(data.rows.map((r) => r.landing_slug))
assert.strictEqual(slugs.size, 27)
for (const row of data.rows) {
  assert.ok(['STILL_BLOCKED', 'NEEDS_OWNER_EVIDENCE', 'RECOVERED'].includes(row.stage79_disposition))
  assert.strictEqual(row.recoverable_with_approved_sources, false)
}

console.log('test-stage79-research-27 PASS', {
  still_blocked: data.still_blocked,
  needs_owner_evidence: data.needs_owner_evidence,
})

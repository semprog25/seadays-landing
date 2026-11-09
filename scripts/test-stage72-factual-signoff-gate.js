#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const OUT = path.join(__dirname, '..', 'qa-evidence/stage71-bootstrap-25')

function main() {
  const reportPath = path.join(OUT, 'PUBLICATION_SIGNOFF_REPORT.json')
  assert.ok(fs.existsSync(reportPath), 'PUBLICATION_SIGNOFF_REPORT.json missing — run stage72-factual-signoff-gate.js')
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'))
  const cohort = JSON.parse(fs.readFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), 'utf8'))

  assert.equal(report.ports.length, cohort.selected_slugs.length)
  assert.equal(
    report.publication_signoff_counts.PUBLICATION_READY +
      report.publication_signoff_counts.PUBLICATION_REPAIR +
      report.publication_signoff_counts.PUBLICATION_HOLD,
    25
  )
  assert.equal(report.policy?.owner_publication_authorized_unchanged, false)
  assert.equal(report.ports.every((p) => p.owner_publication_authorized === false), true)
  assert.equal(report.policy.editorial_pass_not_equal_factual_signoff, true)

  for (const row of report.ports) {
    assert.ok(['PUBLICATION_READY', 'PUBLICATION_REPAIR', 'PUBLICATION_HOLD'].includes(row.publication_verdict))
    assert.equal(row.production_apply_allowed, false)
    assert.equal(row.owner_publication_authorized, false)
    assert.equal(row.preview_terminal_map_rendered, false)
  }

  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  assert.equal(manifest.publication_signoff.owner_publication_authorized, false)
  assert.equal(manifest.publication_signoff.production_apply_permitted, false)

  console.log('test-stage72-factual-signoff-gate: ok', report.publication_signoff_counts)
}

main()

#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch05')
const SLUGS = [
  'freeport-bahamas',
  'ko-samui-thailand',
  'new-mangalore-india',
  'phuket-thailand',
]

function main() {
  const valPath = path.join(EVIDENCE, 'research-qa/BATCH05_RESEARCH_QA_VALIDATION.json')
  assert.ok(fs.existsSync(valPath), 'run batch05-research-qa-validate.js first')
  const val = JSON.parse(fs.readFileSync(valPath, 'utf8'))
  assert.strictEqual(val.pass_count + val.blocked_count, SLUGS.length)

  const baseline = JSON.parse(
    fs.readFileSync(path.join(EVIDENCE, 'research-qa/INDEX_BASELINE_FAILURES.json'), 'utf8')
  )
  for (const slug of SLUGS) {
    const row = val.ports.find((p) => p.landing_slug === slug)
    assert.ok(row, slug)
    assert.strictEqual(row.qa_verdict, 'BLOCKED', `${slug} must remain BLOCKED after validation`)
    assert.strictEqual(row.index_baseline_verdict, 'BLOCKED')
    const idx = baseline.ports.find((p) => p.landing_slug === slug)
    assert.ok(idx?.blocked_reason, slug)
    assert.ok(row.failures.includes('owner_index_blocked_reason_unresolved'), slug)
    assert.ok(!row.failures.includes('yaml_parse_error'), `${slug} overlay YAML must parse`)
  }

  const repair = path.join(EVIDENCE, 'research-repairs/by-port/new-mangalore-india.md')
  assert.ok(fs.existsSync(repair))

  console.log(JSON.stringify({ ok: true, blocked: val.blocked_count }, null, 2))
}

main()

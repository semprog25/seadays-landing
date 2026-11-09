#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')

function read(rel) {
  return JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'))
}

function main() {
  const phase0 = read('qa-evidence/stage77-verify-close-76/PHASE0_LIVE_VERIFICATION.json')
  assert.strictEqual(phase0.phase0_verdict, 'PASS')
  assert.strictEqual(phase0.live_passenger_editorial_count, 350)

  const regen = read('qa-evidence/stage77-verify-close-76/CATALOGUE_BOT_REGEN_SPOTCHECK.json')
  assert.strictEqual(regen.prior_regen_slug_count, 35)
  assert.strictEqual(regen.all_ok, true)

  const identity = read('qa-evidence/stage77-recover-32/STAGE77_IDENTITY_DISPOSITION.json')
  assert.strictEqual(identity.summary.category_d_count, 24)
  assert.strictEqual(identity.summary.collision, 0)
  assert.strictEqual(identity.summary.no_match, 0)

  const research = read('qa-evidence/stage77-recover-32/STAGE77_RESEARCH_DISPOSITION.json')
  assert.strictEqual(research.research_repair_candidates, 0)

  const ledger = read('qa-evidence/stage77-recover-32/STAGE77_COMPLETION_LEDGER.json')
  assert.strictEqual(ledger.max_defensible_new_published_without_owner_authorization, 0)

  console.log('test-stage77-close PASS')
}

main()

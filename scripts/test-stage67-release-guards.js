#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const assert = require('assert')
const { assertStage65ExcludedNotPublished } = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const GUIDES_PATH = path.join(REPO, 'data/public-port-guides.json')
const MANIFEST_PATH = path.join(REPO, 'qa-evidence/stage67-next-50-recovery/STAGE67_NEXT_50_MANIFEST.json')
const BASELINE_PASSENGER = 270

function main() {
  const guides = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'))
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'))
  assertStage65ExcludedNotPublished(guides)
  assert.strictEqual(guides.byAppPortId.glasgow, undefined)
  assert.strictEqual(manifest.slugs_approved.includes('glasgow-united-kingdom'), false)
  const approvedCount = manifest.slugs_approved.length
  assert.ok(approvedCount > 0, 'manifest must list approved slugs')

  let passenger = 0
  for (const v of Object.values(guides.byAppPortId)) {
    if (v?.researchImport?.publication_tier === 'passenger_editorial') passenger += 1
  }
  assert.strictEqual(passenger, BASELINE_PASSENGER + approvedCount)

  const rostock = guides.byAppPortId.rostock
  assert(
    rostock?.researchImport?.publication_tier !== 'passenger_editorial',
    'rostock must not be passenger after swap'
  )

  console.log('test-stage67-release-guards PASS', {
    passenger,
    projected: `${passenger}/406`,
    cohort: approvedCount,
  })
}

main()

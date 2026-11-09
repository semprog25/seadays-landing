#!/usr/bin/env node
'use strict'

/**
 * Stage 71 publication apply — fail-closed stub.
 * No production writes until owner sets owner_publication_authorized on STAGE71_MANIFEST.json
 * and a dedicated publication stage is explicitly authorized.
 */

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const MANIFEST = path.join(REPO, 'qa-evidence/stage71-bootstrap-25/STAGE71_MANIFEST.json')
const EXPECTED_LOCK = 'stage71-bootstrap-25-v1'

function fail(code, message) {
  console.error(JSON.stringify({ error: code, message }, null, 2))
  process.exit(42)
}

function main() {
  if (!fs.existsSync(MANIFEST)) fail('STAGE71_APPLY_STOP', 'missing STAGE71_MANIFEST.json')
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))
  if (manifest.lock_version !== EXPECTED_LOCK) {
    fail('STAGE71_APPLY_STOP', `unexpected lock_version: ${manifest.lock_version}`)
  }
  if (manifest.owner_publication_authorized !== true) {
    fail(
      'STAGE71_APPLY_STOP',
      'owner_publication_authorized is false — preparation bundle is not approved for production apply'
    )
  }
  if (manifest.production_apply_permitted !== true) {
    fail('STAGE71_APPLY_STOP', 'production_apply_permitted is false — manifest does not permit apply')
  }
  for (const row of manifest.ports || []) {
    if (row.production_apply_allowed !== true) {
      fail('STAGE71_APPLY_STOP', `production_apply_allowed false for ${row.landing_slug}`)
    }
    if (row.owner_approval_status !== 'APPROVED') {
      fail('STAGE71_APPLY_STOP', `owner_approval_status not APPROVED for ${row.landing_slug}`)
    }
  }
  fail(
    'STAGE71_APPLY_NOT_IMPLEMENTED',
    'Apply implementation is intentionally absent until owner authorizes a separate publication stage'
  )
}

main()

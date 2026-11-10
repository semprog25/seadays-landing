#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const STAGE77 = path.join(REPO, 'qa-evidence/stage77-recover-32/STAGE77_IDENTITY_WIRING_PROPOSAL.json')
const OUT = path.join(REPO, 'qa-evidence/stage79-identity-wiring-19')

const PUBLISHED = new Set([
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
])

function main() {
  if (!fs.existsSync(STAGE77)) {
    throw new Error(`missing ${STAGE77} — cherry-pick or copy from stage77 evidence`)
  }
  const stage77 = JSON.parse(fs.readFileSync(STAGE77, 'utf8'))
  const mappings = (stage77.mappings || []).filter((m) => !PUBLISHED.has(m.landing_slug))
  if (mappings.length !== 19) {
    throw new Error(`expected 19 mappings, got ${mappings.length}`)
  }
  const proposal = {
    schema_version: 1,
    stage: 79,
    status: 'OWNER_REVIEW',
    safe_to_apply: false,
    production_apply_permitted: false,
    note: 'Landing researchImport.app_port_id + byAppPortId bootstrap slots only — no app DB mutation; exclude 5 Stage 78 wired slugs',
    excluded_already_wired: [...PUBLISHED],
    mappings,
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'STAGE79_IDENTITY_WIRING_PROPOSAL.json'), `${JSON.stringify(proposal, null, 2)}\n`)
  console.log(JSON.stringify({ mappings: mappings.length }, null, 2))
}

main()

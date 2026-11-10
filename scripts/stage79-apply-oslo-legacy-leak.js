#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const LANDING_SLUG = 'oslo-norway'
const APP_PORT_ID = 'oslo'

const DESCRIPTION_AFTER =
  'Oslo Havn frames Oslo as a cruise destination combining urban waterfront and nature access. Cruise traffic uses two terminals: Revierkaia, described as the main cruise quay with shore power, and Filipstad, used until future urban redevelopment, with shore power for cruise ships noted as planned in Oslo Havn’s published cruise materials. The port states quays in central Oslo are usually open to the public and points to an Oslo Cruise Port Manual for operational detail. Individual berth LOA and depth figures are not always listed on the public English cruise pages — confirm which quay your sailing uses before you travel.'

function main() {
  const guides = loadPublicPortGuidesFile(REPO)
  const guide = guides.byAppPortId?.[APP_PORT_ID]
  if (!guide || guide.researchImport?.landing_slug !== LANDING_SLUG) {
    throw new Error(`missing guide slot ${APP_PORT_ID} for ${LANDING_SLUG}`)
  }
  const before = guide.portInfo?.description || ''
  guide.portInfo.description = DESCRIPTION_AFTER
  const leakBlob = `${guide.portInfo.description}\n${guide.gettingThere?.distanceAnswer || ''}`
  if (containsInternalResearchLeak(leakBlob)) {
    throw new Error('repair still triggers internal research leak scanner')
  }
  writePublicPortGuidesFile(REPO, guides)
  execSync(`SEADAYS_REGEN_PORT_SLUGS=${LANDING_SLUG} node scripts/regenerate-port-pages.js`, {
    cwd: REPO,
    stdio: 'inherit',
  })
  const evidenceDir = path.join(REPO, 'qa-evidence/stage79-oslo-legacy-leak')
  fs.mkdirSync(evidenceDir, { recursive: true })
  fs.writeFileSync(
    path.join(evidenceDir, 'OSLO_LEAK_REPAIR.json'),
  `${JSON.stringify(
    {
      generated_at_utc: new Date().toISOString(),
      landing_slug: LANDING_SLUG,
      app_port_id: APP_PORT_ID,
      field: 'portInfo.description',
      removed_phrases: ['captured page', 'captured English page', 'berth metrics stay null'],
      description_before_excerpt: before.slice(0, 160),
      passenger_leak_scan_after: 'PASS',
    },
    null,
    2
  )}\n`,
    'utf8'
  )
  console.log('stage79-apply-oslo-legacy-leak OK', { landing_slug: LANDING_SLUG })
}

main()

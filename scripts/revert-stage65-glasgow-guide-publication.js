#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage65-glasgow-revert')

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const guidesPath = path.join(REPO, 'data/public-port-guides.json')
  const beforeSha = sha256File(guidesPath)
  const passengerBefore = countPassengerEditorialGuides(loadPublicPortGuidesFile(REPO))

  const guides = loadPublicPortGuidesFile(REPO)
  const { removed } = removeStage65ExcludedGuideEntries(guides)
  const passengerAfter = countPassengerEditorialGuides(guides)

  const report = {
    reverted_at_utc: new Date().toISOString(),
    baseline_main_sha: '8fd113c609f9f036b91e7ccbfea523c19d42beec',
    root_cause:
      'Stage 65 apply swapped glasgow-united-kingdom for greifswald-germany in slugs_approved but left glasgow passenger guide JSON in public-port-guides.json (PR #85 merge). Catalogue regen did not introduce the tier.',
    guides_sha256_before: beforeSha,
    passenger_editorial_before: passengerBefore,
    passenger_editorial_after: passengerAfter,
    removed_app_port_ids: removed,
    html_action: 'no change — glasgow-united-kingdom remains legacy HTML without call-plan cards',
  }

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, report }, null, 2))
    return
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.copyFileSync(guidesPath, path.join(EVIDENCE, 'public-port-guides.before-revert.json'))
  writePublicPortGuidesFile(REPO, guides)
  report.guides_sha256_after = sha256File(guidesPath)
  fs.writeFileSync(path.join(EVIDENCE, 'GLASGOW_REVERT_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(report, null, 2))
}

main()

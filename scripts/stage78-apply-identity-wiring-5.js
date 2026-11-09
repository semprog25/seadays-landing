#!/usr/bin/env node
'use strict'

/**
 * Stage 78 — landing-only identity wiring for 5 VERIFIED_MAPPING slugs (no passenger_editorial).
 */

const fs = require('fs')
const path = require('path')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const { buildBootstrapGuideShell } = require('./lib/bulkPortPublication/stage65UnpublishedCohort')
const { dryRunPortImport } = require('./lib/portResearchImport/transformResearchToPublic')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { allPorts } = require('./lib/appCruiseDataset')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage78-five-port-prep')
const EVIDENCE = path.join(PREP, 'IDENTITY_WIRING_APPLY.json')
const WIRING = path.join(REPO, 'qa-evidence/stage77-recover-32/STAGE77_IDENTITY_WIRING_PROPOSAL.json')

const SLUGS = [
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
]

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const selected = JSON.parse(fs.readFileSync(path.join(PREP, 'SELECTED_CANDIDATES.json'), 'utf8'))
  const wiring = JSON.parse(fs.readFileSync(WIRING, 'utf8'))
  const wiringBySlug = new Map((wiring.mappings || []).map((m) => [m.landing_slug, m]))
  const seoBySlug = new Map(allPorts.map((p) => [p.slug, p]))

  const patchPath = path.join(PREP, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  const guides = loadPublicPortGuidesFile(REPO)
  const applied = []

  try {
    for (const slug of SLUGS) {
      const row = selected.find((r) => r.landing_slug === slug)
      if (!row) throw new Error(`missing selected row: ${slug}`)
      const wire = wiringBySlug.get(slug)
      if (!wire || wire.app_port_id !== row.app_port_id) throw new Error(`wiring mismatch: ${slug}`)

      const prior = guides.byAppPortId?.[row.app_port_id]
      if (prior && usesPassengerEditorialLead(prior)) {
        throw new Error(`slot already passenger_editorial: ${slug}`)
      }

      const seo = seoBySlug.get(slug) || {}
      let shell = prior ? JSON.parse(JSON.stringify(prior)) : buildBootstrapGuideShell({ ...row, name: seo.name })
      shell.appPortId = row.app_port_id
      shell.portName = shell.portName || seo.name || slug
      shell.country = shell.country || row.country || seo.country || ''

      const merge = dryRunPortImport({
        researchRoot: compositeRoot,
        landingSlug: slug,
        manifestRow: { ...row, qa_verdict: 'PASS' },
        existingGuide: shell,
        existingTerminals: [],
        qaVerdict: 'PASS',
      })
      if (merge.mergedGuide) {
        shell = { ...shell, ...merge.mergedGuide, appPortId: row.app_port_id }
      }

      shell.researchImport = {
        ...(shell.researchImport || {}),
        landing_slug: slug,
        app_port_id: row.app_port_id,
        publication_tier: 'identity_wired_prep',
        stage78_identity_wiring: true,
        owner_publication_authorized: false,
        research_sha256: row.research_sha256,
        stage77_verified_mapping: true,
      }

      assignPublicPortGuideByAppPortId(guides, {
        landingSlug: slug,
        appPortId: row.app_port_id,
        guide: shell,
        priorGuideAtSlot: prior,
      })
      applied.push({
        landing_slug: slug,
        app_port_id: row.app_port_id,
        had_prior_slot: Boolean(prior),
        evidence: wire.evidence,
      })
    }
  } finally {
    cleanup()
  }

  if (!dryRun) {
    fs.mkdirSync(PREP, { recursive: true })
    fs.writeFileSync(EVIDENCE, `${JSON.stringify({ applied_at_utc: new Date().toISOString(), rows: applied }, null, 2)}\n`, 'utf8')
    writePublicPortGuidesFile(REPO, guides)
  }
  console.log(JSON.stringify({ dry_run: dryRun, wired: applied.length, slugs: SLUGS }, null, 2))
}

main()

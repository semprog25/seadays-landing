#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { allPorts } = require('./lib/appCruiseDataset')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage78-five-port-prep')
const WIRING = path.join(REPO, 'qa-evidence/stage77-recover-32/STAGE77_IDENTITY_WIRING_PROPOSAL.json')
const PATCH_SRC = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/COMPOSITE_SHA_PATCH.json')

const LOCKED_SLUGS = [
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
]

function main() {
  if (!fs.existsSync(WIRING)) throw new Error('missing STAGE77_IDENTITY_WIRING_PROPOSAL.json')
  if (!fs.existsSync(PATCH_SRC)) throw new Error('missing stage75 COMPOSITE_SHA_PATCH.json')

  const wiring = JSON.parse(fs.readFileSync(WIRING, 'utf8'))
  const wiringBySlug = new Map((wiring.mappings || []).map((m) => [m.landing_slug, m]))
  const seoBySlug = new Map(allPorts.map((p) => [p.slug, p]))

  const patchPath = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
  fs.mkdirSync(OUT, { recursive: true })
  fs.copyFileSync(PATCH_SRC, patchPath)

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
  const bySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))

  const selected = []
  for (const landingSlug of LOCKED_SLUGS) {
    const wire = wiringBySlug.get(landingSlug)
    if (!wire?.app_port_id) throw new Error(`missing verified app_port_id: ${landingSlug}`)
    const row = bySlug.get(landingSlug)
    const seo = seoBySlug.get(landingSlug)
    const researchSha = row?.research_sha256 || row?.sha256
    if (!researchSha) throw new Error(`missing research sha: ${landingSlug}`)
    if (row.qa_verdict !== 'PASS') throw new Error(`research not PASS: ${landingSlug}`)
    selected.push({
      landing_slug: landingSlug,
      app_port_id: wire.app_port_id,
      country: seo?.country || '',
      research_sha256: researchSha,
      publication_bucket: row.publication_bucket || 'NEEDS_REVIEW',
      qa_verdict: 'PASS',
      identifier_confidence: 'review_key_picker_id',
      policy_dry_run: row.policy_dry_run || { ok: true, blockers: [], terminal_pin: 'allowed', enrichment_mode: false },
      stage77_wiring_evidence: wire.evidence,
    })
  }

  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8')
  cleanup()
  console.log(JSON.stringify({ ok: true, slug_count: selected.length, out: OUT }, null, 2))
}

main()

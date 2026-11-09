#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const crypto = require('crypto')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { sha256File } = require('./lib/portResearchImport/verifyResearchSha')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')
const RESEARCH_ROOT = '/Users/sharanestone/Semprog/seadays-ports-deliverables'
const RESEARCH_COMMIT = '0abbeb7f8f1049047e12f950588c16175c7830fe'

const DEFERRED_SLUGS = [
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
]

function main() {
  if (!fs.existsSync(INV)) throw new Error('run stage75-reconcile-remaining-62.js first')
  const patchPath = path.join(REPO, 'qa-evidence/stage75-remaining-62/COMPOSITE_SHA_PATCH.json')
  let patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'))
  patch.verified_research_commit = RESEARCH_COMMIT
  patch.by_port_root = RESEARCH_ROOT
  patch.sha_patch = patch.sha_patch || {}
  for (const slug of DEFERRED_SLUGS) {
    const md = path.join(RESEARCH_ROOT, 'by-port', `${slug}.md`)
    patch.sha_patch[slug] = sha256File(md)
  }
  fs.writeFileSync(patchPath, `${JSON.stringify(patch, null, 2)}\n`, 'utf8')

  process.env.PORT_RESEARCH_SHA_PATCH = patchPath
  process.env.PORT_RESEARCH_BY_PORT_ROOT = RESEARCH_ROOT

  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const selected = []
    for (const slug of DEFERRED_SLUGS) {
      const row = manifest.ports.find((p) => p.landing_slug === slug)
      const elig = report.ports.find((p) => p.landing_slug === slug)
      if (!row) throw new Error(`missing manifest row: ${slug}`)
      if (!elig?.policy_dry_run?.ok) {
        throw new Error(`policy not ok for ${slug}: ${JSON.stringify(elig?.policy_dry_run?.blockers)}`)
      }
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug: slug,
        manifestRow: { landing_slug: slug, sha256: patch.sha_patch[slug] },
      })
      if (!sha.ok) throw new Error(`sha verify failed ${slug}`)
      selected.push({
        landing_slug: slug,
        app_port_id: row.app_port_id,
        country: row.country,
        research_sha256: patch.sha_patch[slug],
        publication_bucket: elig.publication_bucket,
        qa_verdict: row.qa_verdict,
        identifier_confidence: row.identifier_confidence || 'inferred_not_canonical',
        policy_dry_run: elig.policy_dry_run,
      })
    }

    fs.mkdirSync(OUT, { recursive: true })
    fs.copyFileSync(patchPath, path.join(OUT, 'COMPOSITE_SHA_PATCH.json'))
    fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8')
    const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
    const prodSha = crypto.createHash('sha256').update(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'))).digest('hex')
    fs.writeFileSync(
      path.join(OUT, 'COHORT_MANIFEST.json'),
      `${JSON.stringify(
        {
          schema_version: 1,
          lock_version: 'stage75-deferred-6-v1',
          generated_at_utc: new Date().toISOString(),
          landing_baseline_sha: head,
          merged_research_commit: RESEARCH_COMMIT,
          selected_count: DEFERRED_SLUGS.length,
          selected_slugs: [...DEFERRED_SLUGS].sort(),
          hamburg_pilot_held: { landing_slug: 'hamburg-germany', reason: 'existing_pass_bucket_pilot_do_not_force_republish' },
          publication_status_policy: 'NEEDS_REVIEW',
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    fs.writeFileSync(
      path.join(OUT, 'PUBLICATION_AUTHORIZATION_BOUNDARY.json'),
      `${JSON.stringify(
        {
          verified_at_utc: new Date().toISOString(),
          production_public_port_guides_sha256: prodSha,
          live_passenger_editorial_baseline: 344,
          owner_publication_authorized: false,
          production_apply_permitted: false,
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    console.log(JSON.stringify({ verdict: 'LOCKED', selected: selected.length, out: OUT }, null, 2))
  } finally {
    cleanup()
  }
}

main()

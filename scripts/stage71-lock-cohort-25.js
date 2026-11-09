#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')

const REPO = path.join(__dirname, '..')
const STAGE70 = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')
const MERGED_RESEARCH_SHA = '77968a38ba420a4011af3b83b9d444c3e1552ad1'
const LANDING_BASELINE_SHA = '989c709f82ab8642ff285468998e41d8895a6a8c'
const CATEGORY_A_DEFERRED = new Set([
  'hamburg-germany',
  'tokyo-yokohama-japan',
  'kirkenes-norway',
  'ocho-rios-jamaica',
  'glasgow-united-kingdom',
  'rostock-germany',
  'falmouth-jamaica',
])

function main() {
  const postManifest = JSON.parse(
    fs.readFileSync(path.join(STAGE70, 'post_repair_COHORT_MANIFEST.json'), 'utf8')
  )
  const allCandidates = JSON.parse(
    fs.readFileSync(path.join(STAGE70, 'post_repair_SELECTED_CANDIDATES.json'), 'utf8')
  )
  const selectedSlugs = postManifest.selected_slugs || []
  if (selectedSlugs.length !== 25) {
    throw new Error(`expected 25 cohort slugs, got ${selectedSlugs.length}`)
  }
  for (const slug of selectedSlugs) {
    if (CATEGORY_A_DEFERRED.has(slug)) {
      throw new Error(`deferred slug must not be in cohort: ${slug}`)
    }
  }
  if (postManifest.pilot_held_from_cohort?.some((p) => p.landing_slug === 'hamburg-germany') === false) {
    throw new Error('expected hamburg-germany pilot hold in stage70 manifest')
  }

  const bySlug = new Map(allCandidates.map((r) => [r.landing_slug, r]))
  const selected = []
  const missing = []
  for (const slug of selectedSlugs) {
    const row = bySlug.get(slug)
    if (!row) missing.push(slug)
    else selected.push(row)
  }
  if (missing.length) throw new Error(`missing candidate rows: ${missing.join(', ')}`)

  for (const row of selected) {
    if (row.publication_bucket !== 'NEEDS_REVIEW') {
      throw new Error(`${row.landing_slug}: publication_bucket must stay NEEDS_REVIEW`)
    }
    if (row.qa_verdict !== 'PASS') {
      throw new Error(`${row.landing_slug}: qa_verdict must be PASS`)
    }
  }

  fs.mkdirSync(OUT, { recursive: true })

  const compositeSrc = path.join(STAGE70, 'COMPOSITE_SHA_PATCH.json')
  const composite = JSON.parse(fs.readFileSync(compositeSrc, 'utf8'))
  composite.verified_research_commit = MERGED_RESEARCH_SHA
  composite.stage71_research_pin_at_utc = new Date().toISOString()
  fs.writeFileSync(path.join(OUT, 'COMPOSITE_SHA_PATCH.json'), `${JSON.stringify(composite, null, 2)}\n`, 'utf8')

  const patchPath = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
  process.env.PORT_RESEARCH_SHA_PATCH = patchPath
  process.env.PORT_RESEARCH_BY_PORT_ROOT = composite.by_port_root

  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({
    landingRepoRoot: REPO,
    patchPath,
  })
  const shaRows = []
  try {
    for (const row of selected) {
      const verified = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug: row.landing_slug,
        manifestRow: { landing_slug: row.landing_slug, sha256: row.research_sha256 },
      })
      if (!verified.ok) {
        throw new Error(`research sha mismatch ${row.landing_slug}`)
      }
      shaRows.push({
        landing_slug: row.landing_slug,
        research_sha256: row.research_sha256,
        research_sha_verified: true,
        verified_research_commit: MERGED_RESEARCH_SHA,
      })
    }
  } finally {
    cleanup()
  }

  if (patchMeta.verified_research_commit !== MERGED_RESEARCH_SHA) {
    throw new Error('composite pin mismatch')
  }

  const cohortManifest = {
    schema_version: 1,
    lock_version: 'stage71-bootstrap-25-v1',
    generated_at_utc: new Date().toISOString(),
    landing_baseline_sha: LANDING_BASELINE_SHA,
    merged_research_commit: MERGED_RESEARCH_SHA,
    source_manifest: 'qa-evidence/stage70-yaml-repair-31/post_repair_COHORT_MANIFEST.json',
    selected_count: selectedSlugs.length,
    selected_slugs: [...selectedSlugs].sort(),
    pilot_held_from_cohort: postManifest.pilot_held_from_cohort || [],
    category_a_deferred_excluded: [...CATEGORY_A_DEFERRED].sort(),
    publication_status_policy: 'UNCHANGED_NEEDS_REVIEW',
  }

  fs.writeFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), `${JSON.stringify(cohortManifest, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(OUT, 'RESEARCH_SHA_VALIDATION.json'),
    `${JSON.stringify(
      {
        merged_research_commit: MERGED_RESEARCH_SHA,
        verified_count: shaRows.length,
        rows: shaRows,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

  console.log(
    JSON.stringify(
      {
        verdict: 'LOCKED',
        selected: selected.length,
        research_commit: MERGED_RESEARCH_SHA,
        out: OUT,
      },
      null,
      2
    )
  )
}

main()

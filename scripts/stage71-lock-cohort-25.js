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
const {
  STAGE69_OWNER_HOLD,
  FALMOUTH_JAMAICA_LANDING_SLUG,
} = require('./lib/bulkPortPublication/stage69IdentityGate')

/** Category A NEEDS_REVIEW ports not in the locked 25-slug net-new cohort */
const CATEGORY_A_DEFERRED_PREPARATION = [
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
]

const PILOT_HELD_LANDING_SLUG = 'hamburg-germany'

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
  const inventoryPath = path.join(STAGE70, 'post_repair_REMAINING_87_INVENTORY.json')
  const inventory = fs.existsSync(inventoryPath)
    ? JSON.parse(fs.readFileSync(inventoryPath, 'utf8'))
    : []
  const inventoryBySlug = new Map(inventory.map((r) => [r.landing_slug, r]))

  const forbiddenInCohort = new Set([
    PILOT_HELD_LANDING_SLUG,
    ...CATEGORY_A_DEFERRED_PREPARATION,
    ...STAGE69_OWNER_HOLD,
    FALMOUTH_JAMAICA_LANDING_SLUG,
  ])
  for (const slug of selectedSlugs) {
    if (forbiddenInCohort.has(slug)) {
      throw new Error(`excluded slug must not be in cohort: ${slug}`)
    }
  }
  if (postManifest.pilot_held_from_cohort?.some((p) => p.landing_slug === PILOT_HELD_LANDING_SLUG) === false) {
    throw new Error(`expected ${PILOT_HELD_LANDING_SLUG} pilot hold in stage70 manifest`)
  }
  for (const slug of CATEGORY_A_DEFERRED_PREPARATION) {
    const row = inventoryBySlug.get(slug)
    if (!row || row.category !== 'A') {
      throw new Error(`expected category A deferred preparation slug: ${slug}`)
    }
    if (selectedSlugs.includes(slug)) {
      throw new Error(`deferred category A slug leaked into cohort: ${slug}`)
    }
  }
  if (CATEGORY_A_DEFERRED_PREPARATION.length !== 6) {
    throw new Error('expected exactly 6 category A deferred preparation slugs')
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
    category_a_deferred_preparation: [...CATEGORY_A_DEFERRED_PREPARATION].sort(),
    historical_owner_policy_excluded: [...STAGE69_OWNER_HOLD, FALMOUTH_JAMAICA_LANDING_SLUG].sort(),
    cohort_exclusion_glossary: {
      category_a_deferred_preparation:
        'Six Category A NEEDS_REVIEW ports eligible for future prep but excluded from this 25-slug net-new cohort',
      pilot_held_from_cohort: 'Hamburg PASS-bucket pilot; not net-new editorial cohort',
      historical_owner_policy_excluded:
        'Owner factual holds and homonym/policy exclusions (not Category A deferrals)',
    },
    publication_status_policy: 'UNCHANGED_NEEDS_REVIEW',
  }

  fs.writeFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), `${JSON.stringify(cohortManifest, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8')
  const crypto = require('crypto')
  const prodGuidesPath = path.join(REPO, 'data/public-port-guides.json')
  const prodGuidesSha = crypto.createHash('sha256').update(fs.readFileSync(prodGuidesPath)).digest('hex')
  fs.writeFileSync(
    path.join(OUT, 'PUBLICATION_AUTHORIZATION_BOUNDARY.json'),
    `${JSON.stringify(
      {
        verified_at_utc: new Date().toISOString(),
        production_data_modified_on_branch: false,
        production_public_port_guides_sha256: prodGuidesSha,
        live_passenger_editorial_baseline: 319,
        owner_publication_authorized: false,
        production_apply_permitted: false,
        stage71_apply_script: 'scripts/stage71-apply-bootstrap-25.js',
        fail_closed_without_owner_auth: true,
        stage68_apply_uses_separate_manifest: true,
      },
      null,
      2
    )}\n`,
    'utf8'
  )

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

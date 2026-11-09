#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { countPassengerEditorialGuides, removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage78-five-port-prep')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage78-publication-5')
const PREP_MANIFEST = path.join(PREP, 'STAGE78_PREP_MANIFEST.json')
const RECOVERY = path.join(PREP, 'RECOVERY_RESULTS.json')
const BASELINE_MAIN = '79bad4262963a7299304a406c4b0dd755c80ec48'
const RESEARCH_MAIN = 'e5680f19d3ea86ce2261c3027894f2a45124e36b'
const LOCKED_SLUGS = [
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
]

function fail(code, message) {
  console.error(JSON.stringify({ error: code, message }, null, 2))
  process.exit(42)
}

function main() {
  let mainHead = ''
  try {
    mainHead = execSync('git rev-parse origin/main', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    fail('STAGE78_PREP_STOP', 'cannot resolve origin/main')
  }
  if (mainHead !== BASELINE_MAIN) {
    fail('STAGE78_PREP_STOP', `expected production main ${BASELINE_MAIN} (got ${mainHead})`)
  }

  const prepManifest = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  const EXPECTED_BUNDLE = prepManifest.bundle_idempotency_hash
  if (!EXPECTED_BUNDLE) fail('STAGE78_PREP_STOP', 'missing bundle_idempotency_hash on prep manifest')
  if (prepManifest.owner_publication_authorized === true || prepManifest.production_apply_permitted === true) {
    fail('STAGE78_PREP_STOP', 'authorization flags must remain false on prep manifest')
  }
  if ((prepManifest.slugs_approved || []).length > 0) {
    fail('STAGE78_PREP_STOP', 'slugs_approved must remain empty')
  }

  const recovery = JSON.parse(fs.readFileSync(RECOVERY, 'utf8'))
  const recoveryBySlug = new Map((recovery.ports || []).map((p) => [p.landing_slug, p]))
  const ready = (prepManifest.slugs_technical_eligible || []).slice().sort()
  if (ready.length !== 5) fail('STAGE78_PREP_STOP', `expected 5 technical eligible, got ${ready.length}`)
  for (const slug of LOCKED_SLUGS) {
    if (!ready.includes(slug)) fail('STAGE78_PREP_STOP', `locked slug missing from prep: ${slug}`)
  }

  const patchPath = path.join(PREP, 'COMPOSITE_SHA_PATCH.json')
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'))
  if (patch.verified_research_commit !== RESEARCH_MAIN) {
    fail('STAGE78_PREP_STOP', `research pin ${patch.verified_research_commit} !== ${RESEARCH_MAIN}`)
  }

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const liveCount = countPassengerEditorialGuides(guides)
  if (liveCount !== 350) {
    fail('STAGE78_PREP_STOP', `live passenger editorial baseline ${liveCount} !== 350`)
  }

  const portsBySlug = new Map((prepManifest.ports || []).map((p) => [p.landing_slug, p]))
  const factualSignoff = []
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({
    landingRepoRoot: REPO,
    patchPath,
  })
  try {
    for (const slug of LOCKED_SLUGS) {
      const row = portsBySlug.get(slug)
      if (!row) fail('STAGE78_PREP_STOP', `missing prep row: ${slug}`)
      if (!row.technical_apply_eligible || !row.publication_gates_pass) {
        fail('STAGE78_PREP_STOP', `prep gates not pass: ${slug}`)
      }
      if (row.production_apply_allowed === true) {
        fail('STAGE78_PREP_STOP', `production_apply_allowed must be false: ${slug}`)
      }
      const rec = recoveryBySlug.get(slug)
      if (!rec?.publication_gates_pass) fail('STAGE78_PREP_STOP', `recovery gates not pass: ${slug}`)
      const proposedPath = path.join(REPO, row.proposed_guide_ref)
      if (!fs.existsSync(proposedPath)) fail('STAGE78_PREP_STOP', `missing proposed guide: ${slug}`)
      const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
      const factual = reviewConsequentialClaims({
        guide: proposed,
        landingSlug: slug,
        researchRoot: compositeRoot,
        fieldExclusions: row.field_exclusions || [],
      })
      factualSignoff.push({
        landing_slug: slug,
        ok: !factual.exclude_from_release,
        exclude_reason: factual.exclude_reason || null,
        flags: factual.flags || [],
      })
      if (factual.exclude_from_release) {
        fail('STAGE78_PREP_STOP', `factual sign-off blocked: ${slug} (${factual.exclude_reason})`)
      }
    }
  } finally {
    cleanup()
  }

  const prepPortsSha = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json')))
    .digest('hex')

  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  const candidateManifest = {
    schema_version: 1,
    stage: 'stage78-publication-candidate',
    status: 'READY_FOR_OWNER_REVIEW',
    candidate_only: true,
    owner_publication_authorized: false,
    production_apply_permitted: false,
    publication_candidate_apply_permitted: true,
    slugs_approved: [],
    slugs_publication_candidate: LOCKED_SLUGS.slice().sort(),
    preparation_bundle_hash: EXPECTED_BUNDLE,
    preparation_pr_head: head,
    research_main_pin: RESEARCH_MAIN,
    baseline_main: BASELINE_MAIN,
    baseline_live_passenger_editorial: 350,
    projected_passenger_editorial_if_merged: 355,
    production_public_port_guides_sha256_at_prep: prepPortsSha,
    factual_signoff: factualSignoff,
    created_at_utc: new Date().toISOString(),
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE78_PUBLICATION_MANIFEST.json'),
    `${JSON.stringify(candidateManifest, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify({ ok: true, slug_count: LOCKED_SLUGS.length, bundle: EXPECTED_BUNDLE }, null, 2))
}

main()

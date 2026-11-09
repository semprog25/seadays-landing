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
const PREP = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage76-publication-6')
const PREP_MANIFEST = path.join(PREP, 'STAGE71_MANIFEST.json')
const RECOVERY = path.join(PREP, 'RECOVERY_RESULTS.json')
const EXPECTED_BUNDLE = '87483ccb0c21b1d92b6aa119231369b7e5309ec6ba5e020424f33478a2f8233c'
const BASELINE_MAIN = '59653e6203ab66623a7f53e5572395b401ec140b'
const RESEARCH_MAIN = 'e5680f19d3ea86ce2261c3027894f2a45124e36b'
const LOCKED_SLUGS = [
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
]

function fail(code, message) {
  console.error(JSON.stringify({ error: code, message }, null, 2))
  process.exit(42)
}

function main() {
  let mainHead = ''
  try {
    mainHead = execSync('git merge-base HEAD origin/main', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    fail('STAGE76_PREP_STOP', 'cannot resolve origin/main merge-base')
  }
  if (mainHead !== BASELINE_MAIN) {
    fail('STAGE76_PREP_STOP', `branch not based on main ${BASELINE_MAIN} (merge-base ${mainHead})`)
  }

  const prepManifest = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  if (prepManifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) {
    fail('STAGE76_PREP_STOP', 'preparation bundle hash mismatch')
  }
  if (prepManifest.owner_publication_authorized === true || prepManifest.production_apply_permitted === true) {
    fail('STAGE76_PREP_STOP', 'authorization flags must remain false on prep manifest')
  }
  if ((prepManifest.slugs_approved || []).length > 0) {
    fail('STAGE76_PREP_STOP', 'slugs_approved must remain empty')
  }

  const recovery = JSON.parse(fs.readFileSync(RECOVERY, 'utf8'))
  const recoveryBySlug = new Map((recovery.ports || []).map((p) => [p.landing_slug, p]))
  const ready = (prepManifest.slugs_technical_eligible || []).slice().sort()
  if (ready.length !== 6) fail('STAGE76_PREP_STOP', `expected 6 technical eligible, got ${ready.length}`)
  for (const slug of LOCKED_SLUGS) {
    if (!ready.includes(slug)) fail('STAGE76_PREP_STOP', `locked slug missing from prep: ${slug}`)
  }

  const patchPath = path.join(PREP, 'COMPOSITE_SHA_PATCH.json')
  const patch = JSON.parse(fs.readFileSync(patchPath, 'utf8'))
  if (patch.verified_research_commit !== RESEARCH_MAIN) {
    fail('STAGE76_PREP_STOP', `research pin ${patch.verified_research_commit} !== merged main ${RESEARCH_MAIN}`)
  }

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const liveCount = countPassengerEditorialGuides(guides)
  if (liveCount !== 344) {
    fail('STAGE76_PREP_STOP', `live passenger editorial baseline ${liveCount} !== 344`)
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
      if (!row) fail('STAGE76_PREP_STOP', `missing prep row: ${slug}`)
      if (!row.technical_apply_eligible || !row.publication_gates_pass) {
        fail('STAGE76_PREP_STOP', `prep gates not pass: ${slug}`)
      }
      if (row.production_apply_allowed === true) {
        fail('STAGE76_PREP_STOP', `production_apply_allowed must be false: ${slug}`)
      }
      const rec = recoveryBySlug.get(slug)
      if (!rec?.publication_gates_pass) fail('STAGE76_PREP_STOP', `recovery gates not pass: ${slug}`)
      const proposedPath = path.join(REPO, row.proposed_guide_ref)
      if (!fs.existsSync(proposedPath)) fail('STAGE76_PREP_STOP', `missing proposed guide: ${slug}`)
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
        fail('STAGE76_PREP_STOP', `factual sign-off blocked: ${slug} (${factual.exclude_reason})`)
      }
    }
  } finally {
    cleanup()
  }

  const prepPortsSha = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json')))
    .digest('hex')

  const candidateManifest = {
    schema_version: 1,
    stage: 'stage76-publication-candidate',
    status: 'READY_FOR_OWNER_REVIEW',
    candidate_only: true,
    owner_publication_authorized: false,
    production_apply_permitted: false,
    publication_candidate_apply_permitted: true,
    slugs_approved: [],
    slugs_publication_candidate: LOCKED_SLUGS.slice().sort(),
    preparation_bundle_hash: EXPECTED_BUNDLE,
    preparation_pr: 'https://github.com/semprog25/seadays-landing/pull/102',
    preparation_pr_head: '69e60d30ab1ae455e6ae59efc72d235b6f33a7c5',
    research_main_pin: RESEARCH_MAIN,
    baseline_main: BASELINE_MAIN,
    baseline_live_passenger_editorial: 344,
    projected_passenger_editorial_if_merged: 350,
    production_public_port_guides_sha256_at_prep: prepPortsSha,
    factual_signoff: factualSignoff,
    created_at_utc: new Date().toISOString(),
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE76_PUBLICATION_MANIFEST.json'),
    `${JSON.stringify(candidateManifest, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify({ ok: true, slug_count: LOCKED_SLUGS.length, slugs: LOCKED_SLUGS }, null, 2))
}

main()

#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { countPassengerEditorialGuides, removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage73-publication-25')
const PREP_MANIFEST = path.join(PREP, 'STAGE71_MANIFEST.json')
const SIGNOFF = path.join(PREP, 'PUBLICATION_SIGNOFF_REPORT.json')
const EXPECTED_BUNDLE = '0e115b7f34302350026a532e8c8f9add4bb9965e77584894181059f80f0f0f8b'
const EXPECTED_PREP_HEAD = 'f5dde5afa91aa3f5564389148389224c51eb31cd'
const BASELINE_MAIN = '989c709f82ab8642ff285468998e41d8895a6a8c'

function fail(code, message) {
  console.error(JSON.stringify({ error: code, message }, null, 2))
  process.exit(42)
}

function main() {
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  if (head !== EXPECTED_PREP_HEAD) {
    fail('STAGE73_PREP_STOP', `HEAD ${head} !== expected prep PR #99 head ${EXPECTED_PREP_HEAD}`)
  }
  let mainHead = ''
  try {
    mainHead = execSync('git rev-parse origin/main', { cwd: REPO, encoding: 'utf8' }).trim()
  } catch {
    fail('STAGE73_PREP_STOP', 'cannot resolve origin/main')
  }
  if (mainHead !== BASELINE_MAIN) {
    fail('STAGE73_PREP_STOP', `origin/main ${mainHead} !== expected baseline ${BASELINE_MAIN}`)
  }

  const prepManifest = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  if (prepManifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) {
    fail('STAGE73_PREP_STOP', 'preparation bundle hash mismatch')
  }
  if (prepManifest.owner_publication_authorized === true) {
    fail('STAGE73_PREP_STOP', 'owner_publication_authorized must remain false on prep manifest')
  }
  if ((prepManifest.slugs_approved || []).length > 0) {
    fail('STAGE73_PREP_STOP', 'slugs_approved must remain empty on STAGE71_MANIFEST')
  }

  const signoff = JSON.parse(fs.readFileSync(SIGNOFF, 'utf8'))
  if (signoff.preparation_bundle_hash !== EXPECTED_BUNDLE) {
    fail('STAGE73_PREP_STOP', 'signoff report bundle hash mismatch')
  }
  const ready = (signoff.buckets?.PUBLICATION_READY || []).slice().sort()
  if (ready.length !== 25) fail('STAGE73_PREP_STOP', `expected 25 PUBLICATION_READY, got ${ready.length}`)
  if (signoff.publication_signoff_counts?.PUBLICATION_READY !== 25) {
    fail('STAGE73_PREP_STOP', 'signoff counts mismatch')
  }

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const liveCount = countPassengerEditorialGuides(guides)
  if (liveCount !== 319) {
    fail('STAGE73_PREP_STOP', `live passenger editorial baseline ${liveCount} !== 319`)
  }

  const portsBySlug = new Map((prepManifest.ports || []).map((p) => [p.landing_slug, p]))
  for (const slug of ready) {
    const row = portsBySlug.get(slug)
    if (!row) fail('STAGE73_PREP_STOP', `missing prep row: ${slug}`)
    if (!row.technical_apply_eligible || !row.publication_gates_pass) {
      fail('STAGE73_PREP_STOP', `prep gates not pass: ${slug}`)
    }
    if (row.production_apply_allowed === true) {
      fail('STAGE73_PREP_STOP', `production_apply_allowed must be false: ${slug}`)
    }
    if (row.publication_signoff_verdict !== 'PUBLICATION_READY') {
      fail('STAGE73_PREP_STOP', `signoff verdict not ready on manifest row: ${slug}`)
    }
  }

  const prepPortsSha = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json')))
    .digest('hex')

  const candidateManifest = {
    schema_version: 1,
    stage: 'stage73-publication-candidate',
    status: 'READY_FOR_OWNER_REVIEW',
    candidate_only: true,
    owner_publication_authorized: false,
    production_apply_permitted: false,
    publication_candidate_apply_permitted: true,
    slugs_approved: [],
    slugs_publication_candidate: ready,
    preparation_bundle_hash: EXPECTED_BUNDLE,
    preparation_pr: 'https://github.com/semprog25/seadays-landing/pull/99',
    preparation_pr_head: EXPECTED_PREP_HEAD,
    baseline_main: BASELINE_MAIN,
    baseline_live_passenger_editorial: 319,
    projected_passenger_editorial_if_merged: 344,
    production_public_port_guides_sha256_at_prep: prepPortsSha,
    created_at_utc: new Date().toISOString(),
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.writeFileSync(
    path.join(EVIDENCE, 'STAGE73_PUBLICATION_MANIFEST.json'),
    `${JSON.stringify(candidateManifest, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify({ ok: true, slug_count: ready.length, slugs: ready }, null, 2))
}

main()

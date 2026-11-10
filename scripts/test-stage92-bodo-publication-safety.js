#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  STAGE43_HARD_EXCLUDE,
  STAGE60_OWNER_POLICY_EXCEPTION_SLUGS,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const {
  assertHistoricalPolicyPublicationGate,
  BODO_SLUG,
  countPassengerEditorialCallPlans,
} = require('./lib/bulkPortPublication/historicalPolicyPublicationGate')

const REPO = path.join(__dirname, '..')
const CANDIDATE_HTML = path.join(
  REPO,
  'qa-evidence/stage89-bodo-candidate/candidate-applied/ports/bod-norway/index.html'
)
const CANDIDATE_GUIDE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate/candidate-applied/byAppPortId.bodo.json')
const STUB_HTML = path.join(REPO, 'ports/bod-norway/index.html')

function main() {
  delete process.env.SEADAYS_STAGE89_BODO_CANDIDATE

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  assert.strictEqual(pe, 356, `production tree PE must be 356, got ${pe}`)

  const bodo = guides.byAppPortId?.bodo
  assert.ok(bodo, 'bodo slot')
  assert.ok(!usesPassengerEditorialLead(bodo), 'bodo must not be passenger_editorial in merge tree')

  assert.ok(STAGE43_HARD_EXCLUDE_HISTORICAL.has(BODO_SLUG), 'historical ledger')
  assert.ok(
    !STAGE60_OWNER_POLICY_EXCEPTION_SLUGS.has(BODO_SLUG),
    'bod must not use trieste-style exception'
  )
  if (process.env.SEADAYS_STAGE89_BODO_CANDIDATE === '1') {
    assert.ok(!STAGE43_HARD_EXCLUDE.has(BODO_SLUG), 'env lifts active exclude only for local tooling')
  } else {
    assert.ok(STAGE43_HARD_EXCLUDE.has(BODO_SLUG), 'active exclude without env')
  }

  assert.ok(fs.existsSync(CANDIDATE_HTML), 'candidate html preserved')
  assert.ok(fs.existsSync(CANDIDATE_GUIDE), 'candidate guide preserved')
  const candidateGuide = JSON.parse(fs.readFileSync(CANDIDATE_GUIDE, 'utf8'))
  assert.strictEqual(candidateGuide.researchImport?.publication_tier, 'passenger_editorial')
  assert.strictEqual(candidateGuide.researchImport?.owner_publication_authorized, false)
  assert.ok(countPassengerEditorialCallPlans(fs.readFileSync(CANDIDATE_HTML, 'utf8')) >= 3, 'candidate has call plans')

  const stub = fs.readFileSync(STUB_HTML, 'utf8')
  assert.ok(/noindex/i.test(stub), 'stub robots noindex')
  assert.ok(stub.includes('https://seadays.app/ports/bod-norway/'), 'canonical preserved')
  assert.ok(countPassengerEditorialCallPlans(stub) < 3, 'production html must remain stub without 3 call plans')

  assertHistoricalPolicyPublicationGate(REPO, guides)

  const hamburgBefore = JSON.stringify(guides.byAppPortId.hamburg?.researchImport)
  assert.ok(hamburgBefore.includes('passenger_editorial'), 'hamburg unchanged pe tier')

  const violationFixture = JSON.parse(JSON.stringify(guides))
  violationFixture.byAppPortId.bodo = JSON.parse(fs.readFileSync(CANDIDATE_GUIDE, 'utf8'))
  assert.throws(
    () => assertHistoricalPolicyPublicationGate(REPO, violationFixture),
    /historical policy publication gate/
  )

  const ciRunner = fs.readFileSync(path.join(REPO, 'scripts/ci-run-channel.sh'), 'utf8')
  assert.ok(ciRunner.includes('node scripts/apply-publish-gate.js'), 'ci-run-channel runs apply-publish-gate')
  const applyPublishGate = fs.readFileSync(path.join(REPO, 'scripts/apply-publish-gate.js'), 'utf8')
  assert.ok(
    applyPublishGate.includes('assertHistoricalPolicyPublicationGate'),
    'apply-publish-gate enforces historical policy gate before sitemap/artifact commit'
  )

  console.log('test-stage92-bodo-publication-safety PASS', { pe, candidate_call_plans: '>=3' })
}

main()

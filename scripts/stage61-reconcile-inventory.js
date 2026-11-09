#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')
const {
  STAGE43_HARD_EXCLUDE,
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  STAGE60_OWNER_POLICY_EXCEPTION_SLUGS,
  buildPublishedSlugSet,
  exclusionReasonForSlug,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence', 'bulk-50-port-release')
const BASELINE = '9ea50c967a26a705fbbf93ab196b39f8b7835cbe'
const RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

function main() {
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
  let passengerCount = 0
  for (const g of Object.values(guides.byAppPortId || {})) {
    if (usesPassengerEditorialLead(g)) passengerCount += 1
  }
  const publishedSlugs = buildPublishedSlugSet(REPO)
  const triestePublished = publishedSlugs.has('trieste-italy')
  const policyAssert = {
    trieste_in_historical_ledger: STAGE43_HARD_EXCLUDE_HISTORICAL.has('trieste-italy'),
    trieste_not_in_active_exclude: !STAGE43_HARD_EXCLUDE.has('trieste-italy'),
    ravenna_still_hard_exclude: exclusionReasonForSlug('ravenna-italy', publishedSlugs) === 'stage43_hard_exclude',
    eilat_still_hard_exclude: exclusionReasonForSlug('eilat-israel', publishedSlugs) === 'stage43_hard_exclude',
    stage60_exceptions_only_trieste: [...STAGE60_OWNER_POLICY_EXCEPTION_SLUGS].join(',') === 'trieste-italy',
    trieste_published_on_baseline: triestePublished,
  }
  let eligibility = null
  try {
    eligibility = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: RESEARCH })
  } catch (e) {
    eligibility = { error: String(e.message) }
  }
  const rescorePath = path.join(REPO, 'STAGE45_50_PORT_RESCORE.json')
  const rescore = fs.existsSync(rescorePath) ? JSON.parse(fs.readFileSync(rescorePath, 'utf8')) : null
  const readyUnpublished = (rescore?.ports || []).filter((p) => {
    if (p.owner_bucket !== 'READY_FOR_OWNER_APPROVAL' || !p.publication_gates_pass) return false
    if (publishedSlugs.has(p.landing_slug)) return false
  })
  const exclusionPath = (rescore?.ports || []).filter((p) => {
    if (p.owner_bucket !== 'NEEDS_FACT_CHECK' || !p.publication_gates_pass) return false
    if (!(p.field_exclusions || []).includes('portInfo.description')) return false
    if (publishedSlugs.has(p.landing_slug)) return false
    const ex = exclusionReasonForSlug(p.landing_slug, publishedSlugs)
    return !ex
  })
  const summary = {
    generated_at_utc: new Date().toISOString(),
    production_baseline_sha: BASELINE,
    worktree_head_sha: head,
    research_ports_total: 406,
    passenger_editorial_published: passengerCount,
    remaining_unpublished_research: 406 - passengerCount,
    stage45_ready_unpublished: readyUnpublished.length,
    stage45_exclusion_path_unpublished: exclusionPath.length,
    exclusion_path_slugs: exclusionPath.map((p) => p.landing_slug).sort(),
    policy_assertions: policyAssert,
    eligibility_summary: eligibility?.summary || eligibility,
  }
  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'INVENTORY_RECONCILE.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(summary, null, 2))
}

main()

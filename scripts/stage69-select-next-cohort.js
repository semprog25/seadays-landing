#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')
const { STAGE43_HARD_EXCLUDE } = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const {
  STAGE69_OWNER_HOLD,
  FALMOUTH_JAMAICA_LANDING_SLUG,
} = require('./lib/bulkPortPublication/stage69IdentityGate')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { selectNeedsReviewRecoveryPool } = require('./lib/bulkPortPublication/targetedNeedsReviewRecovery')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage69-remaining-87')
const INVENTORY = path.join(OUT, 'REMAINING_87_INVENTORY.json')
const COHORT_LIMIT = Number(process.env.STAGE69_COHORT_LIMIT || 25)

function buildLivePassengerSlugSet(repoRoot) {
  const guides = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/public-port-guides.json'), 'utf8'))
  const slugs = new Set()
  for (const g of Object.values(guides.byAppPortId || {})) {
    if (!usesPassengerEditorialLead(g)) continue
    const slug = g.researchImport?.landing_slug
    if (slug) slugs.add(slug)
  }
  return slugs
}

function main() {
  if (!fs.existsSync(INVENTORY)) throw new Error('run stage69-reconcile-remaining-87.js first')
  const inventory = JSON.parse(fs.readFileSync(INVENTORY, 'utf8'))
  const categoryA = inventory.filter((r) => r.category === 'A')
  if (!process.env.SEADAYS_APP_ROOT) {
    process.env.SEADAYS_APP_ROOT = path.resolve(REPO, '..', '..', '..', 'Seadays-trust-boundary')
  }

  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO })
  try {
    const livePassengerSlugs = buildLivePassengerSlugSet(REPO)
    const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const manifestBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))

    const categoryASlugs = new Set(categoryA.map((r) => r.landing_slug))
    const excludeSlugs = new Set([...STAGE69_OWNER_HOLD, FALMOUTH_JAMAICA_LANDING_SLUG, ...STAGE43_HARD_EXCLUDE])
    const allowPilotPromotion = process.env.STAGE69_ALLOW_PILOT_PROMOTION === '1'
    const nrPool = report.ports.filter((p) => {
      if (!categoryASlugs.has(p.landing_slug) || livePassengerSlugs.has(p.landing_slug)) return false
      if (p.policy_dry_run?.ok !== true) return false
      if (p.publication_bucket === 'NEEDS_REVIEW') return true
      if (p.publication_bucket === 'PASS' && allowPilotPromotion) return true
      return false
    })
    const pilotHeld = inventory.filter(
      (r) => r.category === 'A' && r.publication_bucket === 'PASS' && !allowPilotPromotion
    )
    const { picked, skipped, eligible_count } = selectNeedsReviewRecoveryPool({
      eligibilityPorts: nrPool,
      publishedSlugs: livePassengerSlugs,
      excludeSlugs,
      limit: COHORT_LIMIT,
    })

    const selected = picked.map((row) => {
      const m = manifestBySlug.get(row.landing_slug)
      return {
        landing_slug: row.landing_slug,
        app_port_id: row.app_port_id,
        name: m?.name || row.name,
        country: m?.country || row.country,
        research_sha256: patchMeta.sha_patch?.[row.landing_slug] || m?.sha256,
        thin_score: row.thin_score,
        research_status: m?.research_status,
        resolution_method: m?.resolution_method,
        publication_bucket: row.publication_bucket,
        qa_verdict: row.qa_verdict,
        identifier_status: row.identifier_status,
        identifier_confidence: 'verified',
        research_sha_verified: row.research_sha_verified,
        recovery_mode: 'stage69-needs-review-editorial',
      }
    })

    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), `${JSON.stringify(selected, null, 2)}\n`, 'utf8')
    fs.writeFileSync(
      path.join(OUT, 'IDENTITY_REPORT.json'),
      `${JSON.stringify(
        {
          generated_at_utc: new Date().toISOString(),
          verified_research_commit: patchMeta.verified_research_commit,
          category_a_eligible: categoryA.length,
          needs_review_pool: nrPool.length,
          recovery_eligible: eligible_count,
          selected: selected.length,
          skipped,
          pilot_promotion_held: pilotHeld,
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    fs.writeFileSync(
      path.join(OUT, 'COHORT_MANIFEST.json'),
      `${JSON.stringify(
        {
          generated_at_utc: new Date().toISOString(),
          net_new_cohort_policy: 'NEEDS_REVIEW or bootstrap only; PASS-bucket pilots excluded unless STAGE69_ALLOW_PILOT_PROMOTION=1',
          selected_count: selected.length,
          selected_slugs: selected.map((p) => p.landing_slug),
          pilot_held_from_cohort: pilotHeld.map((r) => ({
            landing_slug: r.landing_slug,
            reason: 'pilot_pass_bucket_not_net_new',
          })),
        },
        null,
        2
      )}\n`,
      'utf8'
    )

    const summary = {
      category_a: categoryA.length,
      needs_review_pool: nrPool.length,
      selected: selected.length,
      limit: COHORT_LIMIT,
      selected_slugs: selected.map((p) => p.landing_slug),
      pilot_held: pilotHeld.map((r) => r.landing_slug),
    }
    console.log(JSON.stringify(summary, null, 2))
    if (selected.length === 0) process.exit(45)
  } finally {
    cleanup()
  }
}

main()

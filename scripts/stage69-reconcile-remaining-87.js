#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { analyzeBlockedCohort } = require('./lib/bulkPortPublication/stage65UnpublishedCohort')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const {
  STAGE69_OWNER_HOLD,
  FALMOUTH_JAMAICA_LANDING_SLUG,
  identityBlockReason,
  buildPublishedSlugSet,
} = require('./lib/bulkPortPublication/stage69IdentityGate')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage69-remaining-87')
const VERIFIED_MAIN_SHA = '26b35d693f78e3f7db101b7ad333cec2b8259f4f'

function buildLivePassengerSlugSet(repoRoot) {
  const guides = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data/public-port-guides.json'), 'utf8'))
  const slugs = new Set()
  let guideCount = 0
  for (const g of Object.values(guides.byAppPortId || {})) {
    if (!usesPassengerEditorialLead(g)) continue
    guideCount += 1
    const slug = g.researchImport?.landing_slug
    if (slug) slugs.add(slug)
  }
  return { slugs, guideCount }
}

function mapBlockerToCategory(blocker, { elig, identityBlock, collisionSlugs, hasByPortMd, prepCandidate }) {
  if (
    blocker === 'owner_factual_hold' ||
    blocker === 'historical_policy_hold' ||
    blocker === 'falmouth_homonym_excluded' ||
    blocker === 'stage43_hard_exclude' ||
    blocker === 'historical_ledger_not_live_passenger_editorial'
  ) {
    return 'E'
  }
  if (
    blocker === 'app_port_id_occupied_by_passenger_editorial' ||
    blocker === 'multi_slug_peer_already_published' ||
    blocker === 'duplicate_app_port_id_within_cohort' ||
    collisionSlugs.has(elig?.landing_slug)
  ) {
    return 'F'
  }
  if (
    blocker === 'identifier_unresolved' ||
    blocker === 'missing_app_port_id' ||
    identityBlock === 'identifier_unresolved' ||
    identityBlock === 'missing_app_port_id' ||
    identityBlock === 'cross_country_slot_conflict'
  ) {
    return 'D'
  }
  if (
    !hasByPortMd ||
    elig?.qa_verdict === 'BLOCKED' ||
    blocker === 'research_qa_not_pass' ||
    blocker === 'research_sha_mismatch'
  ) {
    return 'C'
  }
  if (prepCandidate && identityBlock === null) {
    return 'A'
  }
  return 'B'
}

function main() {
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  const { slugs: livePassengerSlugs, guideCount } = buildLivePassengerSlugSet(REPO)
  const publishedSet = buildPublishedSlugSet(REPO)
  const ledgerOnlyLive = [...publishedSet].filter((s) => livePassengerSlugs.has(s) === false)

  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO })
  try {
    const manifestPayload = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const analysis = analyzeBlockedCohort({
      manifestPorts: manifestPayload.ports,
      eligibilityPorts: report.ports,
      researchRoot: compositeRoot,
      landingRepoRoot: REPO,
    })
    const bootstrapBySlug = new Map(analysis.bootstrap_pool.map((p) => [p.landing_slug, p]))
    const eligBySlug = new Map(report.ports.map((p) => [p.landing_slug, p]))
    const manifestBySlug = new Map(manifestPayload.ports.map((p) => [p.landing_slug, p]))

    const collisionSlugs = new Set()
    const collisionPayload = manifestPayload.collisions || report.collisions || {}
    for (const entry of collisionPayload.multi_slug_app_port_ids || []) {
      for (const s of entry.landing_slugs || []) collisionSlugs.add(s)
    }
    for (const row of collisionPayload.ambiguous_inferred || []) {
      if (row.landing_slug) collisionSlugs.add(row.landing_slug)
      for (const s of row.multi_slug_app_port_id_peers || []) collisionSlugs.add(s)
    }

    const ownerUniverse = manifestPayload.ports.map((p) => p.landing_slug).sort()
    const unpublished = ownerUniverse.filter((s) => !livePassengerSlugs.has(s))
    if (unpublished.length !== 87) {
      throw new Error(`expected 87 unpublished slugs, got ${unpublished.length}`)
    }

    const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
    const cohortAppIds = new Map()
    for (const slug of unpublished) {
      const row = manifestBySlug.get(slug)
      if (!row?.app_port_id) continue
      if (!cohortAppIds.has(row.app_port_id)) cohortAppIds.set(row.app_port_id, [])
      cohortAppIds.get(row.app_port_id).push(slug)
    }

    const inventory = []
    const categoryCounts = { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0 }

    for (const slug of unpublished) {
      const row = manifestBySlug.get(slug) || { landing_slug: slug }
      const elig = eligBySlug.get(slug)
      const bootstrap = bootstrapBySlug.get(slug)
      const mdPath = path.join(compositeRoot, 'by-port', `${slug}.md`)
      const hasByPortMd = fs.existsSync(mdPath)
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug: slug,
        manifestRow: row,
      })
      const idBlock = identityBlockReason(row, {
        publishedSet,
        livePassengerSlugs,
        guides,
        cohortAppIds,
      })
      const prepCandidate = Boolean(
        !idBlock &&
          sha.ok &&
          row.qa_verdict === 'PASS' &&
          row.identifier_status === 'resolved' &&
          (bootstrap?.policy_ok ||
            (row.has_public_port_guide &&
              elig?.policy_dry_run?.ok === true &&
              (elig?.publication_bucket === 'NEEDS_REVIEW' || elig?.publication_bucket === 'PASS')))
      )

      let blocker = idBlock
      if (!blocker && !sha.ok) blocker = 'research_sha_mismatch'
      if (
        !blocker &&
        !prepCandidate &&
        elig?.publication_bucket === 'NEEDS_REVIEW' &&
        row.has_public_port_guide
      ) {
        blocker =
          elig?.policy_dry_run?.ok === false
            ? 'policy_yaml_or_terminal_gate_repair'
            : 'needs_review_editorial_recovery'
      }
      if (!blocker && !prepCandidate && bootstrap && !bootstrap.policy_ok) blocker = 'policy_not_ok'
      if (!blocker && elig?.publication_bucket === 'PASS' && row.has_public_port_guide && !prepCandidate) {
        blocker = 'existing_guide_not_passenger_editorial'
      }

      const category = mapBlockerToCategory(blocker, {
        elig,
        identityBlock: idBlock,
        collisionSlugs,
        hasByPortMd,
        prepCandidate,
      })
      categoryCounts[category] += 1

      const evidence = [
        `qa_verdict:${row.qa_verdict || 'unknown'}`,
        `identifier_status:${row.identifier_status || 'unknown'}`,
        `research_sha_verified:${sha.ok}`,
        `by_port_md:${hasByPortMd}`,
        `publication_bucket:${elig?.publication_bucket || 'unknown'}`,
      ]
      if (blocker) evidence.push(`blocker:${blocker}`)
      if (bootstrap) evidence.push(`bootstrap_score:${bootstrap.score}`)

      inventory.push({
        landing_slug: slug,
        app_port_id: row.app_port_id || null,
        country: row.country || null,
        category,
        blocker: blocker || null,
        evidence,
        qa_verdict: row.qa_verdict,
        identifier_status: row.identifier_status,
        research_sha_verified: sha.ok,
        bootstrap_policy_ok: Boolean(bootstrap?.policy_ok),
        preparation_candidate: prepCandidate,
        publication_bucket: elig?.publication_bucket,
        has_public_port_guide: Boolean(row.has_public_port_guide),
        multi_slug_peers: row.multi_slug_app_port_id_peers || [],
      })
    }

    fs.mkdirSync(OUT, { recursive: true })
    const summary = {
      generated_at_utc: new Date().toISOString(),
      verified_main_sha: VERIFIED_MAIN_SHA,
      worktree_head_sha: head,
      verified_research_commit: patchMeta.verified_research_commit,
      owner_universe_count: ownerUniverse.length,
      live_passenger_editorial_guide_count: guideCount,
      live_passenger_editorial_slug_count: livePassengerSlugs.size,
      historical_published_slug_set_size: publishedSet.size,
      ledger_not_live_passenger_editorial: ledgerOnlyLive,
      ledger_discrepancy_note:
        'Do not use slug-ledger membership alone as proof of passenger publication; live JSON publication_tier + usesPassengerEditorialLead is authoritative.',
      remaining_unpublished_count: unpublished.length,
      category_counts: categoryCounts,
      owner_hold_slugs: [...STAGE69_OWNER_HOLD, FALMOUTH_JAMAICA_LANDING_SLUG],
      projected_after_full_category_a_merge: `${guideCount}+N (max ${guideCount + categoryCounts.A}/406)`,
    }

    fs.writeFileSync(path.join(OUT, 'REMAINING_87_INVENTORY.json'), `${JSON.stringify(inventory, null, 2)}\n`, 'utf8')
    fs.writeFileSync(path.join(OUT, 'RECONCILE_SUMMARY.json'), `${JSON.stringify(summary, null, 2)}\n`, 'utf8')
    fs.writeFileSync(
      path.join(OUT, 'UNPUBLISHED_SLUGS.json'),
      `${JSON.stringify(unpublished, null, 2)}\n`,
      'utf8'
    )

    console.log(JSON.stringify(summary, null, 2))
  } finally {
    cleanup()
  }
}

main()

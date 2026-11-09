#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { buildBulkEligibilityReport, DEFAULT_RESEARCH } = require('./lib/bulkPortPublication/eligibility')
const { selectStage28Cohort } = require('./lib/bulkPortPublication/selectStage28Cohort')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { loadFactPack } = require('./lib/bulkPortPublication/researchFactPack')
const { synthesizePassengerDraft } = require('./lib/bulkPortPublication/passengerDraftSynthesize')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { classifyDraftRisk } = require('./lib/bulkPortPublication/riskClassifyDraft')
const { cacheKey, readCachedDraft, writeCachedDraft } = require('./lib/bulkPortPublication/draftCache')
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema')
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { sanitizePassengerDraftSurfaces } = require('./lib/bulkPortPublication/sanitizePassengerDraftSurfaces')
const {
  buildPublishedSlugSet,
  exclusionReasonForSlug,
  STAGE43_HARD_EXCLUDE,
} = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')

const REPO = path.join(__dirname, '..')
const BASELINE_GUIDES = path.join(
  REPO,
  'qa-evidence/bulk-50-port-release/rollback-pre-apply/public-port-guides.json'
)
const OUT = path.join(REPO, 'qa-evidence/bulk-50-needs-review-recovery')
const CACHE = path.join(OUT, 'draft-cache')
const PILOT_DRAFTS = path.join(OUT, 'pilot-drafts')
const PILOT_LIMIT = Number(process.env.NEEDS_REVIEW_PILOT_LIMIT || 30)
const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH

function classifyRootCause(row) {
  const causes = []
  if (STAGE43_HARD_EXCLUDE.has(row.landing_slug)) causes.push('historical_policy_exclusion')
  if (row.qa_verdict !== 'PASS') causes.push('research_qa_blocked')
  if (row.identifier_status !== 'resolved') causes.push('canonical_identity_unresolved')
  if (!row.research_sha_verified) causes.push('research_sha_mismatch')
  const hard = (row.import_blockers || []).filter(
    (b) => !['identifier_inferred', 'research_status_needs_review'].includes(b)
  )
  if (hard.length) causes.push('hard_import_blocker')
  const diag = row.editorial_readiness?.research_diagnostics?.issues || []
  if (diag.some((i) => i.includes('markdown'))) causes.push('draft_sanitizer_markdown_leak')
  if (diag.some((i) => i.includes('research_leak'))) causes.push('editorial_research_leak')
  if (!row.editorial_readiness?.live_passenger_ready) causes.push('missing_weak_passenger_content')
  if (row.publication_layers?.factually_verified === false) causes.push('unsupported_factual_claims')
  const policy = row.policy_dry_run
  if (policy && !policy.ok) causes.push('gateway_terminal_policy_block')
  if (!causes.length) causes.push('needs_review_unclassified')
  return causes
}

function draftOne({ row, guides }) {
  const existing = guides.byAppPortId[row.app_port_id]
  const factPack = loadFactPack(researchRoot, row.landing_slug)
  factPack.research_sha256 = row.research_sha256 || factPack.research_sha256
  let draft = synthesizePassengerDraft({
    landingSlug: row.landing_slug,
    appPortId: row.app_port_id,
    portName: row.name?.split(',')[0] || existing?.portName || row.app_port_id,
    country: row.country || existing?.country,
    factPack,
    existingGuide: existing,
  })
  draft = sanitizePassengerDraftSurfaces(draft)
  const validation = validateEditorialDraft({ draft, manifestRow: row, researchRoot })
  const risk = classifyDraftRisk({ draft, validation, manifestRow: row })
  const scan = scanDraftFields(draft)
  const bucket = classifyOwnerBucket({
    validationOk: validation.ok,
    supportedAttractions: (draft.thingsToDo?.topThings || []).length,
    scan,
    unresolved: draft.researchImport?.unresolved_claims,
    editorialFailures: validation.failures,
  })
  return { draft, validation, risk, scan, bucket }
}

function main() {
  const guidesPath = path.join(REPO, 'data/public-port-guides.json')
  const guidesBackup = `${guidesPath}.stage61-backup`
  const hadBackup = fs.existsSync(guidesBackup)
  if (!fs.existsSync(BASELINE_GUIDES)) throw new Error('missing baseline guides rollback')
  if (!hadBackup) fs.copyFileSync(guidesPath, guidesBackup)
  fs.copyFileSync(BASELINE_GUIDES, guidesPath)

  const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot })
  const publishedSet = buildPublishedSlugSet(REPO)
  const guides = loadPublicPortGuidesFile(REPO)

  const needsReview = (report.ports || []).filter((p) => {
    if (p.publication_bucket !== 'NEEDS_REVIEW') return false
    if (publishedSet.has(p.landing_slug)) return false
    const g = guides.byAppPortId[p.app_port_id]
    if (g && usesPassengerEditorialLead(g)) return false
    return true
  })

  const causeCounts = {}
  const classified = needsReview.map((row) => {
    const causes = classifyRootCause(row)
    for (const c of causes) causeCounts[c] = (causeCounts[c] || 0) + 1
    return { landing_slug: row.landing_slug, app_port_id: row.app_port_id, causes, thin_score: row.thin_score }
  })

  const pool = needsReview.filter(
    (p) =>
      p.qa_verdict === 'PASS' &&
      p.identifier_status === 'resolved' &&
      p.research_sha_verified &&
      !STAGE43_HARD_EXCLUDE.has(p.landing_slug) &&
      !exclusionReasonForSlug(p.landing_slug, publishedSet)
  )
  const { picked } = selectStage28Cohort({ eligibilityPorts: pool, guides, limit: PILOT_LIMIT })

  fs.mkdirSync(OUT, { recursive: true })
  fs.mkdirSync(CACHE, { recursive: true })
  fs.mkdirSync(PILOT_DRAFTS, { recursive: true })

  const pilotResults = []
  let recovered = 0
  for (const row of picked) {
    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug: row.landing_slug,
      manifestRow: row,
    })
    if (!sha.ok) {
      pilotResults.push({ landing_slug: row.landing_slug, status: 'blocked', reason: 'research_sha_mismatch' })
      continue
    }
    try {
      const { draft, validation, scan, bucket } = draftOne({ row, guides })
      const factual = reviewConsequentialClaims({
        guide: { ...draft, appPortId: row.app_port_id },
        landingSlug: row.landing_slug,
        researchRoot,
        fieldExclusions: [],
      })
      const draftPath = path.join(PILOT_DRAFTS, `${row.landing_slug}.json`)
      fs.writeFileSync(
        draftPath,
        `${JSON.stringify({ draft, validation, scan, bucket, factual_exclude: factual.exclude_from_release }, null, 2)}\n`,
        'utf8'
      )
      const recoveredNow =
        validation.ok &&
        bucket === 'READY_FOR_OWNER_APPROVAL' &&
        !factual.exclude_from_release &&
        scan.risks.length === 0
      if (recoveredNow) recovered += 1
      pilotResults.push({
        landing_slug: row.landing_slug,
        app_port_id: row.app_port_id,
        owner_bucket: bucket,
        publication_gates_pass: validation.ok && !factual.exclude_from_release,
        recovered: recoveredNow,
        scan_risks: scan.risks,
        validation_failures: validation.failures,
        factual_exclude: factual.exclude_from_release,
        draft_file: `qa-evidence/bulk-50-needs-review-recovery/pilot-drafts/${row.landing_slug}.json`,
      })
    } catch (e) {
      pilotResults.push({ landing_slug: row.landing_slug, status: 'error', message: String(e.message) })
    }
  }

  const ranked = pilotResults
    .filter((p) => p.recovered)
    .map((p) => p.landing_slug)
    .sort()
  const nextCandidates = [
    ...ranked,
    ...pilotResults
      .filter((p) => p.owner_bucket === 'READY_FOR_OWNER_APPROVAL' && !p.recovered)
      .map((p) => p.landing_slug),
  ].slice(0, 50)

  const rootCauses = {
    generated_at_utc: new Date().toISOString(),
    baseline_guides: BASELINE_GUIDES,
    needs_review_analyzed: needsReview.length,
    cause_counts: causeCounts,
    ports: classified,
  }
  const pilot = {
    generated_at_utc: new Date().toISOString(),
    pilot_limit: PILOT_LIMIT,
    pilot_selected: picked.length,
    newly_recovered_ready: recovered,
    results: pilotResults,
  }
  const nextBulk = {
    generated_at_utc: new Date().toISOString(),
    estimated_safe_release_size: nextCandidates.length,
    ranked_slugs: ranked,
    candidate_slugs_up_to_50: nextCandidates,
    note: 'Excludes PR #81 cohort and policy holds. Recovered ports need owner approval before grouped release.',
  }

  fs.writeFileSync(path.join(REPO, 'NEEDS_REVIEW_ROOT_CAUSES.json'), `${JSON.stringify(rootCauses, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(REPO, 'NEEDS_REVIEW_RECOVERY_PILOT.json'), `${JSON.stringify(pilot, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(REPO, 'NEXT_BULK_RELEASE_CANDIDATES.json'), `${JSON.stringify(nextBulk, null, 2)}\n`, 'utf8')

  fs.copyFileSync(guidesBackup, guidesPath)
  if (!hadBackup) fs.unlinkSync(guidesBackup)

  console.log(
    JSON.stringify(
      {
        needs_review_analyzed: needsReview.length,
        pilot_size: picked.length,
        newly_recovered: recovered,
        next_safe_cohort_estimate: nextCandidates.length,
      },
      null,
      2
    )
  )
}

main()

#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { containsInternalResearchLeak, preparePassengerGuideText } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema')
const { sanitizePassengerDraftSurfaces } = require('./lib/bulkPortPublication/sanitizePassengerDraftSurfaces')
const { buildPublishedSlugSet, exclusionReasonForSlug } = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence', 'bulk-50-port-release')
const DRAFTS = path.join(REPO, 'qa-evidence', 'stage45-rescore', 'drafts')
const LOCK = 'bulk-50-port-release-v1'
const MAX_COHORT = 50
const BASELINE_SHA = '9ea50c967a26a705fbbf93ab196b39f8b7835cbe'
const STAGE45_BUNDLE = 'f13e73e56c6a099cdd16de0648f0c6c0c7a9b6059c3a6f8dbcaa668174c59214'
const DEFAULT_RESEARCH =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

const POLICY_HOLD_SLUGS = [
  'bod-norway',
  'eilat-israel',
  'mormugao-port-goa-india',
  'mumbai-india',
  'ravenna-italy',
  'venice-ravenna-trieste-italy',
]

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — bulk-50 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`
}

function hashFile(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function sanitizePassengerGuideSurfaces(guide) {
  for (const { holder, key } of listPassengerTextFields(guide)) {
    if (typeof holder[key] !== 'string') continue
    holder[key] = preparePassengerGuideText(holder[key], { label: `guide_field_${key}` })
  }
  if (guide.gettingThere?.distanceAnswer && typeof guide.gettingThere.distanceAnswer === 'string') {
    guide.gettingThere.distanceAnswer = preparePassengerGuideText(guide.gettingThere.distanceAnswer, {
      label: 'distanceAnswer',
    })
  }
  return guide
}

function selectCandidates(rescore, publishedSlugs) {
  const exceptionQueue = []
  const pool = []
  for (const row of rescore.ports || []) {
    const slug = row.landing_slug
    if (publishedSlugs.has(slug)) {
      exceptionQueue.push({ landing_slug: slug, reason: 'already_published_passenger_editorial' })
      continue
    }
    const policy = exclusionReasonForSlug(slug, publishedSlugs)
    if (policy === 'stage43_hard_exclude' || POLICY_HOLD_SLUGS.includes(slug)) {
      exceptionQueue.push({ landing_slug: slug, reason: policy || 'policy_hold' })
      continue
    }
    if (slug === 'eilat-israel') {
      exceptionQueue.push({ landing_slug: slug, reason: 'eilat_factual_blocked' })
      continue
    }
    const ready =
      row.owner_bucket === 'READY_FOR_OWNER_APPROVAL' && row.publication_gates_pass && row.draft_version === PROMPT_VERSION
    const exclusionPath =
      row.owner_bucket === 'NEEDS_FACT_CHECK' &&
      row.publication_gates_pass &&
      (row.field_exclusions || []).includes('portInfo.description') &&
      row.draft_version === PROMPT_VERSION
    if (!ready && !exclusionPath) {
      exceptionQueue.push({
        landing_slug: slug,
        reason: `ineligible_bucket_${row.owner_bucket}`,
        publication_gates_pass: row.publication_gates_pass,
      })
      continue
    }
    if (!fs.existsSync(path.join(DRAFTS, `${slug}.json`))) {
      exceptionQueue.push({ landing_slug: slug, reason: 'missing_cached_draft' })
      continue
    }
    pool.push({ ...row, cohort_track: ready ? 'stage45_ready' : 'stage45_exclusion_path' })
  }
  pool.sort((a, b) => {
    const rank = (r) => (r.cohort_track === 'stage45_ready' ? 0 : 1)
    return rank(a) - rank(b) || a.landing_slug.localeCompare(b.landing_slug)
  })
  return { selected: pool.slice(0, MAX_COHORT), exceptionQueue, eligibleCount: pool.length }
}

function main() {
  const researchRoot = process.env.PORT_RESEARCH_ROOT || DEFAULT_RESEARCH
  const rescorePath = path.join(REPO, 'STAGE45_50_PORT_RESCORE.json')
  if (!fs.existsSync(rescorePath)) throw new Error('missing STAGE45_50_PORT_RESCORE.json')
  const rescore = JSON.parse(fs.readFileSync(rescorePath, 'utf8'))
  if (rescore.bundle_idempotency_hash !== STAGE45_BUNDLE) {
    throw new Error(`stage45 bundle mismatch: ${rescore.bundle_idempotency_hash}`)
  }
  const publishedSlugs = buildPublishedSlugSet(REPO)
  const { selected, exceptionQueue, eligibleCount } = selectCandidates(rescore, publishedSlugs)
  const lockedAt = new Date().toISOString()
  const guides = loadPublicPortGuidesFile(REPO)
  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()

  fs.mkdirSync(path.join(OUT, 'proposed-guides'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'previews-local-only'), { recursive: true })
  fs.mkdirSync(path.join(OUT, 'rollback'), { recursive: true })

  const manifestPorts = []
  const factualResults = []
  const gateResults = []
  let passing = 0

  for (const row of selected) {
    const landingSlug = row.landing_slug
    const draftPath = path.join(DRAFTS, `${landingSlug}.json`)
    const draftPayload = JSON.parse(fs.readFileSync(draftPath, 'utf8'))
    let draft = sanitizePassengerDraftSurfaces(JSON.parse(JSON.stringify(draftPayload.draft || draftPayload)))
    const draftSha = hashFile(draftPath)
    if (draftSha !== row.draft_file_sha256) throw new Error(`draft sha mismatch ${landingSlug}`)

    const sha = verifyResearchPortSha({
      researchRoot,
      landingSlug,
      manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
    })
    if (!sha.ok) throw new Error(`research sha mismatch ${landingSlug}`)

    const validation = validateEditorialDraft({
      draft,
      manifestRow: { landing_slug: landingSlug, app_port_id: row.app_port_id },
      researchRoot,
    })

    const existing = JSON.parse(JSON.stringify(guides.byAppPortId[row.app_port_id]))
    const fieldExclusions = (row.field_exclusions || []).slice().sort()
    const lockMeta = {
      draft_id: row.draft_id,
      draft_version: row.draft_version,
      research_sha256: row.research_sha256,
      landing_slug: landingSlug,
      locked_at_utc: lockedAt,
      draft_source: 'stage45-rescore',
    }

    let proposed = applyEditorialDraftToGuide({
      existingGuide: existing,
      draft,
      fieldExclusions,
      lockMeta,
    })
    proposed = sanitizePassengerGuideSurfaces(proposed)
    proposed.researchImport.bulk_50_release_candidate = true
    proposed.researchImport.stage45_rescore_bundle_hash = STAGE45_BUNDLE

    const factual = reviewConsequentialClaims({
      guide: proposed,
      landingSlug,
      researchRoot,
      fieldExclusions,
    })
    factualResults.push({ landing_slug: landingSlug, ...factual })

    const fragment = buildPhase1GuideHtml({
      port: {
        name: proposed.portName,
        slug: landingSlug,
        appPortId: proposed.appPortId,
        country: proposed.country,
      },
      guide: proposed,
      terminals: [],
      affiliate: { show: false },
    })
    const html = shellHtml(fragment, proposed.portName)
    const htmlVal = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true })
    const leakBlob = JSON.stringify({
      portInfo: proposed.portInfo,
      gettingThere: proposed.gettingThere,
      thingsToDo: proposed.thingsToDo,
    })
    const gates = [
      { gate: 'editorial_draft_validation', ok: validation.ok, failures: validation.failures },
      { gate: 'html_preview_validation', ok: htmlVal.ok, issues: htmlVal.issues },
      { gate: 'passenger_leak_scan', ok: !containsInternalResearchLeak(leakBlob) },
      { gate: 'prompt_version', ok: draft?.researchImport?.prompt_version === PROMPT_VERSION || row.draft_version === PROMPT_VERSION },
      { gate: 'factual_exclude', ok: !factual.exclude_from_release, reason: factual.exclude_reason },
    ]
  const portPass = gates.every((g) => g.ok !== false)
    if (portPass) passing += 1
    gateResults.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      pass: portPass,
      gates,
      field_exclusions: fieldExclusions,
      cohort_track: row.cohort_track,
    })

    const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
    fs.writeFileSync(path.join(OUT, 'proposed-guides', `${landingSlug}.json`), `${JSON.stringify(proposed, null, 2)}\n`, 'utf8')
    fs.writeFileSync(
      path.join(OUT, 'rollback', `${landingSlug}.production-snapshot.json`),
      `${JSON.stringify(existing, null, 2)}\n`,
      'utf8'
    )
    fs.writeFileSync(path.join(OUT, 'previews-local-only', `${landingSlug}.html`), html, 'utf8')

    manifestPorts.push({
      landing_slug: landingSlug,
      app_port_id: row.app_port_id,
      draft_file_sha256: draftSha,
      research_sha256: row.research_sha256,
      field_exclusions: fieldExclusions,
      proposed_content_hash: proposedContentHash,
      production_apply_allowed: portPass,
      publication_gates_pass: portPass,
      proposed_guide_ref: `qa-evidence/bulk-50-port-release/proposed-guides/${landingSlug}.json`,
      rollback_ref: `qa-evidence/bulk-50-port-release/rollback/${landingSlug}.production-snapshot.json`,
      owner_approval_status: 'PENDING',
      cohort_track: row.cohort_track,
    })
  }

  const approved = manifestPorts.filter((p) => p.production_apply_allowed)
  const releaseBundleHash = crypto
    .createHash('sha256')
    .update(
      stableStringify(
        approved.map((p) => ({
          landing_slug: p.landing_slug,
          proposed_content_hash: p.proposed_content_hash,
          draft_file_sha256: p.draft_file_sha256,
          research_sha256: p.research_sha256,
        }))
      )
    )
    .digest('hex')

  const verdict =
    passing === 0
      ? 'BLOCKED'
      : passing === selected.length && passing <= MAX_COHORT
        ? 'READY_FOR_REVIEW'
        : 'PARTIAL'

  const manifest = {
    schema_version: 1,
    lock_version: LOCK,
    status: verdict,
    owner_publication_authorized: false,
    created_at_utc: lockedAt,
    production_baseline_sha: BASELINE_SHA,
    worktree_head_sha: head,
    stage45_rescore_bundle_hash: STAGE45_BUNDLE,
    bundle_idempotency_hash: releaseBundleHash,
    max_cohort_requested: MAX_COHORT,
    eligible_candidate_count: eligibleCount,
    candidate_count_selected: selected.length,
    passing_all_gates: passing,
    slugs_locked: selected.map((p) => p.landing_slug).sort(),
    slugs_approved: approved.map((p) => p.landing_slug).sort(),
    ports: manifestPorts,
    exception_queue: exceptionQueue,
    pipeline: {
      prompt_version: PROMPT_VERSION,
      draft_source: 'qa-evidence/stage45-rescore/drafts',
      sanitizer: 'stage22-deterministic-v2.5-marker-strip',
    },
  }

  fs.writeFileSync(path.join(OUT, 'BULK_50_RELEASE_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(OUT, 'FACTUAL_AND_EDITORIAL_GATES.json'),
    `${JSON.stringify({ generated_at: lockedAt, ports: factualResults, gate_rows: gateResults }, null, 2)}\n`,
    'utf8'
  )
  fs.writeFileSync(path.join(OUT, 'EXCEPTION_QUEUE.json'), `${JSON.stringify({ exception_queue: exceptionQueue }, null, 2)}\n`, 'utf8')

  console.log(
    JSON.stringify(
      {
        verdict,
        passing,
        selected: selected.length,
        eligible: eligibleCount,
        approved: approved.length,
        release_bundle: releaseBundleHash,
      },
      null,
      2
    )
  )
  if (passing === 0) process.exit(45)
}

main()

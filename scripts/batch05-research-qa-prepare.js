#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const {
  containsInternalResearchLeak,
  collectGuidePassengerLeakBlob,
  preparePassengerGuideText,
} = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { loadResearchIndex } = require('./lib/portResearchImport/buildIdentifierManifest')
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema')
const { classifyOwnerBucket, scanDraftFields } = require('./lib/bulkPortPublication/stage23FieldReview')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const { extractTravelerQuestions } = require('./lib/portResearchImport/extractMarkdownSections')
const { readResearchMarkdown } = require('./lib/portResearchImport/transformResearchToPublic')
const { replaceRobotsMeta } = require('./lib/adsenseIndexability')
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields')
const { buildTargetedNeedsReviewDraft } = require('./lib/bulkPortPublication/targetedNeedsReviewRecovery')
const { buildBootstrapGuideShell } = require('./lib/bulkPortPublication/stage64BlockedCohort')
const { applyBatch05PassengerPatch } = require('./lib/bulkPortPublication/batch05ResearchQaPassengerPatches')
const { assertBatch04TokyoReleaseBinding } = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch05')
const POLICY = path.join(EVIDENCE, 'BATCH05_RESEARCH_QA_POLICY.json')
const BASELINE_MAIN = process.env.CONTENT_REPAIR_BASELINE_MAIN || '5da04ec12cb7be9bc82242a1fb421f4d0ddde7ad'
const EXPECTED_PE = Number(process.env.CONTENT_REPAIR_BASELINE_PE || 363)
const INDEX_ROOT =
  process.env.PORT_RESEARCH_INDEX_ROOT ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'
const BY_PORT_ROOT =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

const PORTS = [
  {
    landing_slug: 'freeport-bahamas',
    app_port_id: 'freeport',
    research_sha256: 'b907bbecbd618dc401ab544899c0f7c9053b7e1a1291153989d7ddfbe309135d',
    outstanding_gaps: ['port_door_gps_null', 'loa_unverified', 'transfer_minutes_unverified'],
  },
  {
    landing_slug: 'ko-samui-thailand',
    app_port_id: 'ko-samui',
    research_sha256: '6c3e039f39c77b559d8b8a311da9ac17f7ec28708e64a94a7346cba428924aff',
    outstanding_gaps: ['terminal_transit_primary_not_captured'],
  },
  {
    landing_slug: 'new-mangalore-india',
    app_port_id: 'new-mangalore',
    research_sha256: 'dd8423f9ede431663f03b75ae944a21953f72068f3052845c06b3697ea0e1c67',
    outstanding_gaps: ['terminal_or_transit_facts_unverified'],
  },
  {
    landing_slug: 'phuket-thailand',
    app_port_id: 'ko-phuket',
    research_sha256: 'debb95baed938dfb3b1fe5bfaaa5318851a517714d4d9b12498b3f2532f67b3b',
    outstanding_gaps: ['unverified_fields_in_research_manifest'],
  },
]

const OWNER_BUCKETS_OK = new Set(['READY_FOR_OWNER_APPROVAL', 'NEEDS_FACT_CHECK'])

function fail(msg) {
  console.error(JSON.stringify({ error: 'BATCH05_RESEARCH_QA_PREP_STOP', message: msg }, null, 2))
  process.exit(42)
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function shellPreviewHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${title} — batch05 candidate preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`
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

function loadDraftForPort(portRow, existingGuide) {
  const index = loadResearchIndex(INDEX_ROOT)
  const indexRow = index.find((r) => r.slug === portRow.landing_slug) || {}
  const row = {
    landing_slug: portRow.landing_slug,
    app_port_id: portRow.app_port_id,
    research_sha256: portRow.research_sha256,
    qa_verdict: indexRow.qa_verdict || 'BLOCKED',
    identifier_status: 'resolved',
    country: existingGuide?.country || indexRow.country,
    name: indexRow.name,
  }
  let draft = buildTargetedNeedsReviewDraft({ row, existingGuide, researchRoot: BY_PORT_ROOT })
  draft = applyBatch05PassengerPatch({
    landingSlug: portRow.landing_slug,
    draft,
    researchRoot: BY_PORT_ROOT,
  })
  return { draft, researchQaVerdict: row.qa_verdict }
}

function mergeTravelerQuestions(compositeRoot, landingSlug, guide) {
  const body = readResearchMarkdown(compositeRoot, landingSlug)
  const travelerQuestions = extractTravelerQuestions(body)
  if (!travelerQuestions || !travelerQuestions.length) return guide
  guide.researchImport = { ...(guide.researchImport || {}), travelerQuestions }
  return guide
}

function main() {
  if (process.env.SEADAYS_BATCH05_RESEARCH_QA_PREP !== '1') {
    fail('set SEADAYS_BATCH05_RESEARCH_QA_PREP=1 for batch05 research qa prep')
  }
  if (!fs.existsSync(POLICY)) fail('missing BATCH05_RESEARCH_QA_POLICY.json')
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'))
  if (policy.research_qa_index_not_mutated_in_pr !== true) {
    fail('research_qa_index_not_mutated_in_pr must be true')
  }
  if (policy.owner_conditional_prep_authorized !== true) fail('owner_conditional_prep_authorized must be true')
  if (policy.owner_publication_authorized === true || policy.owner_indexing_authorized === true) {
    fail('owner auth flags must remain false')
  }
  if (policy.owner_factual_hold_cleared === true) fail('factual hold must not be cleared in policy')

  const head = execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim()
  try {
    execSync(`git merge-base --is-ancestor ${BASELINE_MAIN} HEAD`, { cwd: REPO, stdio: 'pipe' })
  } catch {
    fail(`HEAD ${head} is not descended from baseline ${BASELINE_MAIN}`)
  }

  const guidesBefore = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guidesBefore)
  const peBefore = countPassengerEditorialGuides(guidesBefore)
  if (peBefore !== EXPECTED_PE) fail(`unexpected live PE ${peBefore} (expected ${EXPECTED_PE})`)

  const prodGuidesHashBefore = sha256File(path.join(REPO, 'data/public-port-guides.json'))
  const rostockHtmlBefore = sha256File(path.join(REPO, 'ports/rostock-germany/index.html'))
  const kirkenesHtmlBefore = sha256File(path.join(REPO, 'ports/kirkenes-norway/index.html'))
  const ochoHtmlBefore = sha256File(path.join(REPO, 'ports/ocho-rios-jamaica/index.html'))
  const tokyoHtmlBefore = sha256File(path.join(REPO, 'ports/tokyo-yokohama-japan/index.html'))
  assertBatch04TokyoReleaseBinding(REPO, guidesBefore)

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  fs.mkdirSync(rollbackDir, { recursive: true })
  for (const p of PORTS) {
    const htmlSrc = path.join(REPO, 'ports', p.landing_slug, 'index.html')
    if (!fs.existsSync(htmlSrc)) fail(`missing production html ${p.landing_slug}`)
    fs.mkdirSync(path.join(rollbackDir, 'ports', p.landing_slug), { recursive: true })
    fs.copyFileSync(htmlSrc, path.join(rollbackDir, 'ports', p.landing_slug, 'index.html'))
  }

  const index = loadResearchIndex(INDEX_ROOT)
  const manifestPorts = []
  const gapReport = []

  try {
    for (const portRow of PORTS) {
      const indexRow = index.find((r) => r.slug === portRow.landing_slug)
      if (!indexRow) fail(`${portRow.landing_slug} missing from research index`)
      if (indexRow.sha256 !== portRow.research_sha256) fail(`research index sha mismatch ${portRow.landing_slug}`)
      const researchQaVerdict = indexRow.qa_verdict || 'BLOCKED'
      if (researchQaVerdict === 'PASS') {
        fail(`research qa already PASS for ${portRow.landing_slug}; use publication prep not batch05 repair`)
      }

      const mdPath = path.join(BY_PORT_ROOT, 'by-port', `${portRow.landing_slug}.md`)
      if (!fs.existsSync(mdPath)) fail(`missing research markdown ${portRow.landing_slug}`)
      const mdSha = sha256File(mdPath)
      if (mdSha !== portRow.research_sha256) {
        fail(`research sha verify failed ${portRow.landing_slug}: expected ${portRow.research_sha256} got ${mdSha}`)
      }

      const live = guidesBefore.byAppPortId[portRow.app_port_id]
      const row = {
        landing_slug: portRow.landing_slug,
        app_port_id: portRow.app_port_id,
        research_sha256: portRow.research_sha256,
        qa_verdict: researchQaVerdict,
        identifier_status: 'resolved',
        country: indexRow.country,
        name: indexRow.name,
      }
      const existing = JSON.parse(JSON.stringify(live || buildBootstrapGuideShell(row)))
      if (usesPassengerEditorialLead(existing)) {
        fail(`${portRow.landing_slug} already passenger_editorial in production`)
      }

      const { draft } = loadDraftForPort(portRow, existing)
      const manifestRow = {
        landing_slug: portRow.landing_slug,
        app_port_id: portRow.app_port_id,
        sha256: portRow.research_sha256,
        qa_verdict: researchQaVerdict,
        identifier_status: 'resolved',
      }
      const validation = validateEditorialDraft({ draft, manifestRow, researchRoot: BY_PORT_ROOT })
      const scan = scanDraftFields(draft)
      const ownerBucket = classifyOwnerBucket({
        validationOk: validation.ok,
        supportedAttractions: (draft.thingsToDo?.topThings || []).length,
        scan,
        unresolved: draft.researchImport?.unresolved_claims,
        editorialFailures: validation.failures,
      })

      const fieldExclusions = []
      let proposed = applyEditorialDraftToGuide({
        existingGuide: existing,
        draft,
        fieldExclusions,
        lockMeta: {
          draft_version: PROMPT_VERSION,
          research_sha256: portRow.research_sha256,
          landing_slug: portRow.landing_slug,
          locked_at_utc: new Date().toISOString(),
          draft_source: 'batch05-research-qa-repair',
        },
      })
      proposed = sanitizePassengerGuideSurfaces(proposed)
      proposed = mergeTravelerQuestions(BY_PORT_ROOT, portRow.landing_slug, proposed)
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        publication_tier: 'passenger_editorial_candidate',
        content_repair_batch05: true,
        batch05_preparation_only: true,
        research_qa_verdict: researchQaVerdict,
        owner_publication_authorized: false,
        owner_indexing_authorized: false,
        owner_factual_hold_cleared: false,
        not_publication_authorization: true,
        conditional_policy_clearance_ref: 'qa-evidence/content-repair-batch05/BATCH05_RESEARCH_QA_POLICY.json',
        baseline_main: BASELINE_MAIN,
      }

      const factual = reviewConsequentialClaims({
        guide: proposed,
        landingSlug: portRow.landing_slug,
        researchRoot: BY_PORT_ROOT,
        fieldExclusions,
      })

      const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
      const outBase = path.join(EVIDENCE, 'candidate-assets', portRow.landing_slug)
      fs.mkdirSync(outBase, { recursive: true })

      const correctedPayload = {
        landing_slug: portRow.landing_slug,
        draft,
        validation,
        owner_bucket: ownerBucket,
        recovery_mode: 'batch05-research-qa-repair',
        research_qa_verdict: researchQaVerdict,
      }
      fs.writeFileSync(path.join(outBase, 'corrected-draft.json'), `${JSON.stringify(correctedPayload, null, 2)}\n`)
      fs.writeFileSync(path.join(outBase, 'proposed-guide.json'), `${JSON.stringify(proposed, null, 2)}\n`)
      fs.writeFileSync(
        path.join(outBase, 'production-snapshot.json'),
        `${JSON.stringify({ landing_slug: portRow.landing_slug, guide: live || null }, null, 2)}\n`
      )

      const fragment = buildPhase1GuideHtml({
        port: {
          name: proposed.portName,
          slug: portRow.landing_slug,
          appPortId: proposed.appPortId,
          country: proposed.country,
        },
        guide: proposed,
        terminals: [],
        affiliate: { show: false },
      })
      const previewHtml = shellPreviewHtml(fragment, proposed.portName || portRow.landing_slug)
      const htmlValPreview = validateGeneratedPortHtml(previewHtml, {
        slug: portRow.landing_slug,
        previewFragment: true,
      })

      const gates = [
        { gate: 'editorial_draft_validation', ok: validation.ok, failures: validation.failures },
        {
          gate: 'owner_bucket_ready',
          ok: OWNER_BUCKETS_OK.has(ownerBucket),
          owner_bucket: ownerBucket,
        },
        { gate: 'html_preview_validation', ok: htmlValPreview.ok, issues: htmlValPreview.issues },
        {
          gate: 'passenger_leak_scan',
          ok: !containsInternalResearchLeak(collectGuidePassengerLeakBlob(proposed)),
        },
        { gate: 'factual_exclude', ok: !factual.exclude_from_release, reason: factual.exclude_reason },
      ]
      const publicationGatesPass = gates.every((g) => g.ok !== false)

      manifestPorts.push({
        landing_slug: portRow.landing_slug,
        app_port_id: portRow.app_port_id,
        research_sha256: portRow.research_sha256,
        proposed_content_hash: proposedContentHash,
        owner_bucket: ownerBucket,
        publication_gates_pass: publicationGatesPass,
        validation_failures: validation.failures,
        factual_flags: factual.flags || [],
        gates,
        proposed_guide_ref: `qa-evidence/content-repair-batch05/candidate-assets/${portRow.landing_slug}/proposed-guide.json`,
        corrected_draft_ref: `qa-evidence/content-repair-batch05/candidate-assets/${portRow.landing_slug}/corrected-draft.json`,
        research_qa_verdict: researchQaVerdict,
        production_apply_allowed: false,
        owner_approval_status: 'PENDING',
        owner_factual_hold_cleared: false,
      })

      gapReport.push({
        landing_slug: portRow.landing_slug,
        outstanding_factual_gaps: portRow.outstanding_gaps,
        owner_factual_hold_cleared: false,
      })

      const nextGuides = JSON.parse(JSON.stringify(guidesBefore))
      assignPublicPortGuideByAppPortId(nextGuides, {
        landingSlug: portRow.landing_slug,
        appPortId: portRow.app_port_id,
        guide: proposed,
        priorGuideAtSlot: existing,
      })
      removeStage65ExcludedGuideEntries(nextGuides)
      writePublicPortGuidesFile(REPO, nextGuides)

      const slugMapPatch = path.join(EVIDENCE, 'SLUG_MAP_PATCH.json')
      execSync(`node scripts/generateBlogs.js --ports-only --only=${portRow.landing_slug}`, {
        cwd: REPO,
        stdio: 'pipe',
        env: {
          ...process.env,
          SEADAYS_BATCH05_RESEARCH_QA_PREP: '1',
          SEADAYS_CONTENT_REPAIR_BATCH05: '1',
          STAGE68_PUBLICATION_SLUG_MAP: slugMapPatch,
          SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(REPO, '..', 'Seadays-trust-boundary'),
          VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
          VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
          VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
        },
      })

      const prodHtmlPath = path.join(REPO, 'ports', portRow.landing_slug, 'index.html')
      let prodHtml = fs.readFileSync(prodHtmlPath, 'utf8')
      if (!/noindex/i.test(prodHtml)) {
        prodHtml = replaceRobotsMeta(prodHtml, 'noindex, follow')
        fs.writeFileSync(prodHtmlPath, prodHtml, 'utf8')
      }

      const htmlValFull = validateGeneratedPortHtml(prodHtml, { slug: portRow.landing_slug, previewFragment: false })
      fs.mkdirSync(path.join(EVIDENCE, 'candidate-applied', 'ports', portRow.landing_slug), { recursive: true })
      fs.copyFileSync(prodHtmlPath, path.join(EVIDENCE, 'candidate-applied', 'ports', portRow.landing_slug, 'index.html'))
      fs.writeFileSync(
        path.join(EVIDENCE, 'candidate-applied', `byAppPortId.${portRow.app_port_id}.json`),
        `${JSON.stringify(nextGuides.byAppPortId[portRow.app_port_id], null, 2)}\n`
      )
      fs.writeFileSync(path.join(outBase, 'preview-local-only.html'), previewHtml, 'utf8')
      fs.writeFileSync(
        path.join(outBase, 'HTML_VALIDATION.json'),
        `${JSON.stringify({ preview: htmlValPreview, full: htmlValFull }, null, 2)}\n`
      )

      manifestPorts[manifestPorts.length - 1].full_html_validation = htmlValFull
      manifestPorts[manifestPorts.length - 1].full_html_gates_pass = htmlValFull.ok
    }
  } finally {
    /* temp generation restored below */
  }

  execSync('git checkout -- data/public-port-guides.json', { cwd: REPO, stdio: 'pipe' })
  for (const p of PORTS) {
    fs.copyFileSync(
      path.join(rollbackDir, 'ports', p.landing_slug, 'index.html'),
      path.join(REPO, 'ports', p.landing_slug, 'index.html')
    )
  }

  const peAfter = countPassengerEditorialGuides(loadPublicPortGuidesFile(REPO))
  const prodGuidesHashAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'))
  if (peAfter !== EXPECTED_PE) fail(`PE after restore ${peAfter} !== ${EXPECTED_PE}`)
  if (prodGuidesHashAfter !== prodGuidesHashBefore) fail('public-port-guides.json not restored to baseline hash')
  if (sha256File(path.join(REPO, 'ports/rostock-germany/index.html')) !== rostockHtmlBefore) {
    fail('rostock-germany redirect html changed')
  }
  if (sha256File(path.join(REPO, 'ports/kirkenes-norway/index.html')) !== kirkenesHtmlBefore) {
    fail('kirkenes-norway html changed')
  }
  if (sha256File(path.join(REPO, 'ports/ocho-rios-jamaica/index.html')) !== ochoHtmlBefore) {
    fail('ocho-rios-jamaica html changed')
  }
  if (sha256File(path.join(REPO, 'ports/tokyo-yokohama-japan/index.html')) !== tokyoHtmlBefore) {
    fail('tokyo-yokohama-japan html changed')
  }

  const bundlePayload = {
    schema_version: 1,
    stage: 'content-repair-batch05',
    status: manifestPorts.every((p) => p.publication_gates_pass && p.full_html_gates_pass)
      ? 'READY_FOR_OWNER_FACTUAL_REVIEW'
      : 'PARTIAL',
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    owner_factual_hold_cleared: false,
    production_apply_permitted: false,
    baseline_main: BASELINE_MAIN,
    baseline_live_passenger_editorial: EXPECTED_PE,
    worktree_head_after_restore: execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim(),
    production_guides_sha256_preserved: prodGuidesHashBefore,
    ports: manifestPorts,
    policy_ref: 'qa-evidence/content-repair-batch05/BATCH05_RESEARCH_QA_POLICY.json',
    research_qa_validation_ref: 'qa-evidence/content-repair-batch05/research-qa/BATCH05_RESEARCH_QA_VALIDATION.json',
    created_at_utc: new Date().toISOString(),
  }
  bundlePayload.bundle_idempotency_hash = crypto
    .createHash('sha256')
    .update(stableStringify(bundlePayload))
    .digest('hex')

  fs.writeFileSync(path.join(EVIDENCE, 'BATCH05_PREP_MANIFEST.json'), `${JSON.stringify(bundlePayload, null, 2)}\n`)
  fs.writeFileSync(path.join(EVIDENCE, 'UNRESOLVED_FACTUAL_GAPS.json'), `${JSON.stringify({ ports: gapReport }, null, 2)}\n`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        status: bundlePayload.status,
        bundle_hash: bundlePayload.bundle_idempotency_hash,
        pe_preserved: peAfter,
        ports: manifestPorts.map((p) => ({
          slug: p.landing_slug,
          gates: p.publication_gates_pass && p.full_html_gates_pass,
          owner_bucket: p.owner_bucket,
          failures: p.validation_failures,
        })),
      },
      null,
      2
    )
  )

  if (manifestPorts.some((p) => !p.publication_gates_pass || !p.full_html_gates_pass)) process.exit(45)
}

main()

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
const { patchTokyoYokohamaDraft } = require('./lib/bulkPortPublication/tokyoYokohamaPassengerPatch')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch04')
const POLICY = path.join(EVIDENCE, 'CONTENT_REPAIR_POLICY.json')
const STAGE63 = path.join(REPO, 'qa-evidence/stage63-50-port-recovery')
const BASELINE_MAIN = process.env.CONTENT_REPAIR_BASELINE_MAIN || 'dea758c809c1e8624e99e3248793f987c8d5feb7'
const EXPECTED_PE = Number(process.env.CONTENT_REPAIR_BASELINE_PE || 362)
const INDEX_ROOT =
  process.env.PORT_RESEARCH_INDEX_ROOT ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'
const BY_PORT_ROOT =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

const PORTS = [
  {
    landing_slug: 'tokyo-yokohama-japan',
    app_port_id: 'yokohama',
    research_sha256: '7e1a1016bff4d827fe7fa1246531b3c242a8b9d5584b0c0126e917e3fbf6d017',
    stage63_rollback_ref: 'qa-evidence/stage63-50-port-recovery/rollback/tokyo-yokohama-japan.production-snapshot.json',
    patchDraft: patchTokyoYokohamaDraft,
    outstanding_gaps: [
      'tict_harumi_quay_loa_unverified',
      'terminal_door_gps_null',
      'japan_immigration_primary_not_captured',
      'daikoku_cruise_use_unverified',
    ],
  },
]

function fail(msg) {
  console.error(JSON.stringify({ error: 'CONTENT_REPAIR_BATCH04_STOP', message: msg }, null, 2))
  process.exit(42)
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function shellPreviewHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${title} — batch04 candidate preview</title>
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

function loadDraftForPort(portRow) {
  const stage63DraftPath = path.join(STAGE63, 'corrected-drafts', `${portRow.landing_slug}.json`)
  const payload = JSON.parse(fs.readFileSync(stage63DraftPath, 'utf8'))
  let draft = JSON.parse(JSON.stringify(payload.draft))
  draft.landing_slug = portRow.landing_slug
  if (portRow.patchDraft) draft = portRow.patchDraft(draft)
  return { draft, priorValidation: payload.validation }
}

function mergeTravelerQuestions(compositeRoot, landingSlug, guide) {
  const body = readResearchMarkdown(compositeRoot, landingSlug)
  const travelerQuestions = extractTravelerQuestions(body)
  if (!travelerQuestions || !travelerQuestions.length) return guide
  guide.researchImport = { ...(guide.researchImport || {}), travelerQuestions }
  return guide
}

function main() {
  if (process.env.SEADAYS_CONTENT_REPAIR_BATCH04 !== '1') {
    fail('set SEADAYS_CONTENT_REPAIR_BATCH04=1 for batch04 content repair prep')
  }
  if (!fs.existsSync(POLICY)) fail('missing CONTENT_REPAIR_POLICY.json')
  const policy = JSON.parse(fs.readFileSync(POLICY, 'utf8'))
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
      if (indexRow.qa_verdict !== 'PASS') fail(`qa_verdict not PASS for ${portRow.landing_slug}`)
      if (indexRow.sha256 !== portRow.research_sha256) fail(`research index sha mismatch ${portRow.landing_slug}`)

      const mdPath = path.join(BY_PORT_ROOT, 'by-port', `${portRow.landing_slug}.md`)
      if (!fs.existsSync(mdPath)) fail(`missing research markdown ${portRow.landing_slug}`)
      const mdSha = sha256File(mdPath)
      if (mdSha !== portRow.research_sha256) {
        fail(`research sha verify failed ${portRow.landing_slug}: expected ${portRow.research_sha256} got ${mdSha}`)
      }

      const existing = JSON.parse(JSON.stringify(guidesBefore.byAppPortId[portRow.app_port_id] || {}))
      if (usesPassengerEditorialLead(existing)) {
        fail(`${portRow.landing_slug} already passenger_editorial in production`)
      }

      const { draft } = loadDraftForPort(portRow)
      const manifestRow = {
        landing_slug: portRow.landing_slug,
        app_port_id: portRow.app_port_id,
        sha256: portRow.research_sha256,
        qa_verdict: 'PASS',
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
          draft_source: 'batch04-content-repair',
        },
      })
      proposed = sanitizePassengerGuideSurfaces(proposed)
      proposed = mergeTravelerQuestions(BY_PORT_ROOT, portRow.landing_slug, proposed)
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        publication_tier: 'passenger_editorial_candidate',
        content_repair_batch04: true,
        batch04_preparation_only: true,
        owner_publication_authorized: false,
        owner_indexing_authorized: false,
        owner_factual_hold_cleared: false,
        not_publication_authorization: true,
        conditional_policy_clearance_ref: 'qa-evidence/content-repair-batch04/CONTENT_REPAIR_POLICY.json',
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
        recovery_mode: 'batch04-content-repair',
      }
      fs.writeFileSync(path.join(outBase, 'corrected-draft.json'), `${JSON.stringify(correctedPayload, null, 2)}\n`)
      fs.writeFileSync(path.join(outBase, 'proposed-guide.json'), `${JSON.stringify(proposed, null, 2)}\n`)
      fs.copyFileSync(
        path.join(REPO, portRow.stage63_rollback_ref),
        path.join(outBase, 'production-snapshot.json')
      )

      fs.writeFileSync(
        path.join(STAGE63, 'corrected-drafts', `${portRow.landing_slug}.json`),
        `${JSON.stringify(correctedPayload, null, 2)}\n`
      )
      fs.writeFileSync(
        path.join(STAGE63, 'proposed-guides', `${portRow.landing_slug}.json`),
        `${JSON.stringify(proposed, null, 2)}\n`
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
        { gate: 'owner_bucket_ready', ok: ownerBucket === 'READY_FOR_OWNER_APPROVAL', owner_bucket: ownerBucket },
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
        proposed_guide_ref: `qa-evidence/content-repair-batch04/candidate-assets/${portRow.landing_slug}/proposed-guide.json`,
        corrected_draft_ref: `qa-evidence/content-repair-batch04/candidate-assets/${portRow.landing_slug}/corrected-draft.json`,
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
          SEADAYS_CONTENT_REPAIR_BATCH04: '1',
          CONTENT_REPAIR_SLUG_MAP: slugMapPatch,
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

  const bundlePayload = {
    schema_version: 1,
    stage: 'content-repair-batch04',
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
    policy_ref: 'qa-evidence/content-repair-batch04/CONTENT_REPAIR_POLICY.json',
    created_at_utc: new Date().toISOString(),
  }
  bundlePayload.bundle_idempotency_hash = crypto
    .createHash('sha256')
    .update(stableStringify(bundlePayload))
    .digest('hex')

  fs.writeFileSync(path.join(EVIDENCE, 'BATCH04_PREP_MANIFEST.json'), `${JSON.stringify(bundlePayload, null, 2)}\n`)
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

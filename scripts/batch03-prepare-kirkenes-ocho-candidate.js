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
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { loadResearchIndex } = require('./lib/portResearchImport/buildIdentifierManifest')
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema')
const { classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview')
const { scanDraftFields } = require('./lib/bulkPortPublication/stage23FieldReview')
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

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate')
const POLICY = path.join(EVIDENCE, 'BATCH03_POLICY_CLEARANCE.json')
const PATCH = path.join(EVIDENCE, 'COMPOSITE_SHA_PATCH.json')
const STAGE63 = path.join(REPO, 'qa-evidence/stage63-50-port-recovery')
const BASELINE_MAIN = process.env.BATCH03_BASELINE_MAIN || '31f873d4d6fad6358c0ea5a12948123257571acd'
const PREPARE_ONLY = process.env.BATCH03_PREPARE_ONLY
  ? process.env.BATCH03_PREPARE_ONLY.split(',').map((s) => s.trim()).filter(Boolean)
  : null
const BY_PORT_ROOT =
  process.env.PORT_RESEARCH_ROOT || '/Users/sharanestone/Semprog/seadays-ports-deliverables'
const INDEX_ROOT =
  process.env.PORT_RESEARCH_INDEX_ROOT ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

const PORTS = [
  {
    landing_slug: 'kirkenes-norway',
    app_port_id: 'kirkenes',
    research_sha256: '7fb39713a569246163e51f762bdff77d2b473351c4f8b884077ebf752a914fe8',
    corrected_ref: 'qa-evidence/stage63-50-port-recovery/corrected-drafts/kirkenes-norway.json',
    stage63_rollback_ref: 'qa-evidence/stage63-50-port-recovery/rollback/kirkenes-norway.production-snapshot.json',
    patchDraft: patchKirkenesDraft,
  },
  {
    landing_slug: 'ocho-rios-jamaica',
    app_port_id: 'ocho-rios',
    research_sha256: '50682517fb65fb632488d2075a6782d1e049956b84f61b91c4e9171d720b99a2',
    corrected_ref: null,
    stage63_rollback_ref: 'qa-evidence/stage63-50-port-recovery/rollback/ocho-rios-jamaica.production-snapshot.json',
    patchDraft: patchOchoDraft,
  },
]

function fail(msg) {
  console.error(JSON.stringify({ error: 'BATCH03_PREP_STOP', message: msg }, null, 2))
  process.exit(42)
}

function sha256Buf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex')
}

function sha256File(p) {
  return sha256Buf(fs.readFileSync(p))
}

function shellPreviewHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, follow">
<title>${title} — batch03 candidate preview</title>
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

const KIRKENES_PASSENGER_DISTANCE =
  'From Dypvannskaia, Kirkenes town centre and nearby shops are a short walk when this quay is assigned; exact walking time and metres are not verified. Confirm berth assignment with your ship and Kirkenes Havn.'

const OCHO_PASSENGER_DISTANCE =
  'Confirm your assigned pier with the cruise line. Walking access and transport to town attractions depend on pier placement—do not rely on unverified distance figures.'

const KIRKENES_PASSENGER_LEAD =
  'Arctic port town in eastern Finnmark near the Russian border. Confirm Dypvannskaia berth assignment before planning a centre walk; museum visits and king crab experiences depend on opening hours, tickets, and what operators offer on your call day.'

function patchKirkenesDraft(draft) {
  const next = JSON.parse(JSON.stringify(draft))
  next.portInfo = {
    ...(next.portInfo || {}),
    description: KIRKENES_PASSENGER_LEAD,
  }
  next.gettingThere = {
    ...(next.gettingThere || {}),
    distanceToCity: KIRKENES_PASSENGER_DISTANCE,
    distanceAnswer: KIRKENES_PASSENGER_DISTANCE,
  }
  next.thingsToDo = {
    ...(next.thingsToDo || {}),
    topThings: [
      'Town centre / shopping near Dypvannskaia — only when this quay is assigned (confirm with your ship and Kirkenes Havn)',
      'Borderland Museum (Grenselandsmuseet) — only if open and tickets are available on your call day (hours not verified here)',
      'King crab or Arctic food experience — only via a booked operator when offered on your call (confirm availability; not a guaranteed excursion)',
    ],
    practicalTip:
      'Confirm Dypvannskaia vs any requested alternate quay before assuming a centre stroll. Do not rely on unpublished museum hours or king crab offers.',
  }
  next.size = {
    ...(next.size || {}),
    berthCount: null,
  }
  next.facts = {
    established: '',
    significance: '',
    notableFeatures: [],
    culturalHighlights: [],
  }
  return next
}

function patchOchoDraft(draft) {
  const next = JSON.parse(JSON.stringify(draft))
  next.gettingThere = {
    ...(next.gettingThere || {}),
    distanceToCity: OCHO_PASSENGER_DISTANCE,
    distanceAnswer: OCHO_PASSENGER_DISTANCE,
  }
  next.facts = {
    established: '',
    significance: 'North-coast Jamaica cruise call under Port Authority of Jamaica',
    notableFeatures: [],
    culturalHighlights: ['Jamaican culture', 'Local crafts'],
  }
  next.politics = {
    governmentType: 'Unitary parliamentary constitutional monarchy',
    stability: 'Stable',
    visaRequirements:
      'Many visitors on cruise calls use special cruise-passenger rules — confirm passport validity, PICA requirements, and any online declarations (e.g. C5) with your cruise line and official sources for your nationality.',
    entryRequirements:
      'Carry a valid passport. Cruise transit formalities can differ from airport entry — follow your ship’s document list.',
  }
  next.thingsToDo = {
    ...(next.thingsToDo || {}),
    topThings: [
      'Town / craft-market stroll — only if your pier placement and programme allow (confirm with the line)',
      'Booked waterfall or north-coast landscape excursion (Dunn’s River only via organised transfer — not a gangway walk)',
      'Beach time — confirm operator, access, and transport with your line or excursion desk',
    ],
    practicalTip:
      'Do not assume Dunn’s River (or any named falls) is walkable from the gangway without a current transfer primary.',
  }
  next.size = {
    ...(next.size || {}),
    berthCount: null,
  }
  next.researchImport = {
    ...(next.researchImport || {}),
    unresolved_claims: [
      'truncated_table_cell',
      'research_status_needs_review',
      'berth_lengths_gap',
      'transfer_metres_gap',
    ],
    batch03_ocho_editorial_repair: true,
    batch03_berth_count_scrubbed: true,
  }
  return next
}

/** Draft carries facts/politics; stage24 apply preserves production facts — merge for batch03 only. */
function mergeBatch03DraftCompanionFields(proposed, draft, portRow) {
  const next = proposed
  if (draft.facts && typeof draft.facts === 'object') {
    next.facts = JSON.parse(JSON.stringify(draft.facts))
  }
  if (draft.politics && typeof draft.politics === 'object') {
    next.politics = JSON.parse(JSON.stringify(draft.politics))
  }
  if (portRow.landing_slug === 'ocho-rios-jamaica' || portRow.landing_slug === 'kirkenes-norway') {
    next.size = { ...(next.size || {}), ...(draft.size || {}), berthCount: null }
  }
  return next
}

function loadDraftForPort(portRow, existingGuide) {
  if (portRow.corrected_ref) {
    const payload = JSON.parse(fs.readFileSync(path.join(REPO, portRow.corrected_ref), 'utf8'))
    let draft = JSON.parse(JSON.stringify(payload.draft))
    draft.landing_slug = portRow.landing_slug
    if (portRow.patchDraft) draft = portRow.patchDraft(draft)
    return { draft, priorValidation: payload.validation }
  }
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
  if (process.env.SEADAYS_BATCH03_KIRKENES_OCHO !== '1') {
    fail('set SEADAYS_BATCH03_KIRKENES_OCHO=1 for local batch03 candidate prep')
  }
  if (!fs.existsSync(POLICY)) fail('missing BATCH03_POLICY_CLEARANCE.json')
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
    fail(`HEAD ${head} is not descended from catalogue baseline ${BASELINE_MAIN}`)
  }

  const guidesBefore = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guidesBefore)
  const peBefore = countPassengerEditorialGuides(guidesBefore)
  const BASELINE_PE = peBefore
  if (peBefore < 360 || peBefore > 361) fail(`unexpected live PE ${peBefore} (expected 360 or 361 post batch03 ocho)`)

  const prodGuidesHashBefore = sha256File(path.join(REPO, 'data/public-port-guides.json'))
  const rostockHtmlBefore = sha256File(path.join(REPO, 'ports/rostock-germany/index.html'))

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  fs.mkdirSync(rollbackDir, { recursive: true })
  const rollbackRecovery = {
    schema_version: 1,
    recovery_mode: 'production_sha_plus_stage63_slot_snapshots',
    baseline_main: BASELINE_MAIN,
    production_public_port_guides_sha256: prodGuidesHashBefore,
    slot_snapshots: PORTS.map((p) => ({
      landing_slug: p.landing_slug,
      app_port_id: p.app_port_id,
      stage63_production_snapshot_ref: p.stage63_rollback_ref,
    })),
    html_rollback_refs: PORTS.map((p) => `qa-evidence/batch03-kirkenes-ocho-candidate/rollback-pre-apply/ports/${p.landing_slug}/index.html`),
    note: 'Full catalogue rollback omitted — recover via git checkout of data/public-port-guides.json at baseline_main SHA plus per-port HTML files here.',
  }
  fs.writeFileSync(
    path.join(EVIDENCE, 'ROLLBACK_RECOVERY.json'),
    `${JSON.stringify(rollbackRecovery, null, 2)}\n`
  )
  for (const p of PORTS) {
    const htmlSrc = path.join(REPO, 'ports', p.landing_slug, 'index.html')
    if (!fs.existsSync(htmlSrc)) fail(`missing production html ${p.landing_slug}`)
    fs.mkdirSync(path.join(rollbackDir, 'ports', p.landing_slug), { recursive: true })
    fs.copyFileSync(htmlSrc, path.join(rollbackDir, 'ports', p.landing_slug, 'index.html'))
  }

  const portsToRun = PREPARE_ONLY
    ? PORTS.filter((p) => PREPARE_ONLY.includes(p.landing_slug))
    : PORTS
  if (!portsToRun.length) fail('BATCH03_PREPARE_ONLY matched no ports')
  const priorManifest = fs.existsSync(path.join(EVIDENCE, 'BATCH03_PREP_MANIFEST.json'))
    ? JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'BATCH03_PREP_MANIFEST.json'), 'utf8'))
    : null

  const index = loadResearchIndex(INDEX_ROOT)
  const manifestPorts = []
  const gapReport = []
  try {
    for (const portRow of portsToRun) {
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

      const existing = JSON.parse(
        JSON.stringify(guidesBefore.byAppPortId[portRow.app_port_id] || {})
      )
      if (usesPassengerEditorialLead(existing)) {
        fail(`${portRow.landing_slug} already passenger_editorial in production`)
      }

      const { draft } = loadDraftForPort(portRow, existing)
      const manifestRow = {
        landing_slug: portRow.landing_slug,
        app_port_id: portRow.app_port_id,
        sha256: portRow.research_sha256,
        qa_verdict: 'PASS',
        identifier_status: 'resolved',
      }
      const validation = validateEditorialDraft({ draft, manifestRow })
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
          draft_source: 'batch03-local-candidate-prep',
        },
      })
      proposed = mergeBatch03DraftCompanionFields(proposed, draft, portRow)
      proposed = sanitizePassengerGuideSurfaces(proposed)
      proposed = mergeTravelerQuestions(BY_PORT_ROOT, portRow.landing_slug, proposed)
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        publication_tier: 'passenger_editorial_candidate',
        batch03_kirkenes_ocho_conditional_candidate: true,
        batch03_preparation_only: true,
        owner_publication_authorized: false,
        owner_indexing_authorized: false,
        owner_factual_hold_cleared: false,
        not_publication_authorization: true,
        conditional_policy_clearance_ref: 'qa-evidence/batch03-kirkenes-ocho-candidate/BATCH03_POLICY_CLEARANCE.json',
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
      fs.writeFileSync(
        path.join(outBase, 'corrected-draft.json'),
        `${JSON.stringify({ landing_slug: portRow.landing_slug, draft, validation, owner_bucket: ownerBucket }, null, 2)}\n`
      )
      fs.writeFileSync(path.join(outBase, 'proposed-guide.json'), `${JSON.stringify(proposed, null, 2)}\n`)
      fs.copyFileSync(
        path.join(REPO, portRow.stage63_rollback_ref),
        path.join(outBase, 'production-snapshot.json')
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
        research_main_pin: JSON.parse(fs.readFileSync(PATCH, 'utf8')).verified_research_commit,
        proposed_content_hash: proposedContentHash,
        owner_bucket: ownerBucket,
        publication_gates_pass: publicationGatesPass,
        validation_failures: validation.failures,
        validation_warnings: validation.warnings,
        factual_flags: factual.flags || [],
        gates,
        proposed_guide_ref: `qa-evidence/batch03-kirkenes-ocho-candidate/candidate-assets/${portRow.landing_slug}/proposed-guide.json`,
        corrected_draft_ref: `qa-evidence/batch03-kirkenes-ocho-candidate/candidate-assets/${portRow.landing_slug}/corrected-draft.json`,
        production_apply_allowed: false,
        owner_approval_status: 'PENDING',
      })

      gapReport.push({
        landing_slug: portRow.landing_slug,
        outstanding_factual_gaps:
          portRow.landing_slug === 'kirkenes-norway'
            ? [
                'centre_berth_metre_distance_unverified',
                'borderland_museum_hours_tickets_unverified',
                'king_crab_operator_primaries_unverified',
                'berth_decimal_coordinates_null',
                'annual_passengers_unverified',
              ]
            : [
                'paj_berth_lengths_reynolds_assignment_unverified',
                'transfer_metres_to_town_unverified',
                'waterfall_ticket_hours_unverified',
                'beach_operator_primary_unverified',
                'attraction_decimal_coordinates_null',
              ],
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

      const genEnv = {
        ...process.env,
        SEADAYS_BATCH03_KIRKENES_OCHO: '1',
        SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(REPO, '..', 'Seadays-trust-boundary'),
        VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
        VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
        VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
      }
      execSync(`node scripts/generateBlogs.js --ports-only --only=${portRow.landing_slug}`, {
        cwd: REPO,
        stdio: 'pipe',
        env: genEnv,
      })

      const prodHtmlPath = path.join(REPO, 'ports', portRow.landing_slug, 'index.html')
      let prodHtml = fs.readFileSync(prodHtmlPath, 'utf8')
      if (!/noindex/i.test(prodHtml)) {
        prodHtml = replaceRobotsMeta(prodHtml, 'noindex, follow')
        fs.writeFileSync(prodHtmlPath, prodHtml, 'utf8')
      }

      const htmlValFull = validateGeneratedPortHtml(prodHtml, { slug: portRow.landing_slug, previewFragment: false })
      const appliedDir = path.join(EVIDENCE, 'candidate-applied', 'ports', portRow.landing_slug)
      fs.mkdirSync(appliedDir, { recursive: true })
      fs.copyFileSync(prodHtmlPath, path.join(appliedDir, 'index.html'))
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
    /* research root is live by_port tree */
  }

  execSync('git checkout -- data/public-port-guides.json', { cwd: REPO, stdio: 'pipe' })
  const restorePorts = PREPARE_ONLY ? portsToRun : PORTS
  for (const p of restorePorts) {
    fs.copyFileSync(
      path.join(rollbackDir, 'ports', p.landing_slug, 'index.html'),
      path.join(REPO, 'ports', p.landing_slug, 'index.html')
    )
  }

  const peAfter = countPassengerEditorialGuides(loadPublicPortGuidesFile(REPO))
  const prodGuidesHashAfter = sha256File(path.join(REPO, 'data/public-port-guides.json'))
  const rostockHtmlAfter = sha256File(path.join(REPO, 'ports/rostock-germany/index.html'))

  if (peAfter !== BASELINE_PE) fail(`PE after restore ${peAfter} !== ${BASELINE_PE}`)
  if (prodGuidesHashAfter !== prodGuidesHashBefore) fail('public-port-guides.json not restored to baseline hash')
  if (rostockHtmlAfter !== rostockHtmlBefore) fail('rostock-germany redirect html changed')

  const bundlePayload = {
    schema_version: 1,
    stage: 'batch03-kirkenes-ocho-candidate-prep',
    status: manifestPorts.every((p) => p.publication_gates_pass && p.full_html_gates_pass)
      ? 'READY_FOR_OWNER_FACTUAL_REVIEW'
      : 'PARTIAL',
    owner_publication_authorized: false,
    owner_indexing_authorized: false,
    owner_factual_hold_cleared: false,
    production_apply_permitted: false,
    candidate_apply_permitted: false,
    baseline_main: BASELINE_MAIN,
    baseline_live_passenger_editorial: BASELINE_PE,
    worktree_head_after_restore: execSync('git rev-parse HEAD', { cwd: REPO, encoding: 'utf8' }).trim(),
    production_guides_sha256_preserved: prodGuidesHashBefore,
    ports:
      priorManifest && PREPARE_ONLY
        ? priorManifest.ports.map((row) => {
            const updated = manifestPorts.find((p) => p.landing_slug === row.landing_slug)
            return updated || row
          })
        : manifestPorts,
    policy_ref: 'qa-evidence/batch03-kirkenes-ocho-candidate/BATCH03_POLICY_CLEARANCE.json',
    composite_sha_patch_ref: 'qa-evidence/batch03-kirkenes-ocho-candidate/COMPOSITE_SHA_PATCH.json',
    created_at_utc: new Date().toISOString(),
  }
  bundlePayload.bundle_idempotency_hash = crypto
    .createHash('sha256')
    .update(stableStringify(bundlePayload))
    .digest('hex')

  fs.writeFileSync(path.join(EVIDENCE, 'BATCH03_PREP_MANIFEST.json'), `${JSON.stringify(bundlePayload, null, 2)}\n`)
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

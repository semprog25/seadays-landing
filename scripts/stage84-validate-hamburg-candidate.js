#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage84-hamburg-graduation')
const LANDING_SLUG = 'hamburg-germany'
const APP_PORT_ID = 'hamburg'

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

function main() {
  const prep = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE84_PREP_MANIFEST.json'), 'utf8'))
  const candidate = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE84_PUBLICATION_MANIFEST.json'), 'utf8'))
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
  if (prep.bundle_idempotency_hash !== apply.bundle_hash) throw new Error('bundle hash mismatch')
  if (candidate.preparation_bundle_hash !== apply.bundle_hash) throw new Error('candidate bundle mismatch')
  if (candidate.owner_publication_authorized !== false) throw new Error('owner_publication_authorized must be false')
  if (candidate.owner_indexing_authorized !== false) throw new Error('owner_indexing_authorized must be false')

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(rollbackDir, 'public-port-guides.json'), 'utf8'))
  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  removeStage65ExcludedGuideEntries(rollbackGuides)

  const peCount = countPassengerEditorialGuides(guides)
  if (peCount !== 356) throw new Error(`expected 356 passenger_editorial, got ${peCount}`)
  const baselinePe = countPassengerEditorialGuides(rollbackGuides)
  if (baselinePe !== 355) throw new Error(`rollback baseline expected 355, got ${baselinePe}`)

  const mutated = []
  for (const [id, before] of Object.entries(rollbackGuides.byAppPortId || {})) {
    const after = guides.byAppPortId?.[id]
    if (after && sha(before) !== sha(after)) mutated.push(id)
  }
  if (mutated.length !== 1 || mutated[0] !== APP_PORT_ID) {
    throw new Error(`expected only hamburg mutation, got: ${mutated.join(',')}`)
  }

  const hamburg = guides.byAppPortId[APP_PORT_ID]
  if (hamburg.researchImport?.publication_tier !== 'passenger_editorial') {
    throw new Error('missing passenger_editorial tier')
  }
  if (hamburg.researchImport?.stage84_hamburg_graduation_candidate !== true) {
    throw new Error('missing stage84 marker')
  }
  if (hamburg.researchImport?.research_sha256 !== prep.research_sha256) {
    throw new Error('research_sha256 mismatch on guide')
  }
  if (hamburg.researchImport?.qa_verdict !== 'PASS') throw new Error('qa_verdict must be PASS')

  const leak = JSON.stringify({
    portInfo: hamburg.portInfo,
    gettingThere: hamburg.gettingThere,
    thingsToDo: hamburg.thingsToDo,
  })
  if (containsInternalResearchLeak(leak)) throw new Error('json internal research leak')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) throw new Error('indexing must stay noindex until owner_indexing_authorized')
  if (!html.includes('/ports/hamburg-germany/')) throw new Error('canonical path missing')
  const duplicateDirs = fs
    .readdirSync(path.join(REPO, 'ports'), { withFileTypes: true })
    .filter((d) => d.isDirectory() && /^hamburg/i.test(d.name))
  if (duplicateDirs.length !== 1 || duplicateDirs[0].name !== 'hamburg-germany') {
    throw new Error(`duplicate hamburg destination dirs: ${duplicateDirs.map((d) => d.name).join(',')}`)
  }

  const callPlanCards = (html.match(/<article class="pg-call-plan-card/g) || []).length
  if (callPlanCards < 3) throw new Error(`call-plan cards below 3 (got ${callPlanCards})`)

  const mainHtml = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html
  const terminalCards = (mainHtml.match(/<div class="pg-terminal-card/g) || []).length
  if (terminalCards < 4) throw new Error(`terminal cards below 4 (got ${terminalCards})`)
  const mapPins = (html.match(/"slug":"cruise-center|"slug":"baakenhoeft"/g) || []).length
  if (mapPins < 4) throw new Error(`terminal map pins below 4 (got ${mapPins})`)

  if (!/viator\.com/i.test(html) || !/campaign=seadays-web-phamburg/i.test(html)) {
    throw new Error('Viator tracking missing')
  }
  if (containsInternalResearchLeak(html)) throw new Error('html internal research leak')
  if (/\[S\d+\]/.test(html)) throw new Error('research citation marker in html')

  const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || ''
  const v = validateGeneratedPortHtml(html, {
    slug: LANDING_SLUG,
    previewFragment: false,
    expectTerminalMap: /id="port-terminal-map"/.test(main),
  })
  if (!v.ok) throw new Error(`html validation: ${v.issues.join(';')}`)

  const out = {
    validated_at_utc: new Date().toISOString(),
    landing_slug: LANDING_SLUG,
    passenger_editorial_count: peCount,
    baseline_rollback_passenger_editorial: baselinePe,
    call_plan_cards: callPlanCards,
    terminal_cards: terminalCards,
    robots: 'noindex, follow',
    research_sha256: prep.research_sha256,
    qa_verdict: 'PASS',
    ok: true,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(out, null, 2))
}

main()

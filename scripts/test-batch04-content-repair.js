#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { assertBatch03KirkenesReleaseBinding } = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')
const { assertBatch03OchoRiosReleaseInvariants } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview')
const { TOKYO_PASSENGER_LEAD } = require('./lib/bulkPortPublication/tokyoYokohamaPassengerPatch')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch04')
const BASELINE_MAIN = process.env.CONTENT_REPAIR_BASELINE_MAIN || 'dea758c809c1e8624e99e3248793f987c8d5feb7'
const EXPECTED_PE = 362
const RESEARCH_SHA = '7e1a1016bff4d827fe7fa1246531b3c242a8b9d5584b0c0126e917e3fbf6d017'

const FORBIDDEN_RE = [
  /quay LOA/i,
  /captured TPTC/i,
  /Visa-free for US, EU, UK/i,
  /15-90 days/i,
  /terminalCount/i,
  /berthCount:\s*12/i,
  /Daikoku Pier/i,
  /5-15 minutes depending on pier/i,
  /Within Yokohama city/i,
]

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function headJsonLdTypes(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0]
  const types = []
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(head))) {
    try {
      types.push(JSON.parse(m[1].trim())['@type'])
    } catch {
      /* skip */
    }
  }
  return types
}

function assertSurfaceClean(label, text) {
  const s = String(text || '')
  assert.ok(!containsInternalResearchLeak(s), `${label} research leak`)
  for (const re of FORBIDDEN_RE) {
    assert.ok(!re.test(s), `${label} forbidden pattern ${re}`)
  }
}

function main() {
  execSync(`git merge-base --is-ancestor ${BASELINE_MAIN} HEAD`, { cwd: REPO, stdio: 'pipe' })

  const manifestPath = path.join(EVIDENCE, 'BATCH04_PREP_MANIFEST.json')
  assert.ok(fs.existsSync(manifestPath), 'run batch04 prepare first')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.owner_indexing_authorized, false)
  assert.strictEqual(manifest.owner_factual_hold_cleared, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.baseline_live_passenger_editorial, EXPECTED_PE)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  assert.strictEqual(countPassengerEditorialGuides(guides), EXPECTED_PE)
  assertBatch03KirkenesReleaseBinding(REPO, guides)
  assertBatch03OchoRiosReleaseInvariants(REPO, guides)

  const tokyoRow = manifest.ports.find((p) => p.landing_slug === 'tokyo-yokohama-japan')
  assert.ok(tokyoRow, 'tokyo manifest row')
  assert.strictEqual(tokyoRow.research_sha256, RESEARCH_SHA)
  assert.strictEqual(tokyoRow.owner_bucket, 'READY_FOR_OWNER_APPROVAL')
  assert.strictEqual(tokyoRow.publication_gates_pass, true)
  assert.strictEqual(tokyoRow.owner_factual_hold_cleared, false)

  const proposedPath = path.join(REPO, tokyoRow.proposed_guide_ref)
  const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
  assert.strictEqual(proposed.appPortId, 'yokohama')
  assert.strictEqual(proposed.researchImport?.landing_slug, 'tokyo-yokohama-japan')
  assert.strictEqual(proposed.researchImport?.research_sha256, RESEARCH_SHA)
  assert.strictEqual(proposed.researchImport?.owner_publication_authorized, false)
  assert.strictEqual(proposed.researchImport?.owner_factual_hold_cleared, false)
  assert.strictEqual(proposed.portName, 'Tokyo / Yokohama')
  assert.ok(proposed.portInfo?.description?.startsWith(TOKYO_PASSENGER_LEAD.slice(0, 40)))
  assert.strictEqual(proposed.size, undefined)

  const blob = collectGuidePassengerLeakBlob(proposed)
  assertSurfaceClean('proposed', blob)
  assert.ok(!/Daikoku/i.test(blob))

  const corrected = JSON.parse(
    fs.readFileSync(path.join(REPO, tokyoRow.corrected_draft_ref), 'utf8')
  )
  const scan = scanDraftFields(corrected.draft)
  const bucket = classifyOwnerBucket({
    validationOk: corrected.validation.ok,
    supportedAttractions: (corrected.draft.thingsToDo?.topThings || []).length,
    scan,
    unresolved: corrected.draft.researchImport?.unresolved_claims,
    editorialFailures: corrected.validation.failures,
  })
  assert.strictEqual(bucket, 'READY_FOR_OWNER_APPROVAL')

  const appliedHtml = fs.readFileSync(
    path.join(EVIDENCE, 'candidate-applied/ports/tokyo-yokohama-japan/index.html'),
    'utf8'
  )
  assert.ok(/noindex/i.test(appliedHtml), 'candidate html stays noindex')
  assertSurfaceClean('applied_html', appliedHtml)
  assert.ok(headJsonLdTypes(appliedHtml).includes('FAQPage'))
  assert.ok(headJsonLdTypes(appliedHtml).includes('TouristDestination'))
  assert.ok(/Tokyo \/ Yokohama|Tokyo \(Yokohama\)/i.test(appliedHtml))
  assert.ok(!/Within Yokohama city/.test(appliedHtml))

  const prodHtml = fs.readFileSync(path.join(REPO, 'ports/tokyo-yokohama-japan/index.html'), 'utf8')
  const prodHash = sha256File(path.join(EVIDENCE, 'rollback-pre-apply/ports/tokyo-yokohama-japan/index.html'))
  assert.strictEqual(sha256File(path.join(REPO, 'ports/tokyo-yokohama-japan/index.html')), prodHash, 'production html unchanged on disk')

  const yokohama = guides.byAppPortId.yokohama
  assert.notStrictEqual(yokohama?.researchImport?.publication_tier, 'passenger_editorial')

  console.log(JSON.stringify({ ok: true, manifest_status: manifest.status, pe: EXPECTED_PE }))
}

main()

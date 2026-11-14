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
const { assertBatch03KirkenesReleaseInvariants } = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')
const { assertBatch03OchoRiosReleaseInvariants } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')
const { assertBatch04TokyoReleaseBinding, RELEASE_PE } = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { FREEPORT_LEAD } = require('./lib/bulkPortPublication/batch05ResearchQaPassengerPatches')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch05')
const BASELINE_MAIN = process.env.CONTENT_REPAIR_BASELINE_MAIN || '5da04ec12cb7be9bc82242a1fb421f4d0ddde7ad'
const EXPECTED_PE = 363
const ALLOWED = new Set([
  'freeport-bahamas',
  'ko-samui-thailand',
  'new-mangalore-india',
  'phuket-thailand',
])

const RESEARCH_SHA = {
  'freeport-bahamas': 'b907bbecbd618dc401ab544899c0f7c9053b7e1a1291153989d7ddfbe309135d',
  'ko-samui-thailand': '6c3e039f39c77b559d8b8a311da9ac17f7ec28708e64a94a7346cba428924aff',
  'new-mangalore-india': 'dd8423f9ede431663f03b75ae944a21953f72068f3052845c06b3697ea0e1c67',
  'phuket-thailand': 'debb95baed938dfb3b1fe5bfaaa5318851a517714d4d9b12498b3f2532f67b3b',
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function assertSurfaceClean(label, text) {
  const s = String(text || '')
  assert.ok(!containsInternalResearchLeak(s), `${label} research leak`)
}

function main() {
  execSync(`git merge-base --is-ancestor ${BASELINE_MAIN} HEAD`, { cwd: REPO, stdio: 'pipe' })

  const policy = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'BATCH05_RESEARCH_QA_POLICY.json'), 'utf8'))
  const validationPath = path.join(EVIDENCE, 'research-qa/BATCH05_RESEARCH_QA_VALIDATION.json')
  assert.ok(fs.existsSync(validationPath), 'run batch05-research-qa-validate.js')
  assert.strictEqual(policy.owner_publication_authorized, false)
  assert.strictEqual(policy.baseline_live_passenger_editorial, EXPECTED_PE)

  const manifestPath = path.join(EVIDENCE, 'BATCH05_PREP_MANIFEST.json')
  assert.ok(fs.existsSync(manifestPath), 'run batch05 prepare first')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  const validation = JSON.parse(fs.readFileSync(validationPath, 'utf8'))
  assert.strictEqual(validation.blocked_count, manifest.ports.length)
  assert.strictEqual(manifest.baseline_live_passenger_editorial, EXPECTED_PE)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  assert.strictEqual(pe, RELEASE_PE)
  assertBatch04TokyoReleaseBinding(REPO, guides)
  assertBatch03KirkenesReleaseInvariants(REPO, guides)
  assertBatch03OchoRiosReleaseInvariants(REPO, guides)

  for (const row of manifest.ports) {
    assert.ok(ALLOWED.has(row.landing_slug), `unexpected slug ${row.landing_slug}`)
    assert.strictEqual(row.research_qa_verdict, 'BLOCKED')
    assert.strictEqual(row.research_sha256, RESEARCH_SHA[row.landing_slug])
    assert.strictEqual(row.owner_factual_hold_cleared, false)
    assert.ok(row.publication_gates_pass, `${row.landing_slug} publication gates`)
    assert.ok(row.full_html_gates_pass, `${row.landing_slug} html gates`)

    const proposed = JSON.parse(fs.readFileSync(path.join(REPO, row.proposed_guide_ref), 'utf8'))
    assert.strictEqual(proposed.researchImport?.owner_publication_authorized, false)
    assert.strictEqual(proposed.researchImport?.batch05_preparation_only, true)
    assert.strictEqual(proposed.researchImport?.research_qa_verdict, 'BLOCKED')
    assertSurfaceClean(row.landing_slug, collectGuidePassengerLeakBlob(proposed))

    if (row.landing_slug === 'freeport-bahamas') {
      assert.ok(proposed.portInfo?.description?.startsWith(FREEPORT_LEAD.slice(0, 40)))
    }

    const candHtml = path.join(
      EVIDENCE,
      'candidate-applied',
      'ports',
      row.landing_slug,
      'index.html',
    )
    assert.ok(fs.existsSync(candHtml), candHtml)
    const html = fs.readFileSync(candHtml, 'utf8')
    assert.ok(/noindex/i.test(html), `${row.landing_slug} candidate html must stay noindex`)
    const val = validateGeneratedPortHtml(html, { slug: row.landing_slug, previewFragment: false })
    assert.ok(val.ok, `${row.landing_slug} html validation: ${JSON.stringify(val.issues)}`)
    assertSurfaceClean(`${row.landing_slug}-html`, html)
  }

  const prodHash = sha256File(path.join(REPO, 'data/public-port-guides.json'))
  assert.strictEqual(prodHash, manifest.production_guides_sha256_preserved)

  const backlogPath = path.join(EVIDENCE, 'BATCH05_COHORT_BACKLOG.json')
  assert.ok(fs.existsSync(backlogPath), 'missing cohort backlog')
  const backlog = JSON.parse(fs.readFileSync(backlogPath, 'utf8'))
  assert.strictEqual(backlog.repaired_count, manifest.ports.length)
  assert.ok(backlog.remaining_research_blocked.length >= 4)

  console.log(JSON.stringify({ ok: true, pe, ports: manifest.ports.length, status: manifest.status }, null, 2))
}

main()

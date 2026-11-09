#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage73-publication-25')
const EXPECTED_BUNDLE = '0e115b7f34302350026a532e8c8f9add4bb9965e77584894181059f80f0f0f8b'

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

function assertHtmlUnchanged(slug, rollbackDir) {
  const live = path.join(REPO, 'ports', slug, 'index.html')
  const snap = path.join(rollbackDir, 'ports', slug, 'index.html')
  if (!fs.existsSync(live) || !fs.existsSync(snap)) return
  const before = fs.readFileSync(snap, 'utf8')
  const after = fs.readFileSync(live, 'utf8')
  if (before !== after) throw new Error(`${slug} HTML changed during publication candidate apply`)
  const cards = (after.match(/pg-call-plan-card/g) || []).length
  if (cards < 3) throw new Error(`${slug} call-plan cards below 3 (got ${cards})`)
}

function main() {
  const prepManifest = JSON.parse(fs.readFileSync(path.join(PREP, 'STAGE71_MANIFEST.json'), 'utf8'))
  const candidate = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE73_PUBLICATION_MANIFEST.json'), 'utf8'))
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
  if (prepManifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) throw new Error('prep bundle mismatch')
  if (apply.bundle_hash !== EXPECTED_BUNDLE) throw new Error('apply bundle mismatch')
  if (candidate.preparation_bundle_hash !== EXPECTED_BUNDLE) throw new Error('candidate bundle mismatch')

  const slugs = apply.slugs.slice().sort()
  if (slugs.length !== 25) throw new Error(`expected 25 slugs in apply report, got ${slugs.length}`)
  if ((candidate.slugs_approved || []).length > 0) throw new Error('slugs_approved must be empty')

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  const rollbackGuides = JSON.parse(
    fs.readFileSync(path.join(rollbackDir, 'public-port-guides.json'), 'utf8')
  )
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
  const terminalsPath = path.join(REPO, 'data/public-port-terminals.json')
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : ''
  const terminalsBeforePath = path.join(rollbackDir, 'public-port-terminals.json')
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : ''
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed')

  const portsBySlug = new Map(prepManifest.ports.map((p) => [p.landing_slug, p]))
  const htmlResults = []
  const unchangedSlugs = []

  for (const slug of ['perfect-day-at-cococay-bahamas', 'oslo-norway', 'kefalonia-greece']) {
    assertHtmlUnchanged(slug, rollbackDir)
  }

  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug)
    const id = row.app_port_id
    const before = rollbackGuides.byAppPortId?.[id]
    const after = guides.byAppPortId?.[id]
    if (!after) throw new Error(`guide missing after apply: ${landingSlug}`)
    if (before && sha(before) === sha(after)) {
      throw new Error(`guide unchanged (expected net-new apply): ${landingSlug}`)
    }
    if (after.researchImport?.publication_tier !== 'passenger_editorial') {
      throw new Error(`missing passenger tier: ${landingSlug}`)
    }
    if (after.researchImport?.stage73_publication_candidate !== true) {
      throw new Error(`missing stage73 candidate marker: ${landingSlug}`)
    }
    const htmlPath = path.join(REPO, 'ports', landingSlug, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf8')
    const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || ''
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${landingSlug}`)
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${landingSlug}`)
    if (/\[S\d+\]/.test(html)) throw new Error(`research marker in html: ${landingSlug}`)
    const v = validateGeneratedPortHtml(html, {
      slug: landingSlug,
      previewFragment: false,
      expectTerminalMap: /id="port-terminal-map"/.test(main),
    })
    htmlResults.push({ landing_slug: landingSlug, ok: v.ok, issues: v.issues })
    if (!v.ok) throw new Error(`html validation ${landingSlug}: ${v.issues.join(';')}`)
  }

  for (const [id, g] of Object.entries(rollbackGuides.byAppPortId || {})) {
    const slug = g.researchImport?.landing_slug
    if (!slug || slugs.includes(slug)) continue
    const after = guides.byAppPortId?.[id]
    if (after && sha(g) !== sha(after)) unchangedSlugs.push(slug)
  }
  if (unchangedSlugs.length) throw new Error(`unrelated guide mutations: ${unchangedSlugs.join(',')}`)

  removeStage65ExcludedGuideEntries(guides)
  const count = countPassengerEditorialGuides(guides)
  if (count !== 344) throw new Error(`expected 344 passenger_editorial on candidate branch, got ${count}`)

  const out = {
    validated_at_utc: new Date().toISOString(),
    slugs,
    bundle_hash: apply.bundle_hash,
    html_results: htmlResults,
    html_pass_count: htmlResults.filter((r) => r.ok).length,
    passenger_editorial_count: count,
    baseline_rollback_passenger_editorial: countPassengerEditorialGuides(rollbackGuides),
    ok: htmlResults.length === 25 && htmlResults.every((r) => r.ok),
  }
  if (!out.ok) process.exit(47)
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(out, null, 2))
}

main()

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
const PREP = path.join(REPO, 'qa-evidence/stage78-five-port-prep')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage78-publication-5')
const PRESERVE_HTML_SLUGS = [
  'perfect-day-at-cococay-bahamas',
  'cape-liberty-bayonne-nj-united-states',
  'oslo-norway',
  'vancouver-bc-canada',
  'kefalonia-greece',
]

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
  const prepManifest = JSON.parse(fs.readFileSync(path.join(PREP, 'STAGE78_PREP_MANIFEST.json'), 'utf8'))
  const candidate = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE78_PUBLICATION_MANIFEST.json'), 'utf8'))
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
  const EXPECTED_BUNDLE = candidate.preparation_bundle_hash
  if (!EXPECTED_BUNDLE) throw new Error('missing preparation_bundle_hash on candidate')
  if (prepManifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) throw new Error('prep bundle mismatch')
  if (apply.bundle_hash !== EXPECTED_BUNDLE) throw new Error('apply bundle mismatch')

  const slugs = apply.slugs.slice().sort()
  if (slugs.length !== 5) throw new Error(`expected 5 slugs in apply report, got ${slugs.length}`)
  if ((candidate.slugs_approved || []).length > 0) throw new Error('slugs_approved must be empty')
  if (candidate.owner_publication_authorized === true) throw new Error('owner_publication_authorized must be false')

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(rollbackDir, 'public-port-guides.json'), 'utf8'))
  const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json')
  const terminalsNow = fs.existsSync(terminalsPath) ? fs.readFileSync(terminalsPath, 'utf8') : ''
  const terminalsBeforePath = path.join(rollbackDir, 'public-port-terminals.json')
  const terminalsBefore = fs.existsSync(terminalsBeforePath) ? fs.readFileSync(terminalsBeforePath, 'utf8') : ''
  if (terminalsNow !== terminalsBefore) throw new Error('terminals json changed')

  const portsBySlug = new Map(prepManifest.ports.map((p) => [p.landing_slug, p]))
  const htmlResults = []
  const unchangedSlugs = []

  for (const slug of PRESERVE_HTML_SLUGS) {
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
    if (after.researchImport?.stage78_publication_candidate !== true) {
      throw new Error(`missing stage76 candidate marker: ${landingSlug}`)
    }
    if (after.researchImport?.owner_publication_authorized === true) {
      throw new Error(`owner_publication_authorized must be false on guide: ${landingSlug}`)
    }
    const htmlPath = path.join(REPO, 'ports', landingSlug, 'index.html')
    if (!fs.existsSync(htmlPath)) throw new Error(`missing html: ${landingSlug}`)
    const html = fs.readFileSync(htmlPath, 'utf8')
    const main = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || ''
    if (!html.includes('pg-call-plan-card')) throw new Error(`html missing cards: ${landingSlug}`)
    if (containsInternalResearchLeak(html)) throw new Error(`html leak: ${landingSlug}`)
    if (/\[S\d+\]/.test(html)) throw new Error(`research marker in html: ${landingSlug}`)
    if (!html.includes('application/ld+json')) throw new Error(`html missing FAQ/schema JSON-LD: ${landingSlug}`)
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
  if (count !== 355) throw new Error(`expected 355 passenger_editorial on candidate branch, got ${count}`)
  const baselineCount = countPassengerEditorialGuides(rollbackGuides)
  if (baselineCount !== 350) throw new Error(`rollback baseline expected 350, got ${baselineCount}`)

  const out = {
    validated_at_utc: new Date().toISOString(),
    slugs,
    bundle_hash: apply.bundle_hash,
    html_results: htmlResults,
    html_pass_count: htmlResults.filter((r) => r.ok).length,
    passenger_editorial_count: count,
    baseline_rollback_passenger_editorial: baselineCount,
    preserved_existing_guide_count: baselineCount,
    ok: htmlResults.length === 5 && htmlResults.every((r) => r.ok),
  }
  if (!out.ok) process.exit(47)
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(out, null, 2))
}

main()

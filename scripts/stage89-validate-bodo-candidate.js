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
const { STAGE43_HARD_EXCLUDE_HISTORICAL } = require('./lib/bulkPortPublication/stage43PublishedBaseline')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate')
const LANDING_SLUG = 'bod-norway'
const APP_PORT_ID = 'bodo'

function sha(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex')
}

function headJsonLdTypeCounts(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0]
  const counts = { TouristDestination: 0, BreadcrumbList: 0, FAQPage: 0 }
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(head))) {
    try {
      const data = JSON.parse(m[1].trim())
      const type = data && data['@type']
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1
    } catch {
      /* skip */
    }
  }
  return counts
}

function main() {
  const prep = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE89_PREP_MANIFEST.json'), 'utf8'))
  const candidate = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'STAGE89_PUBLICATION_MANIFEST.json'), 'utf8'))
  const apply = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), 'utf8'))
  if (prep.bundle_idempotency_hash !== apply.bundle_hash) throw new Error('bundle hash mismatch')
  if (candidate.owner_publication_authorized !== false) throw new Error('owner_publication_authorized must be false')
  if (candidate.owner_indexing_authorized !== false) throw new Error('owner_indexing_authorized must be false')
  if (!STAGE43_HARD_EXCLUDE_HISTORICAL.has(LANDING_SLUG)) {
    throw new Error('historical hard-exclude ledger must still list bod-norway')
  }

  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  const rollbackGuides = JSON.parse(fs.readFileSync(path.join(rollbackDir, 'public-port-guides.json'), 'utf8'))
  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  removeStage65ExcludedGuideEntries(rollbackGuides)

  const peCount = countPassengerEditorialGuides(guides)
  if (peCount !== 357) throw new Error(`expected 357 passenger_editorial, got ${peCount}`)
  const baselinePe = countPassengerEditorialGuides(rollbackGuides)
  if (baselinePe !== 356) throw new Error(`rollback baseline expected 356, got ${baselinePe}`)

  const mutated = []
  for (const [id, before] of Object.entries(rollbackGuides.byAppPortId || {})) {
    const after = guides.byAppPortId?.[id]
    if (after && sha(before) !== sha(after)) mutated.push(id)
  }
  if (mutated.length !== 1 || mutated[0] !== APP_PORT_ID) {
    throw new Error(`expected only bodo mutation, got: ${mutated.join(',')}`)
  }

  const bodo = guides.byAppPortId[APP_PORT_ID]
  if (bodo.researchImport?.publication_tier !== 'passenger_editorial') {
    throw new Error('missing passenger_editorial tier')
  }
  if (bodo.researchImport?.stage89_bodo_conditional_candidate !== true) {
    throw new Error('missing stage89 marker')
  }
  if (bodo.researchImport?.research_sha256 !== prep.research_sha256) {
    throw new Error('research_sha256 mismatch on guide')
  }
  if (bodo.researchImport?.qa_verdict !== 'PASS') throw new Error('qa_verdict must be PASS')

  const hamburgBefore = rollbackGuides.byAppPortId.hamburg
  const hamburgAfter = guides.byAppPortId.hamburg
  if (sha(hamburgBefore) !== sha(hamburgAfter)) throw new Error('hamburg guide mutated')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  const html = fs.readFileSync(htmlPath, 'utf8')
  if (!/noindex/i.test(html)) throw new Error('indexing must stay noindex until owner_indexing_authorized')
  if (!html.includes('/ports/bod-norway/')) throw new Error('canonical path missing')
  if (!/campaign=seadays-web-sbod-norway/i.test(html)) throw new Error('Viator campaign missing')

  const bodNorwayDir = path.join(REPO, 'ports', LANDING_SLUG)
  if (!fs.existsSync(bodNorwayDir)) throw new Error('missing bod-norway directory')
  const bodNorwayDuplicate = path.join(REPO, 'ports', 'bodo-norway')
  if (fs.existsSync(bodNorwayDuplicate)) throw new Error('duplicate bodo-norway route directory')

  const callPlanCards = (html.match(/<article class="pg-call-plan-card/g) || []).length
  if (callPlanCards < 3) throw new Error(`call-plan cards below 3 (got ${callPlanCards})`)

  const counts = headJsonLdTypeCounts(html)
  if (counts.TouristDestination !== 1) throw new Error('JSON-LD TouristDestination count')
  if (counts.BreadcrumbList !== 1) throw new Error('JSON-LD BreadcrumbList count')
  if (counts.FAQPage !== 1) throw new Error('JSON-LD FAQPage count')

  if (containsInternalResearchLeak(html)) throw new Error('html internal research leak')
  if (/\[S\d+\]/.test(html)) throw new Error('research citation marker in html')
  if (/Saltstraumen/i.test(html) && !/tidal|tide|timing/i.test(html)) {
    throw new Error('Saltstraumen mentioned without tidal safety context')
  }

  const mainHtml = html.match(/<main\b[\s\S]*?<\/main>/i)?.[0] || html
  const v = validateGeneratedPortHtml(html, {
    slug: LANDING_SLUG,
    previewFragment: false,
    expectTerminalMap: /id="port-terminal-map"/.test(mainHtml),
  })
  if (!v.ok) throw new Error(`html validation: ${v.issues.join(';')}`)

  const out = {
    validated_at_utc: new Date().toISOString(),
    landing_slug: LANDING_SLUG,
    passenger_editorial_count: peCount,
    baseline_rollback_passenger_editorial: baselinePe,
    call_plan_cards: callPlanCards,
    json_ld: counts,
    robots: 'noindex, follow',
    research_sha256: prep.research_sha256,
    qa_verdict: 'PASS',
    ok: true,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'RELEASE_VALIDATION.json'), `${JSON.stringify(out, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(out, null, 2))
}

main()

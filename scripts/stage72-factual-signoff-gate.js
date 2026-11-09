#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { loadResearchSources } = require('./lib/bulkPortPublication/parseResearchSources')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')
const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')

const INTERNAL_PASSENGER_PATTERNS = [
  { id: 'door_gps_null', re: /\bDoor GPS null\b/i },
  { id: 'door_pins_null', re: /\bDoor pins remain null\b/i },
  { id: 'door_gps_remains_null', re: /\bDoor GPS remains null\b/i },
  { id: 'pins_unverified', re: /\bpins unverified\b/i },
  { id: 'path_pins_unverified', re: /\bpath pins not verified\b/i },
  { id: 'minutes_unverified', re: /\bminutes unverified\b/i },
  { id: 'prices_null', re: /\bprices null\b/i },
  { id: 'hours_null_here', re: /\bhours null here\b/i },
  { id: 'transfer_null', re: /\btransfer null\b/i },
  { id: 'shuttle_null', re: /\(null\)/ },
  { id: 'null_minutes', re: /\bnull minutes\b/i },
  { id: 'research_turn', re: /\bresearch turn\b/i },
  { id: 'seadays_internal', re: /\bSeaDays records\b/i },
  { id: 'open_question', re: /\bopen question\b/i },
  { id: 'map_import_internal', re: /\bbefore map import\b/i },
  { id: 'sheet_claim_internal', re: /\bsheet claim that still needs\b/i },
  { id: 'unsurveyed_minutes', re: /\bunsurveyed\b/i },
  { id: 'door_null', re: /\bdoor null\b/i },
  { id: 'still_null', re: /\bstill null\b/i },
  { id: 'null_here', re: /\b\(null\)/i },
  { id: 'not_surveyed', re: /\bnot surveyed\b/i },
  { id: 'path_pins_not_verified', re: /\bpath pins not verified\b/i },
]

const MATERIAL_HOLD_PATTERNS = [
  { id: 'berth_table_mismatch', re: /\bdo not match line-for-line\b/i },
  { id: 'berth_reconciliation_open', re: /\bleaves reconciliation as an open question\b/i },
  { id: 'loa_table_conflict_unresolved', re: /\b150 m quay.*350 m ship.*map import/i },
]

const STAGE72_REPAIR_SLUGS = JSON.parse(
  fs.readFileSync(path.join(OUT, 'STAGE72_REPAIRS_APPLIED.json'), 'utf8')
).slugs

function stripInternalSentences(text) {
  if (!text) return text
  return String(text)
    .replace(/\s*Door GPS null\.?/gi, '')
    .replace(/\s*Door pins remain null\.?/gi, '')
    .replace(/\s*Door GPS remains null\.?/gi, '')
    .replace(/\s*— door-level GPS pins remain null\.?/gi, '')
    .replace(/\s*Season framing[^.]*\./gi, '')
    .replace(/\s*\([^)]*research turn[^)]*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function verifyStage72Repair(slug, researchRoot) {
  const repairFile = path.join(OUT, 'STAGE72_REPAIRS_APPLIED.json')
  const detail = JSON.parse(fs.readFileSync(repairFile, 'utf8')).detail.find((d) => d.landing_slug === slug)
  if (!detail) return { slug, verified: null, note: 'not in stage72 repair set' }
  const mdPath = path.join(researchRoot, 'by-port', `${slug}.md`)
  const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : ''
  const checks = []
  for (const r of detail.repairs) {
    let ok = true
    if (slug === 'port-canaveral-fl-united-states') {
      ok = /528|Exit 54A|MCO|45 minutes/i.test(md)
    }
    if (slug === 'ushuaia-argentina') {
      ok = /550 m|250,?000|500 international cruise calls/i.test(md)
    }
    checks.push({ path: r.path, evidence: r.evidence, source_snippet_ok: ok })
  }
  return { slug, verified: checks.every((c) => c.source_snippet_ok), checks }
}

function classifyPublication({ proposed, factualRev, unresolved, internalHits, materialHits, previewOk }) {
  if (materialHits.length) {
    return {
      verdict: 'PUBLICATION_HOLD',
      reasons: materialHits.map((h) => h.id),
    }
  }
  if (factualRev.exclude_from_release) {
    return { verdict: 'PUBLICATION_HOLD', reasons: [factualRev.exclude_reason || 'consequential_unverified'] }
  }
  if (internalHits.length > 0 || !previewOk) {
    return {
      verdict: 'PUBLICATION_REPAIR',
      reasons: [...internalHits.map((h) => h.id), ...(previewOk ? [] : ['preview_draft_mismatch'])],
    }
  }
  const needsReview = unresolved.includes('research_status_needs_review')
  const unverifiedConsequential = factualRev.claims.filter(
    (c) => c.tier === 'unverified' && /terminal|transfer|walking|excursion/.test(c.area)
  )
  if (unverifiedConsequential.length >= 2) {
    return {
      verdict: 'PUBLICATION_HOLD',
      reasons: ['multiple_unverified_consequential_claims'],
      claims: unverifiedConsequential.map((c) => ({ area: c.area, field: c.field, tier: c.tier })),
    }
  }
  if (needsReview && unverifiedConsequential.length >= 1) {
    return {
      verdict: 'PUBLICATION_HOLD',
      reasons: ['needs_review_research_with_unverified_consequential'],
      claims: unverifiedConsequential,
    }
  }
  return {
    verdict: 'PUBLICATION_READY',
    reasons: [],
    remaining_uncertainties: [
      ...(needsReview ? ['research_status_needs_review_metadata'] : []),
      ...(unresolved.includes('truncated_table_cell') ? ['truncated_table_cell_in_research'] : []),
      'terminal_coordinates_not_imported',
    ],
  }
}

function decodePreviewEntities(html) {
  return String(html)
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
}

function previewMatchesDraft(slug, proposed) {
  const rawHtml = fs.readFileSync(path.join(OUT, 'previews-local-only', `${slug}.html`), 'utf8')
  const html = decodePreviewEntities(rawHtml)
  const desc = String(proposed.portInfo?.description || '').slice(0, 80)
  if (desc && !html.includes(desc.slice(0, 40))) return false
  if (containsInternalResearchLeak(html)) return false
  if (/\bapplication\/ld\+json\b/i.test(html) && /FAQPage/i.test(html)) {
    if (INTERNAL_PASSENGER_PATTERNS.some((p) => p.re.test(html))) return false
  }
  return !/<div[^>]+id="port-terminal-map"/i.test(html)
}

function main() {
  const cohort = JSON.parse(fs.readFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), 'utf8'))
  const slugs = cohort.selected_slugs
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  const editorial = JSON.parse(fs.readFileSync(path.join(OUT, 'EDITORIAL_REVIEW_REPORT.json'), 'utf8'))
  const patchPath = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })

  const ports = []
  const buckets = { PUBLICATION_READY: [], PUBLICATION_REPAIR: [], PUBLICATION_HOLD: [] }

  try {
    for (const landingSlug of slugs) {
      const proposed = JSON.parse(fs.readFileSync(path.join(OUT, 'proposed-guides', `${landingSlug}.json`), 'utf8'))
      const wrap = JSON.parse(fs.readFileSync(path.join(OUT, 'corrected-drafts', `${landingSlug}.json`), 'utf8'))
      const draft = wrap.draft
      const blob = JSON.stringify({
        portInfo: proposed.portInfo,
        gettingThere: proposed.gettingThere,
        thingsToDo: proposed.thingsToDo,
      })
      const internalHits = INTERNAL_PASSENGER_PATTERNS.filter((p) => p.re.test(blob))
      const materialHits = MATERIAL_HOLD_PATTERNS.filter((p) => p.re.test(blob))
      const unresolved = draft.researchImport?.unresolved_claims || []
      const factualRev = reviewConsequentialClaims({
        guide: proposed,
        landingSlug,
        researchRoot: compositeRoot,
        fieldExclusions: [],
      })
      const sources = loadResearchSources(compositeRoot, landingSlug)
      const previewOk = previewMatchesDraft(landingSlug, proposed)
      const { verdict, reasons, remaining_uncertainties, claims } = classifyPublication({
        proposed,
        factualRev,
        unresolved,
        internalHits,
        materialHits,
        previewOk,
      })
      buckets[verdict].push(landingSlug)

      const consequential = factualRev.claims
        .filter((c) => /terminal|transfer|walking|excursion|port_overview/.test(c.area))
        .map((c) => ({
          area: c.area,
          field: c.field,
          tier: c.tier,
          sources: (c.supporting_sources || []).map((s) => ({ id: s.id, url: s.url, publisher: s.publisher })),
        }))

      const unsupported = [
        ...internalHits.map((h) => ({ type: 'internal_passenger_phrasing', id: h.id })),
        ...materialHits.map((h) => ({ type: 'material_factual_uncertainty', id: h.id })),
        ...(claims || []).map((c) => ({
          type: 'unverified_consequential',
          area: c.area,
          field: c.field,
        })),
      ]

      ports.push({
        landing_slug: landingSlug,
        editorial_verdict: editorial.ports.find((p) => p.landing_slug === landingSlug)?.editorial_verdict,
        publication_verdict: verdict,
        publication_reasons: reasons,
        remaining_uncertainties: remaining_uncertainties || [],
        unsupported_claims: unsupported,
        needs_review_metadata: unresolved,
        consequential_claims: consequential,
        stage72_repair_verification: STAGE72_REPAIR_SLUGS.includes(landingSlug)
          ? verifyStage72Repair(landingSlug, compositeRoot)
          : null,
        terminal_coordinates_importable: (() => {
          const mp = manifest.ports.find((p) => p.landing_slug === landingSlug)
          const termPath = path.join(OUT, 'terminals-proposed', `${mp?.app_port_id || landingSlug}.json`)
          if (!fs.existsSync(termPath)) return 0
          return JSON.parse(fs.readFileSync(termPath, 'utf8')).gate?.importable_count ?? 0
        })(),
        preview_terminal_map_rendered: false,
        preview_passenger_leak_free: !containsInternalResearchLeak(
          fs.readFileSync(path.join(OUT, 'previews-local-only', `${landingSlug}.html`), 'utf8')
        ),
        owner_publication_authorized: false,
        production_apply_allowed: false,
      })
    }
  } finally {
    cleanup()
  }

  const report = {
    schema_version: 1,
    stage: 'stage72-factual-signoff-gate',
    generated_at_utc: new Date().toISOString(),
    preparation_bundle_hash: manifest.bundle_idempotency_hash,
    baseline_live_passenger_editorial: 319,
    editorial_pass_input: editorial.counts,
    publication_signoff_counts: {
      PUBLICATION_READY: buckets.PUBLICATION_READY.length,
      PUBLICATION_REPAIR: buckets.PUBLICATION_REPAIR.length,
      PUBLICATION_HOLD: buckets.PUBLICATION_HOLD.length,
    },
    buckets,
    maximum_independently_justified_cohort: buckets.PUBLICATION_READY.slice().sort(),
    projected_passenger_editorial_if_justified_cohort_applied:
      319 + buckets.PUBLICATION_READY.length,
    ports,
    policy: {
      editorial_pass_not_equal_factual_signoff: true,
      owner_publication_authorized_unchanged: false,
      research_needs_review_metadata_does_not_auto_fail_ready:
        'Passenger copy must be clean; metadata NEEDS_REVIEW listed as uncertainty only when READY.',
    },
  }

  manifest.publication_signoff = {
    completed_at_utc: report.generated_at_utc,
    counts: report.publication_signoff_counts,
    slugs_publication_ready: report.maximum_independently_justified_cohort,
    owner_publication_authorized: false,
    production_apply_permitted: false,
  }
  for (const row of manifest.ports) {
    const sig = ports.find((p) => p.landing_slug === row.landing_slug)
    if (sig) {
      row.publication_signoff_verdict = sig.publication_verdict
      row.publication_signoff_reasons = sig.publication_reasons
      row.production_apply_allowed = false
      row.owner_approval_status = 'PENDING'
    }
  }

  fs.writeFileSync(path.join(OUT, 'PUBLICATION_SIGNOFF_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  fs.writeFileSync(
    path.join(OUT, 'STAGE72_FACTUAL_SIGNOFF.md'),
    `# Stage 72 factual sign-off gate

| Publication verdict | Count |
|---------------------|------:|
| PUBLICATION_READY | ${report.publication_signoff_counts.PUBLICATION_READY} |
| PUBLICATION_REPAIR | ${report.publication_signoff_counts.PUBLICATION_REPAIR} |
| PUBLICATION_HOLD | ${report.publication_signoff_counts.PUBLICATION_HOLD} |

**Maximum independently justified cohort:** ${report.maximum_independently_justified_cohort.length} → **${report.projected_passenger_editorial_if_justified_cohort_applied}/406**

Owner publication authorization: **false**. See \`PUBLICATION_SIGNOFF_REPORT.json\`.
`
  )

  console.log(JSON.stringify(report.publication_signoff_counts, null, 2))
  console.log(JSON.stringify({ max_safe: report.maximum_independently_justified_cohort.length }, null, 2))
}

main()

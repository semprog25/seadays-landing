#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const {
  scanDraftFields,
  beforeAfterCompare,
  summarizeLiveQuality,
  RESEARCH_PHRASING_RE,
} = require('./lib/bulkPortPublication/stage23FieldReview')
const { runFactualRiskChecks } = require('./lib/bulkPortPublication/factualRiskChecks')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')
const { isTruncatedResearchCopy } = require('./lib/researchCopyGuards')
const { resolvePortAffiliateCta } = require('./lib/viatorAffiliate')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')

const HARD_FACTUAL_FLAGS = new Set([
  'unsupported_visa_assertion',
  'unverified_accessibility_claim',
  'unverified_safety_claim',
  'long_distance_excursion_feasibility',
  'conflicting_berth_names',
  'internal_research_language',
  'identifier_collision_group',
])

const INTERNAL_PASSENGER_RE =
  /\b(hours not verified|not verified this pass|not verified for|impact not verified|minutes verified)\b/i

function classifyVerdict(ctx) {
  const { validation, scan, factualRev, factualRisk, materialBetter, termGate, passengerBlob } = ctx
  if (validation.failures.length) {
    return { verdict: 'EDITORIAL_REPAIR_REQUIRED', reasons: validation.failures }
  }
  if (INTERNAL_PASSENGER_RE.test(passengerBlob) || RESEARCH_PHRASING_RE.test(passengerBlob)) {
    return { verdict: 'EDITORIAL_REPAIR_REQUIRED', reasons: ['internal_or_unverified_passenger_phrasing'] }
  }
  if (scan.excluded_fields.length) {
    return {
      verdict: 'EDITORIAL_REPAIR_REQUIRED',
      reasons: scan.excluded_fields.map((e) => `${e.field}:${e.reason}`),
    }
  }
  if (factualRev.exclude_from_release) {
    return { verdict: 'EDITORIAL_HOLD', reasons: [factualRev.exclude_reason || 'consequential_unverified'] }
  }
  const hardFlags = factualRisk.flags.filter((f) => HARD_FACTUAL_FLAGS.has(f))
  if (hardFlags.length) {
    return { verdict: 'EDITORIAL_HOLD', reasons: hardFlags }
  }
  if (!materialBetter) {
    return { verdict: 'EDITORIAL_HOLD', reasons: ['insufficient_material_improvement_vs_production'] }
  }
  const unresolved = ctx.unresolved || []
  if (unresolved.some((u) => /incomplete_capture|collision|terminal_needs_review/.test(u))) {
    return { verdict: 'EDITORIAL_HOLD', reasons: unresolved.filter((u) => /incomplete_capture|collision|terminal_needs_review/.test(u)) }
  }
  const uncertainties = []
  if (unresolved.includes('research_status_needs_review')) {
    uncertainties.push('research_status_needs_review')
  }
  if (unresolved.includes('truncated_table_cell')) {
    uncertainties.push('truncated_table_cell_in_research_metadata')
  }
  if (termGate.importable_count === 0) {
    uncertainties.push('terminal_coordinates_not_importable')
  }
  return { verdict: 'EDITORIAL_PASS', reasons: [], remaining_uncertainties: uncertainties }
}

function main() {
  const cohort = JSON.parse(fs.readFileSync(path.join(OUT, 'COHORT_MANIFEST.json'), 'utf8'))
  const slugs = cohort.selected_slugs
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  const bySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))
  const patchPath = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })

  const rows = []
  const buckets = { EDITORIAL_PASS: [], EDITORIAL_REPAIR_REQUIRED: [], EDITORIAL_HOLD: [] }

  try {
    for (const landingSlug of slugs) {
      const row = bySlug.get(landingSlug)
      const wrap = JSON.parse(fs.readFileSync(path.join(OUT, 'corrected-drafts', `${landingSlug}.json`), 'utf8'))
      const draft = wrap.draft
      const live = JSON.parse(fs.readFileSync(path.join(OUT, 'rollback', `${landingSlug}.production-snapshot.json`), 'utf8'))
      const proposedPath = path.join(OUT, 'proposed-guides', `${landingSlug}.json`)
      const proposed = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))

      const validation = validateEditorialDraft({
        draft,
        manifestRow: { landing_slug: landingSlug, app_port_id: row.app_port_id, research_sha256: row.research_sha256 },
        researchRoot: compositeRoot,
      })
      const scan = scanDraftFields(draft)
      const factualRev = reviewConsequentialClaims({
        guide: proposed,
        landingSlug,
        researchRoot: compositeRoot,
        fieldExclusions: [],
      })
      const factualRisk = runFactualRiskChecks({ draft, manifestRow: row })
      const cmp = beforeAfterCompare(live, draft)
      const materialBetter = cmp.changes.filter((c) => c.change === 'rewritten' || c.change === 'added').length >= 3
      const liveQ = summarizeLiveQuality(live)
      const termPath = path.join(OUT, 'terminals-proposed', `${row.app_port_id}.json`)
      const termGate = fs.existsSync(termPath) ? JSON.parse(fs.readFileSync(termPath)).gate : { importable_count: 0 }

      const passengerBlob = JSON.stringify({
        portInfo: proposed.portInfo,
        gettingThere: proposed.gettingThere,
        thingsToDo: proposed.thingsToDo,
      })
      const viator = resolvePortAffiliateCta({
        port: { name: proposed.portName, slug: landingSlug, appPortId: proposed.appPortId },
      })

      const { verdict, reasons, remaining_uncertainties = [] } = classifyVerdict({
        validation,
        scan,
        factualRev,
        factualRisk,
        materialBetter,
        termGate,
        unresolved: draft.researchImport?.unresolved_claims,
        passengerBlob,
      })

      buckets[verdict].push(landingSlug)
      rows.push({
        landing_slug: landingSlug,
        app_port_id: row.app_port_id,
        country: draft.country,
        editorial_verdict: verdict,
        reasons,
        remaining_uncertainties,
        identity: {
          landing_slug: landingSlug,
          app_port_id: row.app_port_id,
          port_name: draft.portName,
          country: draft.country,
          from_terminal: draft.gettingThere?.fromTerminal,
        },
        call_plans: {
          short: draft.thingsToDo?.shortCall,
          standard: draft.thingsToDo?.standardCall,
          longer: draft.thingsToDo?.longerCall,
        },
        validation_ok: validation.ok,
        validation_warnings: validation.warnings,
        factual_risk_flags: factualRisk.flags,
        consequential_exclude: factualRev.exclude_from_release,
        material_improvement: materialBetter,
        production_quality_before: liveQ,
        compare_summary: cmp.changes.slice(0, 6),
        viator: viator.ok ? { ok: true, search_only: true } : { ok: false, reason: viator.reason || 'unresolved' },
        terminal_gate: {
          importable_count: termGate.importable_count,
          reasons: (termGate.gateReport || []).flatMap((g) => g.reasons || []),
        },
        owner_approval_status: 'PENDING',
        publication_apply_allowed: false,
        leak_scan: !containsInternalResearchLeak(passengerBlob),
        truncated_fields: [
          'portInfo.description',
          'gettingThere.distanceAnswer',
          'thingsToDo.shortCall',
        ].filter((f) => isTruncatedResearchCopy(getNested(proposed, f))),
      })
    }
  } finally {
    cleanup()
  }

  function getNested(obj, dotted) {
    return dotted.split('.').reduce((o, k) => o?.[k], obj)
  }

  const report = {
    schema_version: 1,
    stage: 'stage72-editorial-review-25',
    generated_at_utc: new Date().toISOString(),
    preparation_bundle_hash: manifest.bundle_idempotency_hash,
    baseline_live_passenger_editorial: 319,
    counts: {
      EDITORIAL_PASS: buckets.EDITORIAL_PASS.length,
      EDITORIAL_REPAIR_REQUIRED: buckets.EDITORIAL_REPAIR_REQUIRED.length,
      EDITORIAL_HOLD: buckets.EDITORIAL_HOLD.length,
    },
    buckets,
    ports: rows,
    maximum_safe_publication_cohort: buckets.EDITORIAL_PASS.slice().sort(),
    projected_live_passenger_editorial_if_cohort_applied: 319 + buckets.EDITORIAL_PASS.length,
    policy_notes: [
      'EDITORIAL_PASS does not set owner_publication_authorized or production_apply_allowed.',
      'research_status_needs_review in metadata alone does not confer EDITORIAL_PASS.',
      'Terminal coordinate import gaps are listed as uncertainties, not automatic HOLD.',
    ],
  }

  manifest.editorial_review = {
    stage72_completed_at_utc: report.generated_at_utc,
    counts: report.counts,
    slugs_editorial_pass: report.maximum_safe_publication_cohort,
    owner_publication_authorized: false,
    production_apply_permitted: false,
  }
  for (const portRow of manifest.ports) {
    const rev = rows.find((r) => r.landing_slug === portRow.landing_slug)
    if (rev) {
      portRow.editorial_verdict = rev.editorial_verdict
      portRow.editorial_review_reasons = rev.reasons
      portRow.owner_approval_status = 'PENDING'
      portRow.production_apply_allowed = false
    }
  }

  fs.writeFileSync(path.join(OUT, 'EDITORIAL_REVIEW_REPORT.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  fs.writeFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')

  const md = `# Stage 72 — Editorial review (25 ports)

**Bundle:** \`${manifest.bundle_idempotency_hash}\`  
**Baseline:** 319/406 passenger editorial  
**Verdict:** ${report.counts.EDITORIAL_PASS === 25 ? 'COHORT_EDITORIAL_READY' : 'OWNER_REVIEW_REQUIRED'}

| Bucket | Count |
|--------|------:|
| EDITORIAL_PASS | ${report.counts.EDITORIAL_PASS} |
| EDITORIAL_REPAIR_REQUIRED | ${report.counts.EDITORIAL_REPAIR_REQUIRED} |
| EDITORIAL_HOLD | ${report.counts.EDITORIAL_HOLD} |

**Max safe publication cohort:** ${report.maximum_safe_publication_cohort.length} → projected **${report.projected_live_passenger_editorial_if_cohort_applied}/406**

See \`EDITORIAL_REVIEW_REPORT.json\` for per-slug reasons and uncertainties.
`
  fs.writeFileSync(path.join(OUT, 'STAGE72_OWNER_REPORT.md'), md)

  console.log(JSON.stringify(report.counts, null, 2))
  console.log(JSON.stringify({ projected: report.projected_live_passenger_editorial_if_cohort_applied }, null, 2))
}

main()

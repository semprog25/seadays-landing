'use strict'

const fs = require('fs')
const path = require('path')
const { parseFrontmatter } = require('../portResearchImport/resolveYaml')
const { sha256File } = require('../portResearchImport/verifyResearchSha')

const CRUISE_TERMINAL_TYPES = new Set(['cruise_berth', 'tender_landing', 'tender_landing_approximate'])

/**
 * Owner QA clearance rule (aligned with final/QA_REPORT.md + Nassau PASS pattern):
 * PASS requires at least one official-sourced named cruise/tender terminal OR a readable berth LOA table in body.
 * index qa_verdict is recomputed only when structural gates + evidence gates pass; never manual override.
 */
function parseSourcesTable(body) {
  const rows = []
  const section = body.split(/^## Sources & verification/mi)[1]
  if (!section) return rows
  const tablePart = section.split(/^## /m)[0] || ''
  for (const line of tablePart.split('\n')) {
    if (!line.trim().startsWith('|')) continue
    if (line.includes('---')) continue
    if (/^\|\s*ID\s*\|/i.test(line)) continue
    const cols = line
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean)
    if (cols.length < 6) continue
    rows.push({
      id: cols[0],
      publisher: cols[1],
      url: cols[2],
      accessed: cols[3],
      updated: cols[4],
      claim: cols[5],
    })
  }
  return rows
}

function hasReadableBerthTable(body) {
  const cruiseSection = body.split(/^## Cruise terminals/mi)[1]?.split(/^## /m)[0] || ''
  if (!/\b\d+\s*m\b/i.test(cruiseSection) && !/\bLOA\b/i.test(cruiseSection)) return false
  if (/—\s*\|\s*—/.test(cruiseSection) && !/\d/.test(cruiseSection)) return false
  return /\b\d{2,4}\s*m/i.test(cruiseSection) || /\bLOA\b.*\d/i.test(body)
}

function evaluateTerminals(meta, sources) {
  const terminals = Array.isArray(meta.terminals) ? meta.terminals : []
  const failures = []
  let namedOfficial = 0
  for (const t of terminals) {
    const ft = String(t.facility_type || '')
    const sourceIds = Array.isArray(t.location_source_ids) ? t.location_source_ids : []
    if (!CRUISE_TERMINAL_TYPES.has(ft) && ft !== 'port_area_approximate') continue
    if (CRUISE_TERMINAL_TYPES.has(ft) && sourceIds.length) {
      const linked = sourceIds.every((id) => sources.some((s) => s.id === id && s.url && !/^—$/.test(s.url)))
      if (linked) namedOfficial += 1
    }
    if (ft === 'port_area_approximate' && !sourceIds.length) {
      failures.push('terminal_port_area_without_official_source')
    }
  }
  return { namedOfficial, failures, terminalCount: terminals.length }
}

function evaluateResearchQaGates({ landingSlug, mdPath, indexRow, sourceProbeSummary = null }) {
  const gates = []
  const failures = []

  if (!indexRow) {
    return {
      landing_slug: landingSlug,
      qa_verdict: 'BLOCKED',
      gates: [{ gate: 'index_row', ok: false }],
      failures: ['missing_index_row'],
      index_blocked_reason: null,
    }
  }

  gates.push({
    gate: 'index_baseline_verdict',
    ok: true,
    value: indexRow.qa_verdict,
    blocked_reason: indexRow.blocked_reason || null,
  })

  if (!fs.existsSync(mdPath)) {
    failures.push('missing_by_port_md')
    return {
      landing_slug: landingSlug,
      qa_verdict: 'BLOCKED',
      gates,
      failures,
      index_blocked_reason: indexRow.blocked_reason || null,
    }
  }

  const raw = fs.readFileSync(mdPath, 'utf8')
  let meta = {}
  let body = raw
  try {
    const parsed = parseFrontmatter(raw)
    meta = parsed.meta || {}
    body = parsed.body || ''
    gates.push({ gate: 'yaml_parse', ok: true })
  } catch (err) {
    gates.push({ gate: 'yaml_parse', ok: false, error: String(err.message || err) })
    failures.push('yaml_parse_error')
  }

  const diskSha = sha256File(mdPath)
  const shaOk = diskSha === indexRow.sha256
  gates.push({
    gate: 'research_sha_match_index',
    ok: shaOk,
    expected: indexRow.sha256,
    actual: diskSha,
  })
  if (!shaOk) failures.push('research_sha_mismatch')

  const sources = parseSourcesTable(body)
  const term = evaluateTerminals(meta, sources)
  gates.push({
    gate: 'official_cruise_terminal_binding',
    ok: term.namedOfficial >= 1,
    named_official_terminals: term.namedOfficial,
    detail: term.failures,
  })
  if (term.namedOfficial < 1) failures.push('no_official_cruise_terminal_source_binding')

  const berthTable = hasReadableBerthTable(body)
  gates.push({ gate: 'readable_berth_loa_primary', ok: berthTable })
  if (!berthTable) failures.push('missing_readable_berth_loa_primary')

  const evidencePass = term.namedOfficial >= 1 || berthTable
  gates.push({ gate: 'consequential_terminal_evidence', ok: evidencePass })
  if (!evidencePass) failures.push('terminal_or_transit_facts_unverified')

  const probeClearsBlock =
    sourceProbeSummary?.consequential_claim_supported === true &&
    sourceProbeSummary?.confidence === 'high'
  gates.push({
    gate: 'targeted_source_verification',
    ok: probeClearsBlock || berthTable,
    probe: sourceProbeSummary,
  })
  if (indexRow.qa_verdict === 'BLOCKED' && !berthTable && !probeClearsBlock) {
    failures.push('owner_index_blocked_reason_unresolved')
  }

  const qaVerdict =
    evidencePass && shaOk && berthTable && failures.filter((f) => f !== 'owner_index_blocked_reason_unresolved').length === 0
      ? 'PASS'
      : probeClearsBlock && evidencePass && shaOk
        ? 'PASS'
        : 'BLOCKED'

  return {
    landing_slug: landingSlug,
    qa_verdict: qaVerdict,
    gates,
    failures,
    index_blocked_reason: indexRow.blocked_reason || null,
    index_baseline_verdict: indexRow.qa_verdict,
    recomputed_verdict: qaVerdict,
    verdict_aligned_with_index: qaVerdict === (indexRow.qa_verdict || 'BLOCKED'),
    research_sha256: diskSha,
  }
}

module.exports = {
  evaluateResearchQaGates,
  parseSourcesTable,
  hasReadableBerthTable,
}

#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { loadResearchIndex } = require('./lib/portResearchImport/buildIdentifierManifest')
const { evaluateResearchQaGates } = require('./lib/bulkPortPublication/evaluateResearchQaGates')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/content-repair-batch05')
const OUT = path.join(EVIDENCE, 'research-qa')
const PORTS = [
  { landing_slug: 'freeport-bahamas', app_port_id: 'freeport' },
  { landing_slug: 'ko-samui-thailand', app_port_id: 'ko-samui' },
  { landing_slug: 'new-mangalore-india', app_port_id: 'new-mangalore' },
  { landing_slug: 'phuket-thailand', app_port_id: 'ko-phuket' },
]

const INDEX_SOURCE =
  process.env.PORT_RESEARCH_INDEX_SOURCE ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06/final/PORTS_MASTER_INDEX.json'
const BY_PORT_ROOT =
  process.env.PORT_RESEARCH_BY_PORT_ROOT ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06'

const SOURCE_PROBES = path.join(OUT, 'SOURCE_VERIFICATION_2026-11-13.json')

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX_SOURCE, 'utf8'))
  const bySlug = new Map((index.ports || []).map((p) => [p.slug, p]))
  const sourceProbes = fs.existsSync(SOURCE_PROBES)
    ? JSON.parse(fs.readFileSync(SOURCE_PROBES, 'utf8'))
    : { probes: [] }
  const probeBySlug = new Map(sourceProbes.probes.map((p) => [p.landing_slug, p]))

  const rows = []
  for (const port of PORTS) {
    const indexRow = bySlug.get(port.landing_slug)
    const baselineMdPath = path.join(BY_PORT_ROOT, 'by-port', `${port.landing_slug}.md`)
    const overlayPath = path.join(EVIDENCE, 'research-repairs/by-port', `${port.landing_slug}.md`)
    const repairPath = fs.existsSync(overlayPath) ? overlayPath : null
    const mdPath = repairPath || baselineMdPath

    const probe = probeBySlug.get(port.landing_slug)
    const probeSummary = probe
      ? {
          consequential_claim_supported: probe.consequential_claim_supported,
          confidence: probe.confidence,
          url: probe.url,
        }
      : null

    let baselineDeliverable = null
    if (repairPath) {
      baselineDeliverable = evaluateResearchQaGates({
        landingSlug: port.landing_slug,
        mdPath: baselineMdPath,
        indexRow,
        sourceProbeSummary: probeSummary,
      })
    }

    const evaluation = evaluateResearchQaGates({
      landingSlug: port.landing_slug,
      mdPath,
      indexRow: repairPath
        ? { ...indexRow, sha256: require('./lib/portResearchImport/verifyResearchSha').sha256File(repairPath) }
        : indexRow,
      sourceProbeSummary: probeSummary,
    })

    rows.push({
      landing_slug: port.landing_slug,
      app_port_id: port.app_port_id,
      ...evaluation,
      deliverable_baseline: baselineDeliverable,
      source_verification: probeBySlug.get(port.landing_slug) || null,
      research_repair_overlay: repairPath ? { path: path.relative(REPO, repairPath) } : null,
      mechanical_note: baselineDeliverable?.failures?.includes('yaml_parse_error')
        ? 'deliverable unverified_fields flow-seq brackets require quoted strings; overlay fixes YAML for validation'
        : null,
    })
  }

  const payload = {
    schema_version: 1,
    stage: 'content-repair-batch05-research-qa',
    validated_at_utc: new Date().toISOString(),
    index_source: INDEX_SOURCE,
    by_port_root: BY_PORT_ROOT,
    authoritative_rule:
      'qa_verdict PASS only when official cruise/tender terminal source binding OR readable berth LOA primary; index row not edited manually',
    pass_count: rows.filter((r) => r.qa_verdict === 'PASS').length,
    blocked_count: rows.filter((r) => r.qa_verdict === 'BLOCKED').length,
    ports: rows,
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'BATCH05_RESEARCH_QA_VALIDATION.json'), `${JSON.stringify(payload, null, 2)}\n`)

  console.log(
    JSON.stringify(
      {
        ok: true,
        pass: payload.pass_count,
        blocked: payload.blocked_count,
        ports: rows.map((r) => ({ slug: r.landing_slug, verdict: r.qa_verdict, failures: r.failures })),
      },
      null,
      2
    )
  )
}

main()

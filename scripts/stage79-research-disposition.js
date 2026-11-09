#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage79-research-27')
const INDEX =
  process.env.PORT_RESEARCH_INDEX_SOURCE ||
  '/Users/sharanestone/Downloads/seadays-ports-deliverables-2026-11-06/final/PORTS_MASTER_INDEX.json'

const PUBLISHED_IDENTITY_WIRED = new Set([
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
])

const CATEGORY_C = [
  'adabya-egypt',
  'bangkok-laem-chabang-thailand',
  'buenos-aires-argentina',
  'chennai-india',
  'freeport-bahamas',
  'ko-samui-thailand',
  'new-mangalore-india',
  'phuket-thailand',
]

const IDENTITY_D = [
  'anchorage-ak-united-states',
  'balestrand-norway',
  'gythion-greece',
  'halong-bay-vietnam',
  'houston-tx-united-states',
  'jakarta-indonesia',
  'khasab-oman',
  'kolkata-india',
  'kuwait-city-kuwait',
  'lima-callao-peru',
  'manila-philippines',
  'monemvasia-greece',
  'naxos-greece',
  'port-blair-india',
  'porto-cervo-italy',
  'sharjah-united-arab-emirates',
  'tianjin-beijing-china',
  'visakhapatnam-india',
  'xiamen-china',
]

const URL_PROBE_UTC = '2026-11-09T20:40:00.000Z'

function dispositionForBlockedReason(reason, researchStatus) {
  const r = String(reason || '').toLowerCase()
  if (researchStatus === 'blocked') return 'STILL_BLOCKED'
  if (/tls|403|404|504|unread|launching soon|no readable/i.test(r)) return 'NEEDS_OWNER_EVIDENCE'
  if (/not corroborated|≠|container-only|no current cruise|no named cruise|planning study|bulk\/cargo/i.test(r)) {
    return 'STILL_BLOCKED'
  }
  return 'NEEDS_OWNER_EVIDENCE'
}

function main() {
  const index = JSON.parse(fs.readFileSync(INDEX, 'utf8'))
  const indexBySlug = new Map((index.ports || []).map((p) => [p.slug, p]))
  const patchPath = path.join(REPO, 'qa-evidence/stage78-five-port-prep/COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  const elig = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot })
  const eligBySlug = new Map(elig.ports.map((p) => [p.landing_slug, p]))

  const rows = []
  try {
    for (const landingSlug of [...IDENTITY_D, ...CATEGORY_C]) {
      const idxRow = indexBySlug.get(landingSlug)
      const e = eligBySlug.get(landingSlug)
      const stage79 = dispositionForBlockedReason(idxRow?.blocked_reason, idxRow?.research_status)
      const shaCheck = verifyResearchPortSha({
        landingRepoRoot: REPO,
        researchRoot: compositeRoot,
        landingSlug,
      })
      rows.push({
        landing_slug: landingSlug,
        cohort: CATEGORY_C.includes(landingSlug) ? 'C' : 'D',
        stage79_disposition: stage79,
        failing_research_gate: 'qa_verdict_BLOCKED',
        index_blocked_reason: idxRow?.blocked_reason || null,
        research_status: idxRow?.research_status || null,
        identity_verified_mapping: IDENTITY_D.includes(landingSlug),
        recoverable_with_approved_sources: false,
        proposed_research_pr: null,
        sha_verification: shaCheck?.ok === true ? 'PASS' : shaCheck?.reason || 'unknown',
        eligibility_qa_verdict: e?.qa_verdict || null,
        note:
          stage79 === 'NEEDS_OWNER_EVIDENCE'
            ? 'Authoritative primary still unread or thin — owner may supply port PDF, Wayback capture, or on-site audit before research PR'
            : 'Structural gap in approved research — do not promote qa_verdict PASS without new primary evidence',
      })
    }
  } finally {
    cleanup()
  }

  const summary = {
    generated_at_utc: new Date().toISOString(),
    production_main_sha: '0d1d845345b191e2b44ecd393062213e88fd3946',
    live_passenger_editorial: 355,
    research_blocked_ports: 27,
    recovered: rows.filter((r) => r.stage79_disposition === 'RECOVERED').length,
    still_blocked: rows.filter((r) => r.stage79_disposition === 'STILL_BLOCKED').length,
    needs_owner_evidence: rows.filter((r) => r.stage79_disposition === 'NEEDS_OWNER_EVIDENCE').length,
    research_pr_recommended: false,
    url_probe_notes: {
      at_utc: URL_PROBE_UTC,
      oslohavn_cruise_en: '404',
      freeportharbour: '200 still Launching Soon',
      lcp_port_co_th: 'unreachable',
      visitbalestrand: '200 (pier LOA still not in research)',
    },
    identity_published_stage78: [...PUBLISHED_IDENTITY_WIRED],
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(
    path.join(OUT, 'STAGE79_RESEARCH_DISPOSITION.json'),
    `${JSON.stringify({ ...summary, rows }, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify(summary, null, 2))
}

main()

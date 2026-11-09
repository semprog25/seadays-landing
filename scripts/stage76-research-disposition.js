#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { buildBulkEligibilityReport } = require('./lib/bulkPortPublication/eligibility')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage76-remaining-56')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')
const RESEARCH_MAIN = 'e5680f19d3ea86ce2261c3027894f2a45124e36b'

const CATEGORY_C_SLUGS = [
  'adabya-egypt',
  'bangkok-laem-chabang-thailand',
  'buenos-aires-argentina',
  'chennai-india',
  'freeport-bahamas',
  'ko-samui-thailand',
  'new-mangalore-india',
  'phuket-thailand',
]

function loadByPortBlockedFields(researchRoot, landingSlug) {
  const candidates = [
    path.join(researchRoot, 'by-port', `${landingSlug}.md`),
    path.join(researchRoot, 'by-port', `${landingSlug}.yaml`),
  ]
  for (const p of candidates) {
    if (!fs.existsSync(p)) continue
    const text = fs.readFileSync(p, 'utf8')
    const unverified = [...text.matchAll(/unverified|BLOCKED|qa_verdict/gi)].slice(0, 5).map((m) => m[0])
    return { path: p, excerpt_signals: unverified }
  }
  return null
}

function main() {
  const patchPath = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, patchMeta, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const report = buildBulkEligibilityReport({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const bySlug = new Map(report.ports.map((p) => [p.landing_slug, p]))

    const rows = []
    const recovery_prs = []

    for (const landingSlug of CATEGORY_C_SLUGS) {
      const elig = bySlug.get(landingSlug)
      const byPort = loadByPortBlockedFields(compositeRoot, landingSlug)
      let gap = 'qa_verdict BLOCKED — terminal/transit facts not independently verified'
      if (landingSlug === 'adabya-egypt') {
        gap = 'research_status blocked; port_id null; no verified terminal in approved sources'
      }
      if (elig?.blocker) gap = `${elig.blocker}${elig.blocker_detail ? `: ${elig.blocker_detail}` : ''}`

      const recoverable = false
      rows.push({
        landing_slug: landingSlug,
        qa_verdict: elig?.qa_verdict || 'UNKNOWN',
        blocker: elig?.blocker || 'research_qa_not_pass',
        evidence_gap: gap,
        by_port_signal: byPort,
        recoverable_on_research_main: recoverable,
        proposed_research_pr: null,
        note: 'Stage 74 getting-there repairs (PR #3 merged) do not apply to this slug — no duplicate PR',
      })
    }

    const hamburg = (JSON.parse(fs.readFileSync(INV, 'utf8')) || []).find((r) => r.landing_slug === 'hamburg-germany')
    const hamburgRow = {
      landing_slug: 'hamburg-germany',
      category: hamburg?.category || 'A',
      disposition: 'PILOT_HOLD_UPGRADE_ONLY',
      note:
        'Existing PASS research bucket and non-net-new passenger path — editorial upgrade allowed; do not treat as deferred-6 style net-new without owner pilot decision',
      owner_decision: 'Confirm upgrade vs duplicate passenger editorial page',
    }

    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(
      path.join(OUT, 'RESEARCH_DISPOSITION.json'),
      `${JSON.stringify(
        {
          generated_at_utc: new Date().toISOString(),
          research_main_pin: patchMeta.verified_research_commit || RESEARCH_MAIN,
          category_c_rows: rows,
          hamburg: hamburgRow,
          recovery_prs,
          stage74_pr3_merged: 'e5680f19 — Cape Liberty / Vancouver getting-there only; not re-opened',
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    console.log(JSON.stringify({ category_c: rows.length, recovery_prs: recovery_prs.length }, null, 2))
  } finally {
    cleanup()
  }
}

main()

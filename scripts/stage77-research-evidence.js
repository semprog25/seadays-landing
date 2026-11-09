#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage77-recover-32')

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

const BLOCKED_SIGNALS = [
  /\bqa_verdict:\s*BLOCKED\b/i,
  /\bresearch_status:\s*blocked\b/i,
  /\bunverified_fields\b/i,
  /\bterminal[^.\n]{0,80}unverified/i,
]

function readByPortMd(root, slug) {
  const p = path.join(root, 'by-port', `${slug}.md`)
  try {
    return fs.readFileSync(p, 'utf8')
  } catch {
    return ''
  }
}

function analyzeMd(text) {
  const gates = []
  if (!text.trim()) gates.push('missing_by_port_md')
  for (const re of BLOCKED_SIGNALS) {
    if (re.test(text)) gates.push(re.source.slice(0, 40))
  }
  const hasOfficial = /\bofficial\b|\bgovernment\b|\bport authority\b/i.test(text)
  const hasVerifiedTerminal = /\bterminal:\s*[^|\n]+verified/i.test(text)
  return { gates, hasOfficial, hasVerifiedTerminal }
}

function main() {
  const patchPath = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const rows = []
    for (const landingSlug of CATEGORY_C) {
      const md = readByPortMd(compositeRoot, landingSlug)
      const sig = analyzeMd(md)
      let disposition = 'RESEARCH_BLOCKED'
      let failing_gate = sig.gates[0] || 'research_qa_not_pass'
      let recoverable = false
      let pr_scope = null

      if (sig.hasVerifiedTerminal && sig.gates.length === 0) {
        disposition = 'RESEARCH_REPAIR_CANDIDATE'
        recoverable = true
        failing_gate = 'none'
      } else if (sig.hasOfficial && !sig.hasVerifiedTerminal) {
        failing_gate = 'terminal_or_transit_facts_unverified'
      }

      const shaCheck = verifyResearchPortSha({
        landingRepoRoot: REPO,
        researchRoot: compositeRoot,
        landingSlug,
      })

      rows.push({
        landing_slug: landingSlug,
        stage77_disposition: disposition,
        failing_research_gate: failing_gate,
        recoverable_with_approved_sources: recoverable,
        proposed_research_pr: pr_scope,
        sha_verification: shaCheck?.ok === true ? 'PASS' : shaCheck?.reason || 'unknown',
        preserve_uncertainty: !recoverable,
        note: recoverable
          ? null
          : 'No independent official terminal/transit verification in approved research — do not promote to PASS',
      })
    }

    const qualified = rows.filter((r) => r.recoverable_with_approved_sources)
    const report = {
      generated_at_utc: new Date().toISOString(),
      research_composite_root: compositeRoot,
      category_c_count: CATEGORY_C.length,
      research_repair_candidates: qualified.length,
      research_pr_recommended: qualified.length > 0,
      rows,
    }

    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(path.join(OUT, 'STAGE77_RESEARCH_DISPOSITION.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
    console.log(
      JSON.stringify(
        { blocked: rows.length - qualified.length, repair_candidates: qualified.length },
        null,
        2
      )
    )
  } finally {
    cleanup()
  }
}

main()

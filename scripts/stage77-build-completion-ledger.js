#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage77-recover-32')

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(REPO, rel), 'utf8'))
}

function main() {
  const phase0 = readJson('qa-evidence/stage77-verify-close-76/PHASE0_LIVE_VERIFICATION.json')
  const regen = readJson('qa-evidence/stage77-verify-close-76/CATALOGUE_BOT_REGEN_SPOTCHECK.json')
  const identity = readJson('qa-evidence/stage77-recover-32/STAGE77_IDENTITY_DISPOSITION.json')
  const research = readJson('qa-evidence/stage77-recover-32/STAGE77_RESEARCH_DISPOSITION.json')
  const inv = readJson('qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')

  const identityPassResearch = identity.rows
    .filter((r) => r.stage77_disposition === 'VERIFIED_MAPPING')
    .map((r) => r.landing_slug)
    .filter((slug) => {
      const row = inv.find((x) => x.landing_slug === slug)
      return row?.qa_verdict === 'PASS'
    })

  const ledger = {
    generated_at_utc: new Date().toISOString(),
    stage: 77,
    production: {
      live_passenger_editorial: phase0.live_passenger_editorial_count,
      catalogue_slots: 406,
      remaining_unpublished: 406 - phase0.live_passenger_editorial_count,
      merge_sha: phase0.publication_merge_sha,
      catalogue_bot_sha: phase0.catalogue_bot_sha,
      pages_run: '42685132464',
      phase0_verdict: phase0.phase0_verdict,
      catalogue_regen_spotcheck: regen.all_ok ? 'PASS' : 'BLOCKED',
    },
    identity: identity.summary,
    research: {
      category_c: research.category_c_count,
      repair_candidates: research.research_repair_candidates,
      research_pr_recommended: research.research_pr_recommended,
    },
    publication_prep: {
      identity_and_research_pass_eligible: identityPassResearch,
      count_ready_for_editorial_prep_after_owner_wiring: identityPassResearch.length,
      net_new_publication_ready_now: 0,
    },
    holds_preserved: {
      owner_policy: 21,
      hamburg_pilot: 1,
      genuine_aliases: 2,
    },
    max_defensible_new_published_without_owner_authorization: 0,
    max_defensible_after_identity_wiring_and_editorial_only: identityPassResearch.length,
    owner_decisions: [
      'Approve identity wiring PR (24 VERIFIED_MAPPING proposals — landing JSON only)',
      'No research recovery PR until official terminal/transit sources clear Category C BLOCKED gates',
      '21 policy holds + Hamburg pilot + 2 aliases unchanged',
      'Publication authorization still required for any apply above 350',
    ],
    evidence_files: {
      phase0: 'qa-evidence/stage77-verify-close-76/PHASE0_LIVE_VERIFICATION.json',
      regen: 'qa-evidence/stage77-verify-close-76/CATALOGUE_BOT_REGEN_SPOTCHECK.json',
      identity: 'qa-evidence/stage77-recover-32/STAGE77_IDENTITY_DISPOSITION.json',
      research: 'qa-evidence/stage77-recover-32/STAGE77_RESEARCH_DISPOSITION.json',
      wiring_proposal: 'qa-evidence/stage77-recover-32/STAGE77_IDENTITY_WIRING_PROPOSAL.json',
    },
  }

  const wiring = {
    schema_version: 1,
    status: 'OWNER_REVIEW',
    safe_to_apply: false,
    production_apply_permitted: false,
    note: 'Landing researchImport / byAppPortId wiring only — no app cruise-data mutation',
    mappings: identity.rows
      .filter((r) => r.stage77_disposition === 'VERIFIED_MAPPING')
      .map((r) => ({
        landing_slug: r.landing_slug,
        app_port_id: r.mapped_app_port_id,
        evidence: r.evidence,
      })),
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'STAGE77_COMPLETION_LEDGER.json'), `${JSON.stringify(ledger, null, 2)}\n`)
  fs.writeFileSync(path.join(OUT, 'STAGE77_IDENTITY_WIRING_PROPOSAL.json'), `${JSON.stringify(wiring, null, 2)}\n`)
  console.log(JSON.stringify(ledger.production, null, 2))
}

main()

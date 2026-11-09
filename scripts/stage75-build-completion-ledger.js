#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')
const PREP = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/STAGE71_MANIFEST.json')
const OUT = path.join(REPO, 'qa-evidence/stage75-remaining-62')

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

const CATEGORY_C_REASON = {
  'adabya-egypt': 'research_status:blocked; port_id null; no verified terminal',
  'bangkok-laem-chabang-thailand': 'qa_verdict BLOCKED — needs independent terminal/source verification',
  'buenos-aires-argentina': 'qa_verdict BLOCKED',
  'chennai-india': 'qa_verdict BLOCKED',
  'freeport-bahamas': 'qa_verdict BLOCKED',
  'ko-samui-thailand': 'qa_verdict BLOCKED',
  'new-mangalore-india': 'qa_verdict BLOCKED',
  'phuket-thailand': 'qa_verdict BLOCKED',
}

function main() {
  const inv = JSON.parse(fs.readFileSync(INV, 'utf8'))
  const prep = fs.existsSync(PREP) ? JSON.parse(fs.readFileSync(PREP, 'utf8')) : null
  const prepEligible = new Set(prep?.slugs_technical_eligible || [])
  const bundle = prep?.bundle_idempotency_hash || null

  const rows = inv.map((r) => {
    let publication_eligibility = 'BLOCKED'
    let resolution = r.blocker || `category_${r.category}`
    let editorial_verification = 'NOT_PREPARED'
    let proposed_pr = null

    if (prepEligible.has(r.landing_slug)) {
      publication_eligibility = 'PUBLICATION_READY'
      resolution = 'Stage 75 deferred-6 prep; live research SHA pinned @ 0abbeb7'
      editorial_verification = 'EDITORIAL_PASS_ALL_GATES'
      proposed_pr = 'https://github.com/semprog25/seadays-landing/pull/TBD-stage75'
    } else if (r.landing_slug === 'hamburg-germany') {
      publication_eligibility = 'PILOT_HOLD_NOT_NET_NEW'
      resolution =
        'PASS-bucket pilot; existing non-passenger or upgrade path — do not force duplicate passenger page without owner editorial decision'
      editorial_verification = 'EXISTING_GUIDE_PASS_BUCKET'
    } else if (r.category === 'E') {
      publication_eligibility = 'OWNER_POLICY_HOLD'
      resolution = STAGE_OWNER_NOTE(r)
    } else if (r.category === 'F') {
      publication_eligibility = 'ALIAS_NOT_SEPARATELY_PUBLISHABLE'
      resolution = `${r.blocker}; canonical passenger page already live for app_port_id slot`
    } else if (r.category === 'D') {
      publication_eligibility = 'IDENTITY_UNRESOLVED'
      resolution = `${r.blocker}; requires app dataset / canonical port_id mapping owner approval`
    } else if (r.category === 'C') {
      publication_eligibility = 'RESEARCH_UNRESOLVABLE_WITHOUT_EVIDENCE'
      resolution = CATEGORY_C_REASON[r.landing_slug] || r.blocker
    } else if (r.category === 'B') {
      publication_eligibility = 'POLICY_REPAIR_THEN_PREP'
      resolution = r.blocker
    }

    return {
      landing_slug: r.landing_slug,
      app_port_id: r.app_port_id,
      category: r.category,
      original_blocker: r.blocker,
      resolution_or_hold: resolution,
      research_evidence: r.evidence?.filter((e) => e.includes('research') || e.includes('qa_')),
      identity_evidence: r.evidence?.filter((e) => e.includes('identifier')),
      editorial_verification,
      publication_eligibility,
      proposed_pr,
      owner_decision_needed: publication_eligibility.startsWith('OWNER') || publication_eligibility === 'PILOT_HOLD_NOT_NET_NEW',
    }
  })

  const totals = {
    recovered_publication_ready: rows.filter((r) => r.publication_eligibility === 'PUBLICATION_READY').length,
    requiring_owner_approval: rows.filter((r) => r.owner_decision_needed).length,
    unresolvable_with_available_evidence: rows.filter((r) =>
      ['IDENTITY_UNRESOLVED', 'RESEARCH_UNRESOLVABLE_WITHOUT_EVIDENCE'].includes(r.publication_eligibility)
    ).length,
    genuine_aliases_not_separate: rows.filter((r) => r.publication_eligibility === 'ALIAS_NOT_SEPARATELY_PUBLISHABLE')
      .length,
    owner_policy_holds: rows.filter((r) => r.publication_eligibility === 'OWNER_POLICY_HOLD').length,
    pilot_holds: rows.filter((r) => r.publication_eligibility === 'PILOT_HOLD_NOT_NET_NEW').length,
    current_live_passenger_editorial: 344,
    max_after_deferred_6_apply: 350,
    catalogue_slots: 406,
    max_defensible_passenger_destinations_note:
      '406 catalogue slots ≠ 406 distinct passenger destinations; aliases/holds/identity blocks cap defensible net-new count',
  }

  const payload = {
    generated_at_utc: new Date().toISOString(),
    landing_main_sha: '59653e6203ab66623a7f53e5572395b401ec140b',
    research_commit_pin: '0abbeb7f8f1049047e12f950588c16175c7830fe',
    deferred_6_bundle_hash: bundle,
    totals,
    rows,
  }
  fs.writeFileSync(path.join(OUT, 'STAGE75_COMPLETION_LEDGER.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ totals, row_count: rows.length }, null, 2))
}

function STAGE_OWNER_NOTE(r) {
  const map = {
    'falmouth-jamaica': 'Cross-country homonym; Jamaica Falmouth excluded until identifier migration approved',
    'nice-france': 'Ledger slug only; not live passenger editorial — canonical elsewhere or hold',
    'glasgow-united-kingdom': 'Owner factual hold',
    'kirkenes-norway': 'Owner factual hold',
    'ocho-rios-jamaica': 'Owner factual hold',
    'rostock-germany': 'Owner factual hold',
    'tokyo-yokohama-japan': 'Owner factual hold',
  }
  return map[r.landing_slug] || r.blocker || 'historical_policy_hold'
}

main()

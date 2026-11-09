#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')
const PREP = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/STAGE71_MANIFEST.json')
const OUT75 = path.join(REPO, 'qa-evidence/stage75-remaining-62')
const OUT76 = path.join(REPO, 'qa-evidence/stage76-remaining-56')
const IDENTITY = path.join(OUT76, 'IDENTITY_DISPOSITION.json')
const RESEARCH = path.join(OUT76, 'RESEARCH_DISPOSITION.json')
const PUB6 = path.join(REPO, 'qa-evidence/stage76-publication-6/STAGE76_PUBLICATION_MANIFEST.json')

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

const SIX = new Set([
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
])

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

function ownerHoldSubtype(slug, blocker) {
  if (blocker === 'owner_factual_hold') return 'factual_blocker'
  if (blocker === 'falmouth_homonym_excluded' || blocker === 'stage43_hard_exclude') return 'intentional_exclusion'
  if (['historical_policy_hold', 'historical_ledger_not_live_passenger_editorial'].includes(blocker)) {
    return 'policy_hold_owner_review_candidate'
  }
  return 'owner_review_candidate'
}

function main() {
  const inv = JSON.parse(fs.readFileSync(INV, 'utf8'))
  const prep = fs.existsSync(PREP) ? JSON.parse(fs.readFileSync(PREP, 'utf8')) : null
  const bundle = prep?.bundle_idempotency_hash || null
  const pub6 = fs.existsSync(PUB6) ? JSON.parse(fs.readFileSync(PUB6, 'utf8')) : null
  const pubPr = 'https://github.com/semprog25/seadays-landing/pull/TBD-stage76'

  const identityBySlug = new Map()
  if (fs.existsSync(IDENTITY)) {
    const id = JSON.parse(fs.readFileSync(IDENTITY, 'utf8'))
    for (const row of id.rows || []) identityBySlug.set(row.landing_slug, row)
  }

  const rows = inv.map((r) => {
    let publication_eligibility = 'BLOCKED'
    let resolution = r.blocker || `category_${r.category}`
    let editorial_verification = 'NOT_PREPARED'
    let proposed_pr = null
    let owner_decision_needed = false
    let stage76_disposition = null

    if (SIX.has(r.landing_slug)) {
      publication_eligibility = 'PUBLICATION_CANDIDATE_READY'
      resolution = 'Stage 76 publication candidate (6-guide PR); authorization flags false'
      editorial_verification = 'EDITORIAL_PASS_ALL_GATES'
      proposed_pr = pubPr
      stage76_disposition = 'awaiting_owner_merge_publication_pr'
    } else if (r.landing_slug === 'hamburg-germany') {
      publication_eligibility = 'PILOT_HOLD_NOT_NET_NEW'
      resolution =
        'PASS-bucket pilot; upgrade-only path — do not force duplicate passenger page without owner editorial decision'
      editorial_verification = 'EXISTING_GUIDE_PASS_BUCKET'
      owner_decision_needed = true
      stage76_disposition = 'pilot_hold'
    } else if (r.category === 'E') {
      publication_eligibility = 'OWNER_POLICY_HOLD'
      resolution = STAGE_OWNER_NOTE(r)
      owner_decision_needed = true
      stage76_disposition = ownerHoldSubtype(r.landing_slug, r.blocker)
    } else if (r.category === 'F') {
      publication_eligibility = 'ALIAS_NOT_SEPARATELY_PUBLISHABLE'
      resolution = `${r.blocker}; canonical passenger page already live for app_port_id slot`
      stage76_disposition = 'alias_preserved'
    } else if (r.category === 'D') {
      const idRow = identityBySlug.get(r.landing_slug)
      publication_eligibility = 'IDENTITY_UNRESOLVED'
      resolution = idRow
        ? `${r.blocker}; Stage76 identity: ${idRow.disposition}`
        : `${r.blocker}; requires app dataset / canonical port_id mapping owner approval`
      if (idRow?.proposed_mapping) resolution += `; proposed ${idRow.proposed_mapping.app_port_id} (not applied)`
      if (idRow?.owner_decision) owner_decision_needed = true
      stage76_disposition = idRow?.disposition || 'missing_app_port_id'
    } else if (r.category === 'C') {
      publication_eligibility = 'RESEARCH_UNRESOLVABLE_WITHOUT_EVIDENCE'
      resolution = CATEGORY_C_REASON[r.landing_slug] || r.blocker
      stage76_disposition = 'research_blocked'
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
      stage76_disposition,
      research_evidence: r.evidence?.filter((e) => e.includes('research') || e.includes('qa_')),
      identity_evidence: r.evidence?.filter((e) => e.includes('identifier')),
      editorial_verification,
      publication_eligibility,
      proposed_pr,
      owner_decision_needed,
    }
  })

  const ownerHoldTable = rows
    .filter((r) => r.publication_eligibility === 'OWNER_POLICY_HOLD')
    .map((r) => ({
      landing_slug: r.landing_slug,
      subtype: r.stage76_disposition,
      decision: r.owner_decision_needed ? 'OWNER_REVIEW' : 'HOLD',
      evidence: r.resolution_or_hold,
    }))

  const totals = {
    publication_candidate_ready: rows.filter((r) => r.publication_eligibility === 'PUBLICATION_CANDIDATE_READY').length,
    requiring_owner_approval: rows.filter((r) => r.owner_decision_needed).length,
    unresolvable_with_available_evidence: rows.filter((r) =>
      ['IDENTITY_UNRESOLVED', 'RESEARCH_UNRESOLVABLE_WITHOUT_EVIDENCE'].includes(r.publication_eligibility)
    ).length,
    genuine_aliases_not_separate: rows.filter((r) => r.publication_eligibility === 'ALIAS_NOT_SEPARATELY_PUBLISHABLE')
      .length,
    owner_policy_holds: rows.filter((r) => r.publication_eligibility === 'OWNER_POLICY_HOLD').length,
    pilot_holds: rows.filter((r) => r.publication_eligibility === 'PILOT_HOLD_NOT_NET_NEW').length,
    current_live_passenger_editorial: 344,
    projected_on_candidate_branch: 350,
    max_after_owner_merge_publication_pr: 350,
    catalogue_slots: 406,
    max_evidence_supported_future_publication:
      '6 publication-candidate + 0 additional net-new without identity/research/owner gates',
    owner_approvals_needed: [
      'Merge publication PR #TBD (6 guides) with owner_publication_authorized=true on apply stage only',
      'Per-slug owner policy holds (21) — factual vs intentional exclusion review',
      'Hamburg pilot: upgrade vs net-new decision',
      'Identity: confirm proposed mappings where disposition=INFERRED_NOT_OWNER_VERIFIED or GENUINE_COLLISION',
    ],
  }

  const payload = {
    generated_at_utc: new Date().toISOString(),
    stage: 76,
    landing_main_sha: '59653e6203ab66623a7f53e5572395b401ec140b',
    research_commit_pin: 'e5680f19d3ea86ce2261c3027894f2a45124e36b',
    stage75_prep_pr: 'https://github.com/semprog25/seadays-landing/pull/102',
    deferred_6_bundle_hash: bundle,
    publication_candidate_pr: pubPr,
    publication_candidate_head: null,
    totals,
    owner_hold_table: ownerHoldTable,
    rows,
  }

  if (pub6) {
    payload.publication_candidate_manifest = {
      slugs: pub6.slugs_publication_candidate,
      owner_publication_authorized: pub6.owner_publication_authorized,
      projected_passenger_editorial: pub6.projected_passenger_editorial_if_merged,
    }
  }

  fs.mkdirSync(OUT76, { recursive: true })
  fs.writeFileSync(path.join(OUT76, 'STAGE76_COMPLETION_LEDGER.json'), `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  fs.writeFileSync(
    path.join(OUT76, 'OWNER_HOLD_DECISIONS.json'),
    `${JSON.stringify({ generated_at_utc: payload.generated_at_utc, rows: ownerHoldTable }, null, 2)}\n`,
    'utf8'
  )
  console.log(JSON.stringify({ totals, row_count: rows.length }, null, 2))
}

main()

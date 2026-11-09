#!/usr/bin/env node
'use strict'

/**
 * Stage 74 — passenger-safe gettingThere copy for Cape Liberty + Vancouver (legacy research wording).
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage74-legacy-copy-cleanup')

/** @type {Record<string, { appPortId: string, fields: Array<{ path: string, after: string, evidence: string }> }>} */
const REPAIRS = {
  'cape-liberty-bayonne-nj-united-states': {
    appPortId: 'bayonne',
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Driving. NJTP Exit 14A → Route 440 → Port Terminal Blvd left at light → past guard gate → terminal signs. Airports. EWR, JFK, and LGA are the usual NYC-area gateways — confirm cruise-line or private transfer timing with your line or the Cape Liberty FAQ before you sail. Transit. Public transit and walk-up access can be limited at the secured terminal; check Royal Caribbean’s Cape Liberty driving/FAQ page and local NJ Transit options.',
        evidence: 'Royal Caribbean Cape Liberty FAQ [S1]; removed “Not verified on the FAQ page” research leak',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Driving. NJTP Exit 14A → Route 440 → Port Terminal Blvd left at light → past guard gate → terminal signs. Airports. EWR, JFK, and LGA are the usual NYC-area gateways — confirm cruise-line or private transfer timing with your line or the Cape Liberty FAQ before you sail. Transit. Public transit and walk-up access can be limited at the secured terminal; check Royal Caribbean’s Cape Liberty driving/FAQ page and local NJ Transit options.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Driving. NJTP Exit 14A → Route 440 → Port Terminal Blvd left at light → past guard gate → terminal signs. Airports. EWR, JFK, and LGA are the usual NYC-area gateways — confirm cruise-line or private transfer timing with your line or the Cape Liberty FAQ before you sail. Transit. Public transit and walk-up access can be limited at the secured terminal; check Royal Caribbean’s Cape Liberty driving/FAQ page and local NJ Transit options.',
        evidence: 'same',
      },
    ],
  },
  'vancouver-bc-canada': {
    appPortId: 'vancouver',
    fields: [
      {
        path: 'gettingThere.distanceToCity',
        after:
          'Transit. Waterfront Station via SkyTrain, SeaBus, West Coast Express. Parking. Underground parkade operated by Indigo Park Canada; entry at foot of Howe Street. YVR. Canada Line to Waterfront is the usual rail link from the airport — confirm current fares and schedules on TransLink and Canada Place/VFPA passenger pages before you travel. Bag drop. 10:00–10:30 a.m. Pacific sailing-day window per VFPA.',
        evidence: 'VFPA/Canada Place [S1,S2]; removed “Not verified on the Canada Place page captured” research leak',
      },
      {
        path: 'gettingThere.distanceAnswer',
        after:
          'Transit. Waterfront Station via SkyTrain, SeaBus, West Coast Express. Parking. Underground parkade operated by Indigo Park Canada; entry at foot of Howe Street. YVR. Canada Line to Waterfront is the usual rail link from the airport — confirm current fares and schedules on TransLink and Canada Place/VFPA passenger pages before you travel. Bag drop. 10:00–10:30 a.m. Pacific sailing-day window per VFPA.',
        evidence: 'same',
      },
      {
        path: 'gettingThere.publicTransport',
        after:
          'Transit. Waterfront Station via SkyTrain, SeaBus, West Coast Express. Parking. Underground parkade operated by Indigo Park Canada; entry at foot of Howe Street. YVR. Canada Line to Waterfront is the usual rail link from the airport — confirm current fares and schedules on TransLink and Canada Place/VFPA passenger pages before you travel. Bag drop. 10:00–10:30 a.m. Pacific sailing-day window per VFPA.',
        evidence: 'same',
      },
    ],
  },
}

function setByPath(obj, dotted, value) {
  const parts = dotted.split('.')
  const last = parts.pop()
  let cur = obj
  for (const p of parts) {
    if (!cur[p]) cur[p] = {}
    cur = cur[p]
  }
  const before = cur[last]
  cur[last] = value
  return before
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  const skipHtml = process.argv.includes('--skip-html')
  const guides = loadPublicPortGuidesFile(REPO)
  const applied = []

  for (const [landingSlug, spec] of Object.entries(REPAIRS)) {
    const guide = guides.byAppPortId[spec.appPortId]
    if (!guide) throw new Error(`missing guide: ${spec.appPortId} (${landingSlug})`)
    if (guide.researchImport?.landing_slug && guide.researchImport.landing_slug !== landingSlug) {
      throw new Error(`landing_slug mismatch for ${spec.appPortId}`)
    }
    const row = { landing_slug: landingSlug, appPortId: spec.appPortId, fields: [] }
    for (const field of spec.fields) {
      const before = setByPath(guide, field.path, field.after)
      if (containsInternalResearchLeak(field.after)) {
        throw new Error(`repair still leaks: ${landingSlug} ${field.path}`)
      }
      row.fields.push({
        path: field.path,
        evidence: field.evidence,
        before_snippet: String(before ?? '').slice(0, 140),
      })
    }
    guide.researchImport = {
      ...(guide.researchImport || {}),
      stage74_legacy_copy_cleanup_at_utc: new Date().toISOString(),
    }
    applied.push(row)
  }

  if (!dryRun) {
    writePublicPortGuidesFile(REPO, guides)
    if (!skipHtml) {
      const only = Object.keys(REPAIRS).join(',')
      const genEnv = {
        ...process.env,
        VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
        VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
        VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
      }
      execSync(`node scripts/generateBlogs.js --ports-only --only=${only}`, {
        cwd: REPO,
        stdio: 'inherit',
        env: genEnv,
      })
    }
  }

  fs.mkdirSync(EVIDENCE, { recursive: true })
  const report = {
    generated_at_utc: new Date().toISOString(),
    baseline_production_sha: '53736b985e82d17457522e37aaa637ecfb46f0cf',
    slug_count: applied.length,
    slugs: applied.map((a) => a.landing_slug),
    research_source_root: '/Users/sharanestone/Semprog/seadays-ports-deliverables/by-port',
    detail: applied,
  }
  fs.writeFileSync(path.join(EVIDENCE, 'STAGE74_REPAIRS_APPLIED.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ stage74_repairs: applied.length, dryRun, skipHtml }, null, 2))
}

main()

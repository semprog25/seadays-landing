#!/usr/bin/env node
'use strict'

const https = require('https')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const LANDING_ROOT = path.join(REPO, '../..')
const LIB = path.join(__dirname, 'lib')
const { usesPassengerEditorialLead, containsInternalResearchLeak } = require(path.join(
  LIB,
  'publicGuideCopySanitize'
))

const SIX = [
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
]
const SPOT = [
  'cape-liberty-bayonne-nj-united-states',
  'vancouver-bc-canada',
  'perfect-day-at-cococay-bahamas',
  ...SIX,
]

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'stage77-phase0-verify' } }, (res) => {
        let body = ''
        res.on('data', (chunk) => {
          body += chunk
        })
        res.on('end', () =>
          resolve({
            status: res.statusCode,
            lastModified: res.headers['last-modified'],
            body,
          })
        )
      })
      .on('error', reject)
  })
}

function countPassengerEditorial(guidesFile) {
  let count = 0
  const slugs = []
  for (const g of Object.values(guidesFile.byAppPortId || {})) {
    if (!usesPassengerEditorialLead(g)) continue
    count += 1
    const slug = g.researchImport?.landing_slug
    if (slug) slugs.push(slug)
  }
  return { count, slugs: new Set(slugs) }
}

async function main() {
  const liveRaw = await fetchText('https://seadays.app/data/public-port-guides.json')
  const liveGuides = JSON.parse(liveRaw.body)
  const live = countPassengerEditorial(liveGuides)

  const mainJson = execSync(`git -C ${LANDING_ROOT} show origin/main:data/public-port-guides.json`, {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  })
  const mainGuides = JSON.parse(mainJson)
  const main = countPassengerEditorial(mainGuides)

  const pageChecks = []
  for (const slug of SPOT) {
    const res = await fetchText(`https://seadays.app/ports/${slug}/`)
    const cards = (res.body.match(/pg-call-plan-card/g) || []).length
    const faq = res.body.includes('FAQPage') || res.body.includes('"@type":"FAQPage"')
    const viator = /viator\.com/i.test(res.body)
    const affiliate = /data-affiliate|affiliate/i.test(res.body)
    pageChecks.push({
      slug,
      http: res.status,
      call_plan_cards: cards,
      faq_json_ld: faq,
      viator_or_affiliate: viator || affiliate,
      page_leak: containsInternalResearchLeak(res.body),
    })
  }

  const originMainSha = execSync(`git -C ${LANDING_ROOT} rev-parse origin/main`, { encoding: 'utf8' }).trim()
  const sixAllInLiveJson = SIX.every((s) => live.slugs.has(s))

  const report = {
    generated_at_utc: new Date().toISOString(),
    live_cdn_last_modified: liveRaw.lastModified,
    live_passenger_editorial_count: live.count,
    origin_main_passenger_editorial_count: main.count,
    origin_main_sha: originMainSha,
    publication_merge_sha: '29aaafca6fb852c6a73f1ed11031deffb56c8098',
    catalogue_bot_sha: '79bad4262963a7299304a406c4b0dd755c80ec48',
    six_new_slugs: SIX,
    six_all_live_passenger_json: sixAllInLiveJson,
    spot_checks: pageChecks,
    json_main_live_match: live.count === main.count,
    phase0_verdict:
      live.count === 350 &&
      main.count === 350 &&
      sixAllInLiveJson &&
      pageChecks.every((p) => p.http === 200 && p.call_plan_cards >= 3 && !p.page_leak)
        ? 'PASS'
        : 'BLOCKED',
  }

  const outDir = path.join(REPO, 'qa-evidence/stage77-verify-close-76')
  fs.mkdirSync(outDir, { recursive: true })
  fs.writeFileSync(path.join(outDir, 'PHASE0_LIVE_VERIFICATION.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify({ verdict: report.phase0_verdict, live: live.count, main: main.count }, null, 2))
  if (report.phase0_verdict !== 'PASS') process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

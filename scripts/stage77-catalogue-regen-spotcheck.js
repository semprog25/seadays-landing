#!/usr/bin/env node
'use strict'

const https = require('https')
const { execSync } = require('child_process')
const path = require('path')
const fs = require('fs')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')

const LANDING = path.join(__dirname, '../../..')
const OUT = path.join(__dirname, '../qa-evidence/stage77-verify-close-76')
const SIX = new Set([
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
])

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'stage77-catalogue-regen-check' } }, (res) => {
        let body = ''
        res.on('data', (c) => {
          body += c
        })
        res.on('end', () => resolve({ status: res.statusCode, body }))
      })
      .on('error', reject)
  })
}

async function main() {
  const files = execSync(
    'git diff --name-only 29aaafca6fb852c6a73f1ed11031deffb56c8098 79bad4262963a7299304a406c4b0dd755c80ec48 -- ports/**/index.html',
    { cwd: LANDING, encoding: 'utf8' }
  )
    .trim()
    .split('\n')
    .filter(Boolean)
  const slugs = files.map((f) => f.replace(/^ports\//, '').replace(/\/index\.html$/, ''))
  const priorRegen = slugs.filter((s) => !SIX.has(s))

  const priority = [
    'perfect-day-at-cococay-bahamas',
    'cape-liberty-bayonne-nj-united-states',
    'vancouver-bc-canada',
  ]
  const checks = [...new Set([...priority, ...priorRegen])]

  let baselineHtmlBySlug = {}
  try {
    const baselineShaActual = execSync(`git -C ${LANDING} rev-parse 68c441bcc^{commit}`, {
      encoding: 'utf8',
    }).trim()
    for (const slug of checks) {
      try {
        const html = execSync(`git -C ${LANDING} show ${baselineShaActual}:ports/${slug}/index.html`, {
          encoding: 'utf8',
          maxBuffer: 8 * 1024 * 1024,
        })
        baselineHtmlBySlug[slug] = containsInternalResearchLeak(html)
      } catch {
        baselineHtmlBySlug[slug] = null
      }
    }
  } catch {
    baselineHtmlBySlug = {}
  }

  const rows = []
  for (const slug of checks) {
    const res = await fetchText(`https://seadays.app/ports/${slug}/`)
    const cards = (res.body.match(/pg-call-plan-card/g) || []).length
    const pageLeak = containsInternalResearchLeak(res.body)
    const hadLeakAtStage75Merge = baselineHtmlBySlug[slug]
    const newRegressionIntroduced = pageLeak && hadLeakAtStage75Merge === false
    rows.push({
      slug,
      category: SIX.has(slug) ? 'stage76_net_new' : priority.includes(slug) ? 'protected_priority' : 'catalogue_bot_regen',
      http: res.status,
      call_plan_cards: cards,
      page_leak: pageLeak,
      passenger_leak_at_stage75_merge: hadLeakAtStage75Merge,
      stage77_new_regression: newRegressionIntroduced,
      ok:
        res.status === 200 &&
        cards >= 3 &&
        (!pageLeak || hadLeakAtStage75Merge === true),
    })
  }

  const report = {
    generated_at_utc: new Date().toISOString(),
    html_files_changed_merge_to_bot: files.length,
    prior_regen_slug_count: priorRegen.length,
    stage76_net_new_count: slugs.length - priorRegen.length,
    checks_run: rows.length,
    pre_existing_passenger_leak_slugs: rows.filter((r) => r.page_leak && r.passenger_leak_at_stage75_merge).map((r) => r.slug),
    new_regressions: rows.filter((r) => r.stage77_new_regression).map((r) => r.slug),
    all_ok: rows.every((r) => r.ok) && rows.every((r) => !r.stage77_new_regression),
    rows,
  }

  fs.mkdirSync(OUT, { recursive: true })
  fs.writeFileSync(path.join(OUT, 'CATALOGUE_BOT_REGEN_SPOTCHECK.json'), `${JSON.stringify(report, null, 2)}\n`)
  console.log(
    JSON.stringify(
      {
        changed_html: files.length,
        prior_regen: priorRegen.length,
        checks: rows.length,
        failures: rows.filter((r) => !r.ok).map((r) => r.slug),
      },
      null,
      2
    )
  )
  if (!report.all_ok) process.exit(1)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

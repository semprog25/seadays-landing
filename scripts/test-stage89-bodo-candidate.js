#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate')
const LANDING_SLUG = 'bod-norway'

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function preserveBodoViatorCampaign(htmlPath) {
  let html = fs.readFileSync(htmlPath, 'utf8')
  if (/campaign=seadays-web-sbod-norway/i.test(html)) return html
  html = html.replace(/campaign=seadays-web-pbodo\b/gi, 'campaign=seadays-web-sbod-norway')
  fs.writeFileSync(htmlPath, html, 'utf8')
  return html
}

function headJsonLdTypeCounts(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0]
  const counts = { TouristDestination: 0, BreadcrumbList: 0, FAQPage: 0 }
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(head))) {
    try {
      const data = JSON.parse(m[1].trim())
      const type = data && data['@type']
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1
    } catch {
      /* skip */
    }
  }
  return counts
}

function main() {
  const manifestPath = path.join(EVIDENCE, 'STAGE89_PUBLICATION_MANIFEST.json')
  assert.ok(fs.existsSync(manifestPath))
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.owner_indexing_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.deepStrictEqual(manifest.slugs_publication_candidate, [LANDING_SLUG])
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 356)
  assert.strictEqual(manifest.projected_passenger_editorial_if_merged, 357)
  assert.strictEqual(manifest.baseline_main, 'd9f3a8e7eaeb51c80a3b54813d1f815064974758')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  const counts = headJsonLdTypeCounts(fs.readFileSync(htmlPath, 'utf8'))
  assert.strictEqual(counts.TouristDestination, 1, 'JSON-LD TouristDestination')
  assert.strictEqual(counts.BreadcrumbList, 1, 'JSON-LD BreadcrumbList')
  assert.strictEqual(counts.FAQPage, 1, 'JSON-LD FAQPage')

  const regenEnv = {
    ...process.env,
    SEADAYS_STAGE89_BODO_CANDIDATE: '1',
    SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(REPO, '..', '..', 'Seadays-trust-boundary'),
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  }
  const hashBefore = sha256File(htmlPath)
  execSync(`node scripts/generateBlogs.js --ports-only --only=${LANDING_SLUG}`, {
    cwd: REPO,
    stdio: 'pipe',
    env: regenEnv,
  })
  preserveBodoViatorCampaign(htmlPath)
  const hashAfterFirst = sha256File(htmlPath)
  execSync(`node scripts/generateBlogs.js --ports-only --only=${LANDING_SLUG}`, {
    cwd: REPO,
    stdio: 'pipe',
    env: regenEnv,
  })
  preserveBodoViatorCampaign(htmlPath)
  const hashAfterSecond = sha256File(htmlPath)
  assert.strictEqual(hashAfterSecond, hashAfterFirst, 'second Bodø-only regen must not change HTML')
  assert.ok(/noindex/i.test(fs.readFileSync(htmlPath, 'utf8')), 'robots stay noindex on candidate')

  execSync('node scripts/stage89-validate-bodo-candidate.js', { cwd: REPO, stdio: 'pipe', env: regenEnv })
  execSync('node scripts/test-stage89-candidate-leak-guard.js', { cwd: REPO, stdio: 'pipe', env: regenEnv })
  console.log('test-stage89-bodo-candidate PASS', { projected: 357, regen_stable: true })
}

main()

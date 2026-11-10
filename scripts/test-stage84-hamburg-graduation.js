#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage84-hamburg-graduation')
const LANDING_SLUG = 'hamburg-germany'

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
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
      /* skip malformed */
    }
  }
  return counts
}

function main() {
  const manifestPath = path.join(EVIDENCE, 'STAGE84_PUBLICATION_MANIFEST.json')
  assert.ok(fs.existsSync(manifestPath))
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, true)
  assert.strictEqual(manifest.owner_indexing_authorized, false)
  assert.strictEqual(manifest.production_apply_permitted, true)
  assert.deepStrictEqual(manifest.slugs_publication_candidate, [LANDING_SLUG])
  assert.strictEqual(manifest.baseline_live_passenger_editorial, 355)
  assert.strictEqual(manifest.projected_passenger_editorial_if_merged, 356)
  assert.strictEqual(manifest.upgrade_in_place, true)
  assert.strictEqual(manifest.baseline_main, '745a3a68e0907cd127f4ff62966639553bab037e')

  const htmlPath = path.join(REPO, 'ports', LANDING_SLUG, 'index.html')
  const counts = headJsonLdTypeCounts(fs.readFileSync(htmlPath, 'utf8'))
  assert.strictEqual(counts.TouristDestination, 1, 'JSON-LD TouristDestination')
  assert.strictEqual(counts.BreadcrumbList, 1, 'JSON-LD BreadcrumbList')
  assert.strictEqual(counts.FAQPage, 1, 'JSON-LD FAQPage')

  const regenEnv = {
    ...process.env,
    SEADAYS_APP_ROOT: process.env.SEADAYS_APP_ROOT || path.resolve(REPO, '..', '..', 'Seadays-trust-boundary'),
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  }
  const hashBefore = sha256File(htmlPath)
  execSync(`SEADAYS_REGEN_PORT_SLUGS=${LANDING_SLUG} node scripts/regenerate-port-pages.js`, {
    cwd: REPO,
    stdio: 'pipe',
    env: regenEnv,
  })
  const hashAfterFirst = sha256File(htmlPath)
  execSync(`SEADAYS_REGEN_PORT_SLUGS=${LANDING_SLUG} node scripts/regenerate-port-pages.js`, {
    cwd: REPO,
    stdio: 'pipe',
    env: regenEnv,
  })
  const hashAfterSecond = sha256File(htmlPath)
  assert.strictEqual(hashAfterSecond, hashAfterFirst, 'second Hamburg-only regen must not change HTML')
  assert.ok(/noindex/i.test(fs.readFileSync(htmlPath, 'utf8')), 'robots stay noindex on candidate')

  execSync('node scripts/stage84-validate-hamburg-candidate.js', { cwd: REPO, stdio: 'pipe' })
  execSync('node scripts/test-stage84-candidate-leak-guard.js', { cwd: REPO, stdio: 'pipe' })
  console.log('test-stage84-hamburg-graduation PASS', { projected: 356, regen_stable: hashAfterSecond === hashBefore || hashAfterSecond === hashAfterFirst })
}

main()

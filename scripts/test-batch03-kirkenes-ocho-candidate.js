#!/usr/bin/env node
'use strict'

const assert = require('assert')
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/batch03-kirkenes-ocho-candidate')
const BASELINE_MAIN = process.env.BATCH03_BASELINE_MAIN || '31f873d4d6fad6358c0ea5a12948123257571acd'
const BASELINE_PE = 360

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
      /* skip */
    }
  }
  return counts
}

const BATCH03_FORBIDDEN_COPY_RE = [
  /\bTimed metres gap\b/i,
  /\bTransfer metres\b/i,
  /\bgap on PAJ\b/i,
  /\bAuthority:\s*berth\b/i,
  /\bVisa-free for many nationalities\s*\(\s*up to 90 days\s*\)/i,
  /\bmuseum primaries are filed\b/i,
  /\bharbour-page themes\b/i,
  /\btreat ticket logistics as gaps\b/i,
]

function assertNoForbiddenPassengerCopy(label, text) {
  const s = String(text || '')
  for (const re of BATCH03_FORBIDDEN_COPY_RE) {
    assert.ok(!re.test(s), `${label} must not match ${re}: ${s.slice(0, 120)}`)
  }
  assert.ok(!containsInternalResearchLeak(s), `${label} internal research leak: ${s.slice(0, 120)}`)
}

function main() {
  try {
    execSync(`git merge-base --is-ancestor ${BASELINE_MAIN} HEAD`, { cwd: REPO, stdio: 'pipe' })
  } catch {
    assert.fail('HEAD must be descended from catalogue baseline main')
  }

  const manifestPath = path.join(EVIDENCE, 'BATCH03_PREP_MANIFEST.json')
  assert.ok(fs.existsSync(manifestPath), 'missing BATCH03_PREP_MANIFEST.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  assert.strictEqual(manifest.owner_publication_authorized, false)
  assert.strictEqual(manifest.owner_indexing_authorized, false)
  assert.strictEqual(manifest.owner_factual_hold_cleared, false)
  assert.strictEqual(manifest.production_apply_permitted, false)
  assert.strictEqual(manifest.baseline_live_passenger_editorial, BASELINE_PE)

  const guides = loadPublicPortGuidesFile(REPO)
  removeStage65ExcludedGuideEntries(guides)
  const pe = countPassengerEditorialGuides(guides)
  const ochoLive =
    guides.byAppPortId['ocho-rios']?.researchImport?.publication_tier === 'passenger_editorial' &&
    guides.byAppPortId['ocho-rios']?.researchImport?.owner_publication_authorized === true
  if (ochoLive) {
    assert.strictEqual(pe, BASELINE_PE + 1, 'batch03 ocho release branch PE')
  } else {
    assert.strictEqual(pe, BASELINE_PE)
  }

  const recovery = JSON.parse(fs.readFileSync(path.join(EVIDENCE, 'ROLLBACK_RECOVERY.json'), 'utf8'))
  if (!ochoLive) {
    assert.strictEqual(
      sha256File(path.join(REPO, 'data/public-port-guides.json')),
      recovery.production_public_port_guides_sha256
    )
  } else {
    const ochoRollbackGuides = path.join(
      REPO,
      'qa-evidence/publication-batch-03-ocho/rollback-pre-apply/ocho-rios-jamaica/public-port-guides.json'
    )
    assert.ok(fs.existsSync(ochoRollbackGuides), 'ocho publication rollback guides snapshot')
  }
  assert.ok(!fs.existsSync(path.join(EVIDENCE, 'rollback-pre-apply/public-port-guides.json')), 'no full catalogue duplicate in evidence')

  const rostockHtml = fs.readFileSync(path.join(REPO, 'ports/rostock-germany/index.html'), 'utf8')
  assert.match(rostockHtml, /warnemunde-berlin-germany/i, 'rostock redirect preserved')

  for (const slug of ['kirkenes-norway', 'ocho-rios-jamaica']) {
    const row = manifest.ports.find((p) => p.landing_slug === slug)
    assert.ok(row, `manifest row ${slug}`)
    assert.strictEqual(row.publication_gates_pass, true, `${slug} editorial gates`)
    assert.strictEqual(row.full_html_gates_pass, true, `${slug} html gates`)

    const htmlPath = path.join(EVIDENCE, 'candidate-applied/ports', slug, 'index.html')
    assert.ok(fs.existsSync(htmlPath), `candidate html ${slug}`)
    const html = fs.readFileSync(htmlPath, 'utf8')
    assert.match(html, /noindex/i, `${slug} candidate stays noindex`)
    const counts = headJsonLdTypeCounts(html)
    assert.strictEqual(counts.TouristDestination, 1, `${slug} TouristDestination`)
    assert.strictEqual(counts.BreadcrumbList, 1, `${slug} BreadcrumbList`)
    assert.strictEqual(counts.FAQPage, 1, `${slug} FAQPage`)
    assert.ok(html.includes('pg-call-plan-card--short'), `${slug} short call plan`)
    assert.ok(html.includes('pg-call-plan-card--standard'), `${slug} standard call plan`)
    assert.ok(html.includes('pg-call-plan-card--longer'), `${slug} longer call plan`)

    if (slug === 'ocho-rios-jamaica' && ochoLive) {
      const prodPath = path.join(REPO, 'ports', slug, 'index.html')
      assert.strictEqual(sha256File(prodPath), sha256File(htmlPath), `${slug} live html matches verified candidate`)
    } else {
      assert.strictEqual(
        sha256File(path.join(REPO, 'ports', slug, 'index.html')),
        sha256File(path.join(EVIDENCE, 'rollback-pre-apply/ports', slug, 'index.html')),
        `${slug} production html restored to prep stub`
      )
    }

    const appPortId = slug === 'kirkenes-norway' ? 'kirkenes' : 'ocho-rios'
    const guideJson = JSON.parse(
      fs.readFileSync(path.join(EVIDENCE, 'candidate-applied', `byAppPortId.${appPortId}.json`), 'utf8')
    )
    assertNoForbiddenPassengerCopy(`${slug} guide json`, collectGuidePassengerLeakBlob(guideJson))
    assertNoForbiddenPassengerCopy(`${slug} candidate html`, html)

    const faqLd = (html.match(/<script type="application\/ld\+json">(\{.*?"@type":"FAQPage"[\s\S]*?\})<\/script>/) || [])[1]
    if (faqLd) assertNoForbiddenPassengerCopy(`${slug} FAQ JSON-LD`, faqLd)

    if (slug === 'ocho-rios-jamaica') {
      assert.ok(!/walkable from the gangway/i.test(html) || /not|Do not assume/i.test(html), 'no bare gangway walk claim')
      assert.ok(/Dunn/i.test(html), 'Dunn’s only in excursion context')
      const notable = guideJson.facts?.notableFeatures || []
      assert.ok(
        !notable.some((f) => /Dunn|Dolphin Cove/i.test(String(f))),
        'notableFeatures must not imply walk-off Dunn or Dolphin Cove'
      )
      const visa = String(guideJson.politics?.visaRequirements || '')
      assert.match(visa, /nationality|cruise-passenger|confirm/i, 'conservative visa wording')
      assert.ok(!/Visa-free for many nationalities/i.test(visa), 'no unsupported visa-free generalization')
      assert.strictEqual((guideJson.thingsToDo?.topThings || []).length, 3, 'three topThings')
      assert.strictEqual(guideJson.size?.berthCount ?? null, null, 'unverified berthCount must not leak into candidate guide JSON')
      assert.ok(!/\"berthCount\":\s*2/.test(html), 'candidate html must not expose numeric berth count')
    }
    if (slug === 'kirkenes-norway') {
      assert.ok(/Dypvannskaia/i.test(html), 'kirkenes pier named')
      assert.ok(!/\d+\s*m(?:etre|eter)?\s+walk/i.test(html), 'no invented metre walk')
      assert.strictEqual((guideJson.thingsToDo?.topThings || []).length, 3, 'three topThings')
      const tops = (guideJson.thingsToDo?.topThings || []).join('\n')
      assert.match(tops, /Borderland Museum/i)
      assert.match(tops, /only if open|hours not verified/i)
      assert.match(tops, /King crab|king crab/i)
      assert.match(tops, /booked operator|not a guaranteed/i)
    }
  }

  const peMatrix = JSON.parse(
    execSync('node scripts/publication-batch-workflow.js matrix', { cwd: REPO, encoding: 'utf8' })
  )
  if (ochoLive) {
    assert.strictEqual(peMatrix.baseline.live_passenger_editorial, BASELINE_PE + 1)
  } else {
    assert.strictEqual(peMatrix.baseline.live_passenger_editorial, BASELINE_PE)
  }
  assert.strictEqual(peMatrix.baseline.reconcile, true)

  console.log('test-batch03-kirkenes-ocho-candidate PASS')
}

main()

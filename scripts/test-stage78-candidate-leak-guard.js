#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { countPassengerEditorialGuides } = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const SLUGS = [
  'fort-lauderdale-fl-united-states',
  'juneau-ak-united-states',
  'long-beach-ca-united-states',
  'montreal-qc-canada',
  'ponce-puerto-rico',
]

function extractMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  return m ? m[1] : html
}

const guides = loadPublicPortGuidesFile(REPO)
const peCount = countPassengerEditorialGuides(guides)
assert.strictEqual(peCount, 355, `expected 355 passenger_editorial on candidate branch, got ${peCount}`)

for (const slug of SLUGS) {
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
  assert.ok(fs.existsSync(htmlPath), `missing html: ${slug}`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const main = extractMain(html)
  assert.ok(!containsInternalResearchLeak(main), `html leak: ${slug}`)
  assert.ok((main.match(/pg-call-plan-card/g) || []).length >= 3, `call plans: ${slug}`)
  assert.ok(html.includes('application/ld+json'), `schema: ${slug}`)

  const guide = Object.values(guides.byAppPortId || {}).find((g) => g?.researchImport?.landing_slug === slug)
  assert.ok(guide, `guide missing: ${slug}`)
  assert.ok(!containsInternalResearchLeak(collectGuidePassengerLeakBlob(guide)), `json leak: ${slug}`)
  assert.strictEqual(guide.researchImport?.stage78_publication_candidate, true, `${slug} stage78 marker`)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial', `${slug} tier`)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, false, `${slug} auth`)
}

console.log('test-stage78-candidate-leak-guard PASS', { slugs: SLUGS.length, passenger_editorial: peCount })

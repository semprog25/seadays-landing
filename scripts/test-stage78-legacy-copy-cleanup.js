#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')

const REPO = path.join(__dirname, '..')
const SLUGS = [
  'boston-ma-united-states',
  'cabo-san-lucas-mexico',
  'galveston-tx-united-states',
  'seattle-wa-united-states',
]

function extractMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  return m ? m[1] : html
}

for (const slug of SLUGS) {
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
  assert.ok(fs.existsSync(htmlPath), `${slug} HTML must exist`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  assert.ok(!containsInternalResearchLeak(extractMain(html)), `${slug}: main HTML leak scan`)
  assert.ok(!containsInternalResearchLeak(html), `${slug}: full HTML leak scan`)

  const guides = loadPublicPortGuidesFile(REPO)
  const guide = Object.values(guides.byAppPortId || {}).find((g) => g?.researchImport?.landing_slug === slug)
  assert.ok(guide, `${slug} guide in JSON`)
  assert.ok(!containsInternalResearchLeak(collectGuidePassengerLeakBlob(guide)), `${slug}: JSON passenger blob leak scan`)
}

const peCount = Object.values(loadPublicPortGuidesFile(REPO).byAppPortId || {}).filter(
  (g) => g?.researchImport?.publication_tier === 'passenger_editorial'
).length
assert.strictEqual(peCount, 350, 'passenger editorial count unchanged')

console.log('test-stage78-legacy-copy-cleanup PASS', { slugs: SLUGS.length, passenger_editorial: peCount })

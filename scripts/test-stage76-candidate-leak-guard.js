#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { containsInternalResearchLeak, collectGuidePassengerLeakBlob } = require('./lib/publicGuideCopySanitize')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { countPassengerEditorialGuides, removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const SLUGS = [
  'hobart-australia',
  'marigot-st-maarten',
  'nagasaki-japan',
  'nordfjordeid-norway',
  'okinawa-naha-japan',
  'stornoway-united-kingdom',
]

const FORBIDDEN = [
  /not isolated from/i,
  /HTML captured/i,
  /captured MLIT/i,
  /captured guide page/i,
  /minutes not verified/i,
  /exact metres unverified/i,
  /pins remain null/i,
]

function extractJsonLdPassengerText(html) {
  const chunks = []
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || []
  for (const block of blocks) {
    const inner = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>\s*$/i, '')
    try {
      const data = JSON.parse(inner)
      if (data['@type'] === 'FAQPage' && Array.isArray(data.mainEntity)) {
        for (const q of data.mainEntity) {
          const text = q?.acceptedAnswer?.text
          if (typeof text === 'string') chunks.push(text)
        }
      }
      if (data['@type'] === 'TouristDestination' && typeof data.description === 'string') {
        chunks.push(data.description)
      }
    } catch {
      // ignore malformed blocks
    }
  }
  return chunks
}

function assertNoForbidden(text, label) {
  for (const re of FORBIDDEN) {
    assert.ok(!re.test(text), `${label}: forbidden pattern ${re}`)
  }
  assert.ok(!containsInternalResearchLeak(text), `${label}: containsInternalResearchLeak`)
}

const guides = loadPublicPortGuidesFile(REPO)

for (const slug of SLUGS) {
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
  assert.ok(fs.existsSync(htmlPath), `${slug} HTML must exist`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const main = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] || html
  assertNoForbidden(main, `${slug} main HTML`)
  for (const chunk of extractJsonLdPassengerText(html)) {
    assertNoForbidden(chunk, `${slug} JSON-LD`)
  }

  const guide = Object.values(guides.byAppPortId || {}).find((g) => g?.researchImport?.landing_slug === slug)
  assert.ok(guide, `${slug} guide in JSON`)
  assert.strictEqual(guide.researchImport?.stage76_publication_candidate, true, `${slug} stage76 marker`)
  assertNoForbidden(collectGuidePassengerLeakBlob(guide), `${slug} JSON passenger blob`)
}

removeStage65ExcludedGuideEntries(guides)
const peCount = countPassengerEditorialGuides(guides)
assert.strictEqual(peCount, 350, 'passenger editorial count on candidate branch')

console.log('test-stage76-candidate-leak-guard PASS', { slugs: SLUGS.length, passenger_editorial: peCount })

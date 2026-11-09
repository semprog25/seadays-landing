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

const STAGE78_RESEARCH_PHRASE_RE = [
  /\bnot verified\b/i,
  /\bpin null\b/i,
  /\bpins remain null\b/i,
  /\bdoor pin null\b/i,
  /\b(hours|ticket hours|walk minutes|transfer minutes) not verified\b/i,
  /\bNot verified in\b/i,
]

function assertPassengerCopyClean(text, label) {
  const s = String(text || '')
  if (!s.trim()) return
  assert.ok(!containsInternalResearchLeak(s), `${label}: internal research leak`)
  for (const re of STAGE78_RESEARCH_PHRASE_RE) {
    assert.ok(!re.test(s), `${label}: research phrase ${re.source}`)
  }
}

function extractJsonLdBlocks(html) {
  const blocks = []
  const re = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) blocks.push(m[1])
  return blocks
}

function extractMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
  return m ? m[1] : html
}

const guides = loadPublicPortGuidesFile(REPO)
const peCount = countPassengerEditorialGuides(guides)
assert.strictEqual(peCount, 355, `expected 355 passenger editorial on candidate branch, got ${peCount}`)

for (const slug of SLUGS) {
  const htmlPath = path.join(REPO, 'ports', slug, 'index.html')
  assert.ok(fs.existsSync(htmlPath), `missing html: ${slug}`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const main = extractMain(html)
  assertPassengerCopyClean(main, `${slug} html main`)
  for (const block of extractJsonLdBlocks(html)) {
    assertPassengerCopyClean(block, `${slug} json-ld`)
  }
  assert.ok((main.match(/pg-call-plan-card/g) || []).length >= 3, `call plans: ${slug}`)
  assert.ok(html.includes('application/ld+json'), `schema: ${slug}`)
  assert.ok(/viator\.com|partner\.viator/i.test(html) || /Bookable Experiences/i.test(html), `${slug} viator/affiliate surface`)

  const guide = Object.values(guides.byAppPortId || {}).find((g) => g?.researchImport?.landing_slug === slug)
  assert.ok(guide, `guide missing: ${slug}`)
  assertPassengerCopyClean(collectGuidePassengerLeakBlob(guide), `${slug} json blob`)
  if (guide.gettingThere) assertPassengerCopyClean(JSON.stringify(guide.gettingThere), `${slug} gettingThere`)
  if (guide.thingsToDo) assertPassengerCopyClean(JSON.stringify(guide.thingsToDo), `${slug} thingsToDo`)
  assert.strictEqual(guide.researchImport?.stage78_publication_candidate, true, `${slug} stage78 marker`)
  assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial', `${slug} tier`)
  assert.strictEqual(guide.researchImport?.owner_publication_authorized, false, `${slug} auth`)
}

console.log('test-stage78-candidate-leak-guard PASS', { slugs: SLUGS.length, passenger_editorial: peCount })

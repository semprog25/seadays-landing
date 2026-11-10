#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  containsInternalResearchLeak,
  collectGuidePassengerLeakBlob,
} = require('./lib/publicGuideCopySanitize')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { countPassengerEditorialGuides } = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const SLUG = 'hamburg-germany'

const guides = loadPublicPortGuidesFile(REPO)
const peCount = countPassengerEditorialGuides(guides)
assert.strictEqual(peCount, 356, `expected 356 passenger editorial, got ${peCount}`)

const htmlPath = path.join(REPO, 'ports', SLUG, 'index.html')
const html = fs.readFileSync(htmlPath, 'utf8')
assert.ok(/noindex/i.test(html), 'must remain noindex on candidate branch')
assert.ok((html.match(/<article class="pg-call-plan-card/g) || []).length >= 3, 'call plans')

const guide = guides.byAppPortId.hamburg
assert.ok(guide, 'hamburg guide')
assert.strictEqual(guide.researchImport?.stage82_hamburg_graduation_candidate, true)
assert.strictEqual(guide.researchImport?.publication_tier, 'passenger_editorial')
assert.strictEqual(guide.researchImport?.owner_publication_authorized, false)
assert.strictEqual(guide.researchImport?.owner_indexing_authorized, false)
assert.strictEqual(guide.researchImport?.qa_verdict, 'PASS')

assert.ok(!containsInternalResearchLeak(collectGuidePassengerLeakBlob(guide)), 'json leak')
assert.ok(!containsInternalResearchLeak(html), 'html leak')

console.log('test-stage82-candidate-leak-guard PASS')

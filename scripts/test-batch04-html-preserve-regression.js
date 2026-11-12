#!/usr/bin/env node
'use strict'

const assert = require('assert')
const {
  shouldPreservePassengerEditorialBody,
  mergePassengerEditorialBodyPreservation,
} = require('./lib/publishedPortHtmlPreserve')

const cards = `<article class="pg-call-plan-card"></article>`.repeat(3)
const OLD_BODY = `<main class="pg-main"><div class="pg-lead-guide">Kirkenes live body</div>${cards}</main>`
const NEW_BODY = '<main class="pg-main"><p>Regenerated draft body</p></main>'
const wrap = (body) => `<!DOCTYPE html><html><head></head><body>${body}</body></html>`

const kirkenesGuide = {
  portInfo: { description: 'Kirkenes passenger editorial lead for preservation regression.' },
  researchImport: { publication_tier: 'passenger_editorial', owner_publication_authorized: true },
}

assert.strictEqual(
  shouldPreservePassengerEditorialBody(wrap(NEW_BODY), wrap(OLD_BODY), kirkenesGuide),
  true,
  'published passenger_editorial must prefer committed html when regen drops call plans',
)

const prepGuide = { researchImport: { batch04_preparation_only: true } }
assert.strictEqual(
  shouldPreservePassengerEditorialBody(wrap(NEW_BODY), wrap(OLD_BODY), prepGuide),
  false,
  'batch04 prep must not block fresh regen bodies',
)

const regen = mergePassengerEditorialBodyPreservation(wrap(NEW_BODY), wrap(OLD_BODY), prepGuide)
assert.ok(regen.includes('Regenerated draft body'))

console.log('test-batch04-html-preserve-regression PASS')

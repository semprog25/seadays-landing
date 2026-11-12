#!/usr/bin/env node
'use strict'

const assert = require('assert')
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft')
const { patchTokyoYokohamaDraft } = require('./lib/bulkPortPublication/tokyoYokohamaPassengerPatch')

function main() {
  const existing = {
    appPortId: 'yokohama',
    portName: 'Yokohama',
    country: 'Japan',
    portInfo: { description: 'Stale boilerplate with excellent facilities.' },
    size: { terminalCount: 4, berthCount: 12 },
    politics: { visaRequirements: 'Visa-free for US, EU, UK, and many others (15-90 days)' },
    climate: { averageTemp: '16°C' },
    gettingThere: { walkingTime: '5-15 minutes depending on pier', fromTerminal: 'Daikoku Pier' },
  }
  const baseDraft = {
    landing_slug: 'tokyo-yokohama-japan',
    appPortId: 'yokohama',
    portName: 'Tokyo / Yokohama',
    country: 'Japan',
    portInfo: { description: 'Draft lead only.' },
    gettingThere: {
      fromTerminal: 'Osanbashi or Tokyo terminals per sailing documents.',
      distanceAnswer: 'Depends on terminal assignment.',
    },
    thingsToDo: {
      intro: 'Plan one scale.',
      shortCall: 'Stay near terminal.',
      standardCall: 'One highlight plus buffer.',
      longerCall: 'Full day only with confirmed transport.',
      practicalTip: 'Match terminal name.',
      topThings: ['A', 'B', 'C'],
    },
    shorePlansFirst: true,
  }
  const draft = patchTokyoYokohamaDraft(baseDraft)
  const out = applyEditorialDraftToGuide({
    existingGuide: existing,
    draft,
    fieldExclusions: [],
    lockMeta: {
      draft_version: 'test',
      research_sha256: '7e1a1016bff4d827fe7fa1246531b3c242a8b9d5584b0c0126e917e3fbf6d017',
      landing_slug: 'tokyo-yokohama-japan',
      locked_at_utc: '2026-11-12T00:00:00.000Z',
    },
  })

  assert.strictEqual(out.portName, 'Tokyo / Yokohama')
  assert.strictEqual(out.size, undefined)
  assert.strictEqual(out.climate, undefined)
  assert.strictEqual(out.facts, undefined)
  assert.ok(!/15-90 days/i.test(out.politics?.visaRequirements || ''))
  assert.ok(!/Daikoku/i.test(out.gettingThere?.fromTerminal || ''))
  assert.ok(!/quay LOA/i.test(out.portInfo?.description || ''))
  assert.ok(!/captured TPTC/i.test(out.portInfo?.description || ''))
  assert.strictEqual(out.gettingThere.walkingTime, undefined)
  console.log(JSON.stringify({ ok: true, test: 'stage24-legacy-inherit-guard' }))
}

main()

#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  assignPublicPortGuideByAppPortId,
  assertPublicPortGuidesPayloadSafe,
  assertSafePublicPortGuideSlotWrite,
  BLOCK_CODE,
} = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const {
  buildSlugToAppPortIdMap,
  loadPublicPortGuidesFile,
  writePublicPortGuidesFile,
} = require('./lib/publicPortGuideAdapter')

const REPO = path.join(__dirname, '..')

const ukFalmouth = {
  appPortId: 'falmouth',
  portName: 'Falmouth',
  country: 'UK',
  portInfo: { description: 'Cornish harbour town' },
  researchImport: {
    publication_tier: 'passenger_editorial',
    landing_slug: 'falmouth-united-kingdom',
  },
}

const jamaicaProposed = {
  appPortId: 'falmouth',
  portName: 'Falmouth',
  country: 'Jamaica',
  portInfo: { description: 'Trelawny parish' },
  researchImport: { landing_slug: 'falmouth-jamaica' },
}

assert.throws(
  () =>
    assertSafePublicPortGuideSlotWrite({
      landingSlug: 'falmouth-jamaica',
      targetAppPortId: 'falmouth',
      proposedGuide: jamaicaProposed,
      priorGuideAtSlot: ukFalmouth,
    }),
  (err) => err.code === BLOCK_CODE
)

const next = { byAppPortId: { falmouth: JSON.parse(JSON.stringify(ukFalmouth)) } }
assert.throws(
  () =>
    assignPublicPortGuideByAppPortId(next, {
      landingSlug: 'falmouth-jamaica',
      appPortId: 'falmouth',
      guide: jamaicaProposed,
      priorGuideAtSlot: ukFalmouth,
    }),
  (err) => err.code === BLOCK_CODE
)
assert.strictEqual(next.byAppPortId.falmouth.researchImport.landing_slug, 'falmouth-united-kingdom')

assignPublicPortGuideByAppPortId(next, {
  landingSlug: 'falmouth-united-kingdom',
  appPortId: 'falmouth',
  guide: { ...ukFalmouth, portInfo: { description: 'Updated UK copy' } },
  priorGuideAtSlot: ukFalmouth,
})
assert.ok(next.byAppPortId.falmouth.portInfo.description.includes('Updated UK'))

assert.throws(
  () =>
    assertPublicPortGuidesPayloadSafe({
      byAppPortId: { falmouth: jamaicaProposed },
    }),
  (err) => err.code === BLOCK_CODE
)

const live = loadPublicPortGuidesFile(REPO)
const map = buildSlugToAppPortIdMap(
  [
    { slug: 'falmouth-jamaica', name: 'Falmouth, Jamaica', country: 'Jamaica' },
    { slug: 'falmouth-united-kingdom', name: 'Falmouth, United Kingdom', country: 'United Kingdom' },
  ],
  null,
  live.byAppPortId
)
assert.strictEqual(map['falmouth-jamaica'] || '', '')
assert.strictEqual(map['falmouth-united-kingdom'], 'falmouth')

const niceGuides = {
  nice: {
    portName: 'Nice',
    country: 'France',
    researchImport: { landing_slug: 'villefranche-nice-france' },
  },
}
const niceMap = buildSlugToAppPortIdMap(
  [
    { slug: 'nice-france', name: 'Nice', country: 'France' },
    { slug: 'villefranche-nice-france', name: 'Villefranche', country: 'France' },
  ],
  null,
  niceGuides
)
assert.strictEqual(niceMap['nice-france'], 'nice')
assert.strictEqual(niceMap['villefranche-nice-france'], 'nice')

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-guides-guard-'))
const victoriaPayload = JSON.parse(JSON.stringify(live))
victoriaPayload.byAppPortId.testVictoriaOnly = {
  appPortId: 'testVictoriaOnly',
  portName: 'Test',
  country: 'Canada',
  researchImport: { landing_slug: 'victoria-bc-canada-test' },
}
writePublicPortGuidesFile(tmpDir, victoriaPayload)
const written = JSON.parse(fs.readFileSync(path.join(tmpDir, 'data/public-port-guides.json'), 'utf8'))
assert.ok(written.byAppPortId.testVictoriaOnly)
fs.rmSync(tmpDir, { recursive: true, force: true })

console.log('test-falmouth-homonym-publication-guard PASS')

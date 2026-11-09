#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const os = require('os')
const path = require('path')
const {
  BLOCK_CODE,
  FALMOUTH_UK_APP_PORT_ID,
} = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const {
  loadPublicPortGuidesFile,
  writePublicPortGuidesFile,
  writePublicPortGuidesFileAtomic,
  sanitizeBootstrapPublicPortGuidesExtract,
} = require('./lib/publicPortGuideAdapter')
const {
  writeContentOnlyGuide,
  writeApplyBatch,
} = require('./lib/portResearchImport/applyPortResearch')

const REPO = path.join(__dirname, '..')

const ukFalmouth = {
  appPortId: 'falmouth',
  portName: 'Falmouth',
  country: 'United Kingdom',
  portInfo: { description: 'Cornish harbour town' },
  researchImport: {
    publication_tier: 'passenger_editorial',
    landing_slug: 'falmouth-united-kingdom',
  },
}

const jamaicaFalmouth = {
  appPortId: 'falmouth',
  portName: 'Falmouth',
  country: 'Jamaica',
  portInfo: { description: 'Trelawny parish' },
  researchImport: { landing_slug: 'falmouth-jamaica' },
}

function mkTempRepoWithUkFalmouth() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-writer-guard-'))
  const dataDir = path.join(tmpDir, 'data')
  fs.mkdirSync(dataDir, { recursive: true })
  const payload = { byAppPortId: { falmouth: JSON.parse(JSON.stringify(ukFalmouth)) } }
  fs.writeFileSync(
    path.join(dataDir, 'public-port-guides.json'),
    `${JSON.stringify(payload, null, 2)}\n`,
    'utf8'
  )
  return { tmpDir, before: fs.readFileSync(path.join(dataDir, 'public-port-guides.json'), 'utf8') }
}

function assertFileUnchanged(tmpDir, before) {
  const after = fs.readFileSync(path.join(tmpDir, 'data/public-port-guides.json'), 'utf8')
  assert.strictEqual(after, before)
}

// writePublicPortGuidesFile boundary (maintenance + stage55 + bootstrap finalize)
{
  const { tmpDir, before } = mkTempRepoWithUkFalmouth()
  const poisoned = JSON.parse(before)
  poisoned.byAppPortId.falmouth = JSON.parse(JSON.stringify(jamaicaFalmouth))
  assert.throws(() => writePublicPortGuidesFile(tmpDir, poisoned), (e) => e.code === BLOCK_CODE)
  assertFileUnchanged(tmpDir, before)
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

// writePublicPortGuidesFileAtomic boundary (applyPortResearch batch paths)
{
  const { tmpDir, before } = mkTempRepoWithUkFalmouth()
  const poisoned = JSON.parse(before)
  poisoned.byAppPortId.falmouth = JSON.parse(JSON.stringify(jamaicaFalmouth))
  assert.throws(() => writePublicPortGuidesFileAtomic(tmpDir, poisoned), (e) => e.code === BLOCK_CODE)
  assertFileUnchanged(tmpDir, before)
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

// applyPortResearch writeContentOnlyGuide
{
  const { tmpDir, before } = mkTempRepoWithUkFalmouth()
  const guides = JSON.parse(before)
  assert.throws(
    () =>
      writeContentOnlyGuide({
        landingRepoRoot: tmpDir,
        appPortId: FALMOUTH_UK_APP_PORT_ID,
        guidesPayload: guides,
        nextGuide: jamaicaFalmouth,
      }),
    (e) => e.code === BLOCK_CODE
  )
  assertFileUnchanged(tmpDir, before)
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

// applyPortResearch writeApplyBatch
{
  const { tmpDir, before } = mkTempRepoWithUkFalmouth()
  const guides = JSON.parse(before)
  const terminalsPath = path.join(tmpDir, 'data/public-port-terminals.json')
  fs.mkdirSync(path.dirname(terminalsPath), { recursive: true })
  fs.writeFileSync(terminalsPath, '{"byPortId":{}}\n', 'utf8')
  const terminalsBefore = fs.readFileSync(terminalsPath, 'utf8')
  assert.throws(
    () =>
      writeApplyBatch({
        landingRepoRoot: tmpDir,
        appPortId: FALMOUTH_UK_APP_PORT_ID,
        guidesPayload: guides,
        terminalsPayload: { byPortId: {} },
        mergedGuide: jamaicaFalmouth,
        mergedTerminals: { list: [] },
      }),
    (e) => e.code === BLOCK_CODE
  )
  assertFileUnchanged(tmpDir, before)
  assert.strictEqual(fs.readFileSync(terminalsPath, 'utf8'), terminalsBefore)
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

// empty-bootstrap extract sanitization
{
  const extracted = {
    byAppPortId: {
      falmouth: JSON.parse(JSON.stringify(jamaicaFalmouth)),
      nice: { portName: 'Nice', country: 'France' },
    },
  }
  const sanitized = sanitizeBootstrapPublicPortGuidesExtract(extracted)
  assert.strictEqual(sanitized.byAppPortId.falmouth, undefined)
  assert.ok(sanitized.byAppPortId.nice)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-bootstrap-guard-'))
  writePublicPortGuidesFile(tmpDir, sanitized)
  const live = loadPublicPortGuidesFile(REPO)
  const payload = JSON.parse(JSON.stringify(live))
  payload.byAppPortId.falmouth.portInfo = { description: 'UK maintenance touch' }
  writePublicPortGuidesFile(tmpDir, payload)
  fs.rmSync(tmpDir, { recursive: true, force: true })
}

const liveUk = loadPublicPortGuidesFile(REPO)?.byAppPortId?.falmouth
assert.ok(liveUk, 'production UK falmouth guide present')
assert.notStrictEqual(
  String(liveUk.researchImport?.landing_slug || ''),
  'falmouth-jamaica'
)

console.log('test-falmouth-homonym-writer-coverage PASS')

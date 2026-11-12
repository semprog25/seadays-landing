#!/usr/bin/env node
'use strict'

const path = require('path')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const {
  assertBatch03KirkenesReleaseBinding,
  assertBatch03KirkenesReleaseInvariants,
} = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')
const { countPassengerEditorialGuides, removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')

const REPO = path.join(__dirname, '..')
const guides = loadPublicPortGuidesFile(REPO)
removeStage65ExcludedGuideEntries(guides)
const pe = countPassengerEditorialGuides(guides)

if (pe === 362) {
  const result = assertBatch03KirkenesReleaseBinding(REPO, guides)
  console.log('test-batch03-kirkenes-publication-release PASS', result)
} else if (pe === 363) {
  assertBatch03KirkenesReleaseInvariants(REPO, guides)
  console.log('test-batch03-kirkenes-publication-release PASS invariants @ PE 363')
} else {
  throw new Error(`unexpected passenger editorial count ${pe}`)
}

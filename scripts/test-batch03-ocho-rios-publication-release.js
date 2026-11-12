#!/usr/bin/env node
'use strict'

const path = require('path')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { countPassengerEditorialGuides, removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')
const {
  assertBatch03OchoRiosReleaseBinding,
  assertBatch03OchoRiosReleaseInvariants,
  RELEASE_PE,
} = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')
const { RELEASE_PE: KIRKENES_PE } = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')
const { RELEASE_PE: TOKYO_PE } = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')

const REPO = path.join(__dirname, '..')

const guides = loadPublicPortGuidesFile(REPO)
removeStage65ExcludedGuideEntries(guides)
const pe = countPassengerEditorialGuides(guides)
let result
if (pe === RELEASE_PE) {
  result = assertBatch03OchoRiosReleaseBinding(REPO, guides)
} else if (pe === KIRKENES_PE || pe === TOKYO_PE) {
  assertBatch03OchoRiosReleaseInvariants(REPO, guides)
  result = { pe, slug: 'ocho-rios-jamaica', app_port_id: 'ocho-rios', mode: `invariants_at_pe_${pe}` }
} else {
  throw new Error(`unexpected PE ${pe} for Ocho release test`)
}
console.log('test-batch03-ocho-rios-publication-release PASS', result)

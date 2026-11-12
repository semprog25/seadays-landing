#!/usr/bin/env node
'use strict'

const path = require('path')
const { assertPagesPassengerEditorialPePolicy } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

const repoRoot = path.join(__dirname, '..')

try {
  const result = assertPagesPassengerEditorialPePolicy(repoRoot)
  if (result.mode !== 'batch04_tokyo_release' || result.pe !== 363) {
    throw new Error(`expected batch04_tokyo_release pe 363, got ${JSON.stringify(result)}`)
  }
  console.log('assert-batch04-tokyo-pages-release-binding PASS', result)
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}

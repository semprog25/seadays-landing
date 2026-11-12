#!/usr/bin/env node
'use strict'

const path = require('path')
const { assertPagesPassengerEditorialPePolicy } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

const repoRoot = path.join(__dirname, '..')

try {
  const result = assertPagesPassengerEditorialPePolicy(repoRoot)
  console.log('assert-batch03-ocho-rios-pages-release-binding PASS', result)
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}

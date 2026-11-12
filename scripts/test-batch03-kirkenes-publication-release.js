#!/usr/bin/env node
'use strict'

const path = require('path')
const { assertBatch03KirkenesReleaseBinding } = require('./lib/bulkPortPublication/batch03KirkenesReleaseBinding')

const REPO = path.join(__dirname, '..')

const result = assertBatch03KirkenesReleaseBinding(REPO)
console.log('test-batch03-kirkenes-publication-release PASS', result)

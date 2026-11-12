#!/usr/bin/env node
'use strict'

const path = require('path')
const { assertBatch03OchoRiosReleaseBinding } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

const REPO = path.join(__dirname, '..')

const result = assertBatch03OchoRiosReleaseBinding(REPO)
console.log('test-batch03-ocho-rios-publication-release PASS', result)

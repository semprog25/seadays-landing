#!/usr/bin/env node
'use strict'

const path = require('path')
const { assertBatch04TokyoReleaseBinding } = require('./lib/bulkPortPublication/batch04TokyoReleaseBinding')

const REPO = path.join(__dirname, '..')

const result = assertBatch04TokyoReleaseBinding(REPO)
console.log('test-batch04-tokyo-publication-release PASS', result)

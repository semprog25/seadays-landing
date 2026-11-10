#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const {
  containsInternalResearchLeak,
  collectGuidePassengerLeakBlob,
} = require('./lib/publicGuideCopySanitize')

const REPO = path.join(__dirname, '..')
const SLUG = 'oslo-norway'
const guides = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
const guide = guides.byAppPortId?.oslo
assert.ok(guide?.researchImport?.landing_slug === SLUG, 'oslo guide slot')

assert.ok(!containsInternalResearchLeak(collectGuidePassengerLeakBlob(guide)), `${SLUG}: JSON passenger blob`)
const html = fs.readFileSync(path.join(REPO, 'ports', SLUG, 'index.html'), 'utf8')
assert.ok(!containsInternalResearchLeak(html), `${SLUG}: HTML leak scan`)
assert.ok(!html.includes('captured page'), `${SLUG}: must not contain captured page`)

console.log('test-stage79-oslo-legacy-leak PASS', { slug: SLUG })

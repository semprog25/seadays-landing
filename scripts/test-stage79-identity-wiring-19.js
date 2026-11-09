#!/usr/bin/env node
'use strict'

const assert = require('assert')
const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const PROP = path.join(REPO, 'qa-evidence/stage79-identity-wiring-19/STAGE79_IDENTITY_WIRING_PROPOSAL.json')
const data = JSON.parse(fs.readFileSync(PROP, 'utf8'))
assert.strictEqual(data.mappings.length, 19)
assert.strictEqual(data.safe_to_apply, false)
assert.strictEqual(data.production_apply_permitted, false)
const slugs = new Set(data.mappings.map((m) => m.landing_slug))
assert.ok(!slugs.has('juneau-ak-united-states'))
console.log('test-stage79-identity-wiring-19 PASS', { mappings: 19 })

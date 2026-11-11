#!/usr/bin/env node
'use strict'

const path = require('path')
const { writeRemainingPortStatusMatrix } = require('./lib/bulkPortPublication/buildRemainingPortStatusMatrix')
const { prepareBatchFromManifest } = require('./lib/bulkPortPublication/preparePublicationBatchCandidate')
const { applyBatchFromManifest } = require('./lib/bulkPortPublication/applyPublicationBatchCandidate')

const REPO = path.join(__dirname, '..')
const MANIFEST = 'qa-evidence/publication-batch-02/BATCH_02_MANIFEST.json'

function usage() {
  console.error('Usage: node scripts/publication-batch-02-workflow.js <matrix|prepare|apply [--dry-run]>')
  process.exit(2)
}

function main() {
  const cmd = process.argv[2]
  if (!cmd) usage()
  if (cmd === 'matrix') {
    const { path: outPath, matrix } = writeRemainingPortStatusMatrix(REPO)
    const batch02 = path.join(REPO, 'qa-evidence/publication-batch-02/REMAINING_PORT_STATUS_MATRIX.json')
    const fs = require('fs')
    fs.mkdirSync(path.dirname(batch02), { recursive: true })
    fs.copyFileSync(outPath, batch02)
    console.log(
      JSON.stringify(
        { ok: true, outPath, batch02_copy: batch02, summary: matrix.summary, baseline: matrix.baseline },
        null,
        2
      )
    )
    return
  }
  if (cmd === 'prepare') {
    const { prepBundle, bundleHash } = prepareBatchFromManifest(REPO, MANIFEST)
    console.log(JSON.stringify({ ok: true, bundle_hash: bundleHash, candidates: prepBundle.candidates.length }, null, 2))
    return
  }
  if (cmd === 'apply') {
    const dryRun = process.argv.includes('--dry-run')
    const result = applyBatchFromManifest(REPO, MANIFEST, { dryRun })
    console.log(JSON.stringify({ ok: true, ...result.applyReport }, null, 2))
    return
  }
  usage()
}

try {
  main()
} catch (err) {
  console.error(JSON.stringify({ error: err.code || 'BATCH_02_WORKFLOW_STOP', message: err.message }, null, 2))
  process.exit(42)
}

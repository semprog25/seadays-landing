#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage70-yaml-repair-31')
const STAGE67_PATCH = path.join(REPO, 'qa-evidence/stage67-yaml-repair-48/PORTS_MASTER_INDEX_SHA_PATCH.json')
const STAGE70_PATCH = path.join(OUT, 'PORTS_MASTER_INDEX_SHA_PATCH.json')

function main() {
  if (!fs.existsSync(STAGE67_PATCH)) throw new Error('missing stage67 patch — copy from main or stage69 branch')
  if (!fs.existsSync(STAGE70_PATCH)) throw new Error('run stage70-reconcile-research-yaml-31.js first')
  const s67 = JSON.parse(fs.readFileSync(STAGE67_PATCH, 'utf8'))
  const s70 = JSON.parse(fs.readFileSync(STAGE70_PATCH, 'utf8'))
  const overlap = Object.keys(s70.sha_patch).filter((k) => k in (s67.sha_patch || {}))
  if (overlap.length) throw new Error(`sha_patch overlap with stage67: ${overlap.join(', ')}`)

  const composite = {
    verified_research_commit: s70.verified_research_commit,
    index_source_path: s70.index_source_path,
    by_port_root: s70.by_port_root,
    generated_at_utc: new Date().toISOString(),
    cohort_size: (s67.cohort_size || 0) + (s70.cohort_size || 0),
    stage67_slugs: Object.keys(s67.sha_patch || {}).length,
    stage70_slugs: Object.keys(s70.sha_patch || {}).length,
    sha_patch: { ...(s67.sha_patch || {}), ...(s70.sha_patch || {}) },
  }

  fs.writeFileSync(
    path.join(OUT, 'COMPOSITE_SHA_PATCH.json'),
    `${JSON.stringify(composite, null, 2)}\n`,
    'utf8'
  )
  console.log(
    JSON.stringify({
      composite_slugs: Object.keys(composite.sha_patch).length,
      by_port_root: composite.by_port_root,
      out: path.join(OUT, 'COMPOSITE_SHA_PATCH.json'),
    })
  )
}

main()

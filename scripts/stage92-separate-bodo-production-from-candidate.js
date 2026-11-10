#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const REPO = path.join(__dirname, '..')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage89-bodo-candidate')
const ROLLBACK = path.join(EVIDENCE, 'rollback-pre-apply')
const CANDIDATE = path.join(EVIDENCE, 'candidate-applied')

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE92_SEPARATE_STOP', message: msg }, null, 2))
  process.exit(42)
}

function main() {
  if (!fs.existsSync(ROLLBACK)) fail('missing rollback-pre-apply')
  const liveHtml = path.join(REPO, 'ports/bod-norway/index.html')
  const candidateHtml = path.join(CANDIDATE, 'ports/bod-norway/index.html')
  fs.mkdirSync(path.dirname(candidateHtml), { recursive: true })
  if (!fs.existsSync(candidateHtml) && fs.existsSync(liveHtml)) {
    const cards = (fs.readFileSync(liveHtml, 'utf8').match(/<article class="pg-call-plan-card/g) || []).length
    if (cards >= 3) fs.copyFileSync(liveHtml, candidateHtml)
  }
  const candidateGuide = path.join(CANDIDATE, 'byAppPortId.bodo.json')
  if (!fs.existsSync(candidateGuide)) {
    const g = JSON.parse(fs.readFileSync(path.join(REPO, 'data/public-port-guides.json'), 'utf8'))
    if (g.byAppPortId?.bodo?.researchImport?.publication_tier === 'passenger_editorial') {
      fs.writeFileSync(candidateGuide, `${JSON.stringify(g.byAppPortId.bodo, null, 2)}\n`)
    }
  }

  fs.copyFileSync(path.join(ROLLBACK, 'public-port-guides.json'), path.join(REPO, 'data/public-port-guides.json'))
  fs.copyFileSync(
    path.join(ROLLBACK, 'ports/bod-norway/index.html'),
    path.join(REPO, 'ports/bod-norway/index.html')
  )

  execSync('node scripts/test-stage92-bodo-publication-safety.js', { cwd: REPO, stdio: 'inherit' })
  console.log(JSON.stringify({ ok: true, production_pe: 356, candidate_path: 'qa-evidence/stage89-bodo-candidate/candidate-applied' }, null, 2))
}

main()

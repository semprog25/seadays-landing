#!/usr/bin/env node
'use strict'

/**
 * Remove publication bindings for excluded slugs (ledger unchanged).
 *   node scripts/revert-destination-photo-batch-excluded-slugs.js le-havre-paris-france
 */

const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const repoRoot = path.join(__dirname, '..')
const slugs = process.argv.slice(2)
if (!slugs.length) {
  console.error('Usage: node scripts/revert-destination-photo-batch-excluded-slugs.js <slug> [...]')
  process.exit(1)
}

const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const ownerPath = path.join(repoRoot, 'data', 'ports-directory-destination-owner-candidates.json')

function loadJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function saveJson(p, obj) {
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

function runNode(script) {
  execFileSync(process.execPath, [path.join(__dirname, script)], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

for (const slug of slugs) {
  const review = loadJson(reviewPath)
  const owner = loadJson(ownerPath)
  if (review.humanApproved?.[slug]) delete review.humanApproved[slug]
  if (owner.ports?.[slug]) delete owner.ports[slug]
  saveJson(reviewPath, review)
  saveJson(ownerPath, owner)

  const assetDir = path.join(repoRoot, 'assets/img/ports-directory/ports', slug)
  if (fs.existsSync(assetDir)) {
    for (const f of fs.readdirSync(assetDir)) {
      if (f.includes('destination-exterior-batch03') || f.includes('destination-exterior-batch04')) {
        fs.unlinkSync(path.join(assetDir, f))
      }
    }
  }

  const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
  const mainHtml = execFileSync('git', ['show', `origin/main:ports/${slug}/index.html`], {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  fs.mkdirSync(path.dirname(htmlPath), { recursive: true })
  fs.writeFileSync(htmlPath, mainHtml, 'utf8')
  console.log(`[revert] ${slug}`)
}

runNode('build-destination-image-catalog.js')
runNode('regenerate-ports-index.js')

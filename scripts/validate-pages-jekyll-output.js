#!/usr/bin/env node
'use strict'

/**
 * Post-Jekyll checks for GitHub Actions Pages artifact (_site).
 * Run only after jekyll-build-pages (or scripts/build-local-pages-site.js locally).
 */

const assert = require('assert')
const fs = require('fs')
const path = require('path')
const { assertPagesPassengerEditorialPePolicy } = require('./lib/bulkPortPublication/batch03OchoRiosReleaseBinding')

const root = path.join(__dirname, '..')
const siteDir = process.env.SEADAYS_PAGES_SITE_DIR
  ? path.resolve(process.env.SEADAYS_PAGES_SITE_DIR)
  : path.join(root, '_site')

function walkRelativeFiles(dir, base = dir) {
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    const rel = path.relative(base, abs).split(path.sep).join('/')
    const st = fs.statSync(abs)
    if (st.isDirectory()) out.push(...walkRelativeFiles(abs, base))
    else out.push(rel)
  }
  return out
}

function main() {
  assert.ok(fs.existsSync(siteDir), `_site missing at ${siteDir}; run Jekyll build first`)

  const files = walkRelativeFiles(siteDir)
  const qaPublished = files.filter((rel) => rel === 'qa-evidence' || rel.startsWith('qa-evidence/'))
  assert.strictEqual(
    qaPublished.length,
    0,
    `qa-evidence must not be served from Pages: ${qaPublished.slice(0, 5).join(', ')}`,
  )

  const githubPublished = files.filter((rel) => rel === '.github' || rel.startsWith('.github/'))
  assert.strictEqual(
    githubPublished.length,
    0,
    `.github must not be served from Pages: ${githubPublished.slice(0, 3).join(', ')}`,
  )

  const mustPublish = [
    'index.html',
    'robots.txt',
    'sitemap.xml',
    'CNAME',
    'data/public-port-guides.json',
    'ships/index.html',
    'ports/index.html',
    'blog/index.html',
  ]
  for (const rel of mustPublish) {
    assert.ok(files.includes(rel), `expected in _site: ${rel}`)
  }

  const cname = fs.readFileSync(path.join(siteDir, 'CNAME'), 'utf8').trim()
  assert.strictEqual(cname, 'seadays.app', 'CNAME must remain seadays.app')

  const pePolicy = assertPagesPassengerEditorialPePolicy(root)

  console.log('validate-pages-jekyll-output PASS', {
    site_dir: siteDir,
    file_count: files.length,
    passenger_editorial: pePolicy.pe,
    pe_policy_mode: pePolicy.mode,
  })
}

try {
  main()
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}

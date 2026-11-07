#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const repoRoot = path.join(__dirname, '..')
const REVIEW = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const CATALOG = path.join(repoRoot, 'data', 'destination-image-catalog.json')
const COUNTRY = path.join(repoRoot, 'data', 'ports-directory-country-images.json')
const REGION = path.join(repoRoot, 'data', 'ports-directory-region-images-provided.json')

const EXCLUDED_SLUGS = ['kristiansund-norway', 'skjolden-norway']
const INCLUDED_SLUGS = ['kochi-india', 'reine-norway']

function mainFromGit(filePath) {
  return JSON.parse(execSync(`git show origin/main:${filePath}`, { cwd: repoRoot, encoding: 'utf8' }))
}

const review = JSON.parse(fs.readFileSync(REVIEW, 'utf8'))
for (const slug of EXCLUDED_SLUGS) {
  delete review.humanApproved[slug]
}
for (const slug of INCLUDED_SLUGS) {
  if (!review.humanApproved[slug]) throw new Error(`missing approved ${slug}`)
}
fs.writeFileSync(REVIEW, `${JSON.stringify(review, null, 2)}\n`)

const mainRegion = mainFromGit('data/ports-directory-region-images-provided.json')
fs.writeFileSync(REGION, `${JSON.stringify(mainRegion, null, 2)}\n`)

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
const mainCatalog = mainFromGit('data/destination-image-catalog.json')
const mainNe = mainCatalog.records.find(
  (r) => r.role === 'region-thumbnail' && r.region === 'Northern Europe' && r.displayUrl?.includes('northern-europe-owner-northern-europe')
)
if (!mainNe) throw new Error('main Northern Europe catalog record missing')

catalog.records = catalog.records.filter(
  (r) => !(EXCLUDED_SLUGS.includes(r.portSlug) && r.role === 'port-destination')
)
const neIdx = catalog.records.findIndex(
  (r) => r.displayUrl && r.displayUrl.includes('northern-europe-owner-portpic-20261107')
)
if (neIdx >= 0) catalog.records[neIdx] = { ...mainNe }

const statusCounts = { VERIFIED: 0, NEEDS_REVIEW: 0, REJECTED: 0 }
for (const r of catalog.records) {
  const s = r.verificationStatus || 'NEEDS_REVIEW'
  if (statusCounts[s] !== undefined) statusCounts[s] += 1
}
catalog.recordCount = catalog.records.length
catalog.statusCounts = statusCounts
catalog.generatedAt = new Date().toISOString()
fs.writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`)

const country = JSON.parse(fs.readFileSync(COUNTRY, 'utf8'))
const no = country.countries.norway
if (!no?.url?.includes('destination-browse-owner-portpic-norway')) {
  throw new Error('Norway must remain Option A portpic browse image')
}
const prevUrl = '/assets/img/ports-directory/countries/norway/destination-browse-rc-A-pexels-33583891.webp'
if (no.portpicApply) {
  no.portpicApply.supersededUrl = prevUrl
  no.portpicApply.provenanceStatus = 'STOCK_IDENTITY_VERIFIED_2026-11-07'
}
country.verificationStatus = 'owner_portpic_option_a_20261107'
country.updatedAt = new Date().toISOString()
fs.writeFileSync(COUNTRY, `${JSON.stringify(country, null, 2)}\n`)

for (const slug of EXCLUDED_SLUGS) {
  const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
  execSync(`git show origin/main:ports/${slug}/index.html`, { cwd: repoRoot, encoding: 'utf8' })
  const mainHtml = execSync(`git show origin/main:ports/${slug}/index.html`, {
    cwd: repoRoot,
    encoding: 'utf8',
  })
  fs.writeFileSync(htmlPath, mainHtml)
}

console.log('[option-a] pruned excluded ports, restored region + catalog NE, restored excluded HTML')

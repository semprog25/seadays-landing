#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const BASE = 'https://seadays.app'

const INCLUDED_PORT_SLUGS = ['kochi-india', 'reine-norway']
const EXCLUDED_PORT_SLUGS = ['kristiansund-norway', 'skjolden-norway']
const EXCLUDED_REGION_URL = 'northern-europe-owner-portpic-20261107'
const INCLUDED_NORWAY_COUNTRY = 'destination-browse-owner-portpic-norway.webp'

const review = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-image-review-state.json'), 'utf8')
)
const country = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-country-images.json'), 'utf8')
)
const region = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-region-images-provided.json'), 'utf8')
)
const catalogText = fs.readFileSync(path.join(repoRoot, 'data', 'destination-image-catalog.json'), 'utf8')

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

for (const slug of INCLUDED_PORT_SLUGS) {
  const human = review.humanApproved[slug]
  assert(human && human.url, `humanApproved ${slug}`)
  assert(human.productionLicenseVerified === true, `${slug} licence verified`)
  assert(human.url.includes('destination-owner-portpic-'), `${slug} url must be portpic stem`)
  const assetPath = path.join(repoRoot, human.url.replace(/^\//, ''))
  assert(fs.existsSync(assetPath), `asset missing ${assetPath}`)
  const html = fs.readFileSync(path.join(repoRoot, 'ports', slug, 'index.html'), 'utf8')
  const abs = `${BASE}${human.url}`
  const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1]
  assert(og === abs, `${slug} og:image`)
  const hero = (html.match(/seo-hero-img[^>]*src="([^"]+)"/) || [])[1]
  assert(hero === human.url, `${slug} hero src`)
  const ld = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"TouristDestination"[\s\S]*?\})<\/script>/
  )
  assert(ld, `${slug} TouristDestination JSON-LD`)
  const j = JSON.parse(ld[1])
  assert(j.image === abs, `${slug} JSON-LD image`)
}

for (const slug of EXCLUDED_PORT_SLUGS) {
  assert(!review.humanApproved[slug], `excluded humanApproved ${slug} must be absent`)
  const html = fs.readFileSync(path.join(repoRoot, 'ports', slug, 'index.html'), 'utf8')
  assert(!html.includes('destination-owner-portpic-'), `${slug} HTML must not reference portpic`)
}

assert(
  country.countries.norway.url.includes(INCLUDED_NORWAY_COUNTRY),
  'Norway country browse must use portpic asset'
)
assert(country.countries.norway.productionLicenseVerified === true, 'Norway licence verified')
const norwayAsset = path.join(
  repoRoot,
  country.countries.norway.url.replace(/^\//, '')
)
assert(fs.existsSync(norwayAsset), 'Norway asset missing')

const ne = region.regions['Northern Europe']
assert(!ne.imageUrl.includes(EXCLUDED_REGION_URL), 'Northern Europe must not use excluded portpic region asset')
assert(
  ne.imageUrl.includes('northern-europe-owner-northern-europe.webp'),
  'Northern Europe restored to main region asset'
)

assert(!catalogText.includes(EXCLUDED_REGION_URL), 'catalog must not reference excluded region portpic')
for (const slug of EXCLUDED_PORT_SLUGS) {
  assert(!catalogText.includes(`destination-owner-portpic-${slug}`), `catalog must not reference ${slug} portpic`)
}

const indexHtml = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8')
assert(!indexHtml.includes(EXCLUDED_REGION_URL), 'ports index must not reference excluded region portpic')
for (const slug of EXCLUDED_PORT_SLUGS) {
  assert(!indexHtml.includes(`destination-owner-portpic-${slug}`), `ports index must not reference ${slug} portpic`)
}
assert(indexHtml.includes(INCLUDED_NORWAY_COUNTRY), 'ports index Norway browse')

const goa = fs.readFileSync(path.join(repoRoot, 'ports/goa-india/index.html'), 'utf8')
assert(goa.includes('/ports/mormugao-port-goa-india/'), 'goa redirect target intact')

console.log('OK test-portpic-replacements-20261107 (3 included, 4 excluded)')

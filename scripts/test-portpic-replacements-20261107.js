#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const BASE = 'https://seadays.app'

const INCLUDED_PORT_SLUGS = ['kochi-india', 'reine-norway']
const EXCLUDED_PORT_SLUGS = ['kristiansund-norway', 'skjolden-norway']
const INCLUDED_NORWAY_COUNTRY = 'destination-browse-owner-portpic-norway.webp'
const INCLUDED_NORTHERN_EUROPE_REGION = 'northern-europe-owner-portpic-20261107.webp'

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
const norwayAsset = path.join(repoRoot, country.countries.norway.url.replace(/^\//, ''))
assert(fs.existsSync(norwayAsset), 'Norway asset missing')

const ne = region.regions['Northern Europe']
assert(ne.imageUrl.includes(INCLUDED_NORTHERN_EUROPE_REGION), 'Northern Europe region image')
assert(ne.attribution?.productionLicenseVerified === true, 'Northern Europe licence verified')
assert(ne.attribution?.providerImageId === 34514019, 'Northern Europe Pexels ID')
assert(ne.attribution?.photographer === 'Frank Wesneck', 'Northern Europe photographer')
const neAsset = path.join(repoRoot, ne.imageUrl.replace(/^\//, ''))
assert(fs.existsSync(neAsset), 'Northern Europe asset missing')
assert(
  ne.portpicApply?.sourceSha256 === '75f3cd1f0aa1fbfefec98d4f35c90341a4e8f496b26a98ac06cc8abbc5c91cee',
  'Northern Europe source hash'
)

assert(catalogText.includes(INCLUDED_NORTHERN_EUROPE_REGION), 'catalog Northern Europe portpic')
for (const slug of EXCLUDED_PORT_SLUGS) {
  assert(!catalogText.includes(`destination-owner-portpic-${slug}`), `catalog must not reference ${slug} portpic`)
}

const indexHtml = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8')
assert(indexHtml.includes(INCLUDED_NORTHERN_EUROPE_REGION), 'ports index Northern Europe region card')
assert(indexHtml.includes(INCLUDED_NORWAY_COUNTRY), 'ports index Norway browse')
for (const slug of EXCLUDED_PORT_SLUGS) {
  assert(!indexHtml.includes(`destination-owner-portpic-${slug}`), `ports index must not reference ${slug} portpic`)
}

const goa = fs.readFileSync(path.join(repoRoot, 'ports/goa-india/index.html'), 'utf8')
assert(goa.includes('/ports/mormugao-port-goa-india/'), 'goa redirect target intact')

console.log('OK test-portpic-replacements-20261107 (4 approved, 3 port exclusions)')

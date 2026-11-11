#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const BASE = 'https://seadays.app'

const SLUGS = ['kristiansund-norway', 'skjolden-norway']

const EXPECTED = {
  'kristiansund-norway': {
    photographer: 'Davide Mauro',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    commonsHost: 'commons.wikimedia.org/wiki/File:Port_of_Kristiansund_1',
    assetPart: 'destination-commons-approved-kristiansund-norway',
  },
  'skjolden-norway': {
    photographer: 'Gary Bembridge',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    commonsHost: 'commons.wikimedia.org/wiki/File:Queen_Elizabeth_Skjolden_Norway',
    assetPart: 'destination-commons-approved-skjolden-norway',
  },
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const review = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-image-review-state.json'), 'utf8')
)

for (const slug of SLUGS) {
  const exp = EXPECTED[slug]
  const human = review.humanApproved[slug]
  assert(human && human.url, `humanApproved ${slug}`)
  assert(human.url.includes(exp.assetPart), `${slug} asset stem`)
  assert(human.photographer === exp.photographer, `${slug} photographer`)
  assert(human.licenseUrl === exp.licenseUrl, `${slug} licence url`)
  assert(human.productionLicenseVerified === true, `${slug} licence verified`)
  assert(human.geographicVerificationStatus === 'OK', `${slug} geo ok`)

  const assetPath = path.join(repoRoot, human.url.replace(/^\//, ''))
  assert(fs.existsSync(assetPath), `asset missing ${assetPath}`)

  const html = fs.readFileSync(path.join(repoRoot, 'ports', slug, 'index.html'), 'utf8')
  const abs = `${BASE}${human.url}`

  const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1]
  assert(og === abs, `${slug} og:image`)
  const tw = (html.match(/property="twitter:image" content="([^"]+)"/) || [])[1]
  assert(tw === abs, `${slug} twitter:image`)

  const hero = (html.match(/seo-hero-img[^>]*src="([^"]+)"/) || [])[1]
  assert(hero === human.url, `${slug} hero src`)

  const ld = html.match(
    /<script type="application\/ld\+json">(\{[\s\S]*?"@type":"TouristDestination"[\s\S]*?\})<\/script>/
  )
  assert(ld, `${slug} TouristDestination JSON-LD`)
  const j = JSON.parse(ld[1])
  assert(j.image === abs, `${slug} JSON-LD image`)

  assert(html.includes(exp.photographer), `${slug} caption photographer`)
  assert(html.includes(exp.licenseUrl), `${slug} caption licence link`)
  assert(html.includes(exp.commonsHost), `${slug} caption commons source`)
  assert(!html.includes('owner-provided download'), `${slug} no internal QA caption`)
  assert(!html.includes('confirm licence and geography'), `${slug} no geo QA caption`)
}

const hamburg = fs.readFileSync(path.join(repoRoot, 'ports/hamburg-germany/index.html'), 'utf8')
assert(hamburg.includes('destination-exterior-owner-hamburg'), 'Hamburg hero unchanged')

const kochi = fs.readFileSync(path.join(repoRoot, 'ports/kochi-india/index.html'), 'utf8')
assert(kochi.includes('destination-owner-portpic-kochi-india'), 'Kochi hero unchanged')

console.log('OK test-two-port-commons-heroes-20261111')

#!/usr/bin/env node
/**
 * Targeted check: 38 port slugs from OWNER_DOWNLOADS_53_APPLY_REPORT (excluding goa-india)
 * must use humanApproved.url for hero src, og:image, twitter:image, and JSON-LD image.
 * Goa redirect stub unchanged. Hamburg is not in the 38-slug regen list — spot-check not required here.
 */
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const BASE_URL = 'https://seadays.app'

const report = JSON.parse(
  fs.readFileSync(
    path.join(repoRoot, 'qa-evidence', 'owner-downloads-reconcile-20261106', 'OWNER_DOWNLOADS_53_APPLY_REPORT.json'),
    'utf8'
  )
)
const review = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-image-review-state.json'), 'utf8'))
const humanApproved = review.humanApproved && typeof review.humanApproved === 'object' ? review.humanApproved : {}

const applySlugs = report.rows.filter((r) => r.type === 'port').map((r) => r.slug)
const regenSlugs = applySlugs.filter((s) => s !== 'goa-india')
const fav = 'seadaysfav.png'

function absFromHuman(url) {
  const u = String(url || '').trim()
  if (!u.startsWith('/')) return u
  return `${BASE_URL}${u}`
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function checkPort(slug) {
  const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
  assert(fs.existsSync(htmlPath), `missing ${htmlPath}`)
  const html = fs.readFileSync(htmlPath, 'utf8')
  const human = humanApproved[slug]
  assert(human && human.url, `no humanApproved for ${slug}`)
  const expectedAbs = absFromHuman(human.url)
  const expectedRel = String(human.url).trim()

  const ogm = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
  const og = ogm ? ogm[1].trim() : ''
  assert(og === expectedAbs, `${slug} og:image expected ${expectedAbs}, got ${og}`)

  const twm = html.match(/<meta\s+property=["']twitter:image["']\s+content=["']([^"']+)["']/i)
  const tw = twm ? twm[1].trim() : ''
  assert(tw === expectedAbs, `${slug} twitter:image expected ${expectedAbs}, got ${tw}`)

  const heroMatches = [...html.matchAll(/class=["'][^"']*seo-hero-img[^"']*["'][^>]*\bsrc=["']([^"']+)["']/gi)]
  assert(heroMatches.length === 1, `${slug} expected exactly one seo-hero-img, got ${heroMatches.length}`)
  const heroSrc = heroMatches[0][1]
  assert(heroSrc === expectedRel, `${slug} hero src expected ${expectedRel}, got ${heroSrc}`)

  assert(!og.includes(fav), `${slug} og must not use favicon placeholder`)

  const jm = html.match(/<script\s+type=["']application\/ld\+json["']>([\s\S]*?"@type"\s*:\s*"TouristDestination"[\s\S]*?)<\/script>/i)
  assert(jm, `${slug} missing TouristDestination JSON-LD`)
  const j = JSON.parse(jm[1])
  assert(j.image === expectedAbs, `${slug} JSON-LD image expected ${expectedAbs}, got ${j.image}`)

  const assetPath = path.join(repoRoot, expectedRel.replace(/^\//, ''))
  assert(fs.existsSync(assetPath), `${slug} asset missing on disk: ${assetPath}`)
}

function main() {
  for (const slug of regenSlugs) checkPort(slug)

  const goa = fs.readFileSync(path.join(repoRoot, 'ports', 'goa-india', 'index.html'), 'utf8')
  assert(/http-equiv=["']refresh["']/i.test(goa) && /mormugao-port-goa-india/.test(goa), 'goa-india must remain redirect stub')

  console.log(`OK test-port-guide-human-approved-hero (${regenSlugs.length} ports + goa redirect)`)
}

main()

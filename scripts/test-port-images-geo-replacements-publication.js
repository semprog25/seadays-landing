#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const manifestPath = path.join(repoRoot, 'data', 'destination-photo-geo-replacements-v1-scoped-release-manifest.json')
const decisionsPath = path.join(repoRoot, 'data', 'destination-photo-geo-replacements-v1-owner-decisions.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const BASE_URL = 'https://seadays.app'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(fs.existsSync(manifestPath), 'missing geo scoped manifest')
  assert(fs.existsSync(decisionsPath), 'missing geo owner decisions')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const decisions = JSON.parse(fs.readFileSync(decisionsPath, 'utf8'))
  assert(decisions.status === 'OWNER_APPROVED_PUBLICATION_READY', 'decisions not ready')
  const slugs = manifest.portSlugs || []
  assert(slugs.length === 2, `expected 2 slugs, got ${slugs.length}`)
  assert(slugs.includes('aberdeen-united-kingdom'), 'missing aberdeen')
  assert(slugs.includes('le-havre-paris-france'), 'missing le havre')

  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
  const humanApproved = review.humanApproved || {}

  for (const slug of slugs) {
    const human = humanApproved[slug]
    assert(human && human.url, `${slug}: missing humanApproved`)
    assert(human.ownerVisuallyApproved === true, `${slug}: not owner approved`)
    assert(human.productionGeoVerified === true, `${slug}: geo not verified`)
    assert(human.supersededFrozenDecision, `${slug}: missing supersededFrozenDecision`)

    const assetPath = path.join(repoRoot, human.url.replace(/^\//, ''))
    assert(fs.existsSync(assetPath), `${slug}: asset missing`)

    const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
    const html = fs.readFileSync(htmlPath, 'utf8')
    const expectedRel = human.url
    const expectedAbs = `${BASE_URL}${expectedRel}`

    const hero = [...html.matchAll(/class=["'][^"']*seo-hero-img[^"']*["'][^>]*\bsrc=["']([^"']+)["']/gi)]
    assert(hero.length === 1 && hero[0][1] === expectedRel, `${slug}: hero mismatch`)

    const ogm = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    assert(ogm && ogm[1] === expectedAbs, `${slug}: og:image mismatch`)

    const tw = html.match(/<meta\s+property=["']twitter:image["']\s+content=["']([^"']+)["']/i)
    assert(tw && tw[1] === expectedAbs, `${slug}: twitter:image mismatch`)

    const ld = html.match(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/i)
    assert(ld && ld[1].includes(expectedAbs), `${slug}: JSON-LD image mismatch`)

    if (slug === 'aberdeen-united-kingdom') {
      assert(human.provider === 'wikimedia', 'aberdeen provider')
      assert(human.attributionRequired === true, 'aberdeen attributionRequired')
      assert(/Graeme Smith/i.test(html), 'aberdeen: Graeme Smith credit')
      assert(/commons\.wikimedia\.org/i.test(html), 'aberdeen: Commons link')
      assert(/creativecommons\.org\/licenses\/by-sa\/2\.0/i.test(html), 'aberdeen: CC BY-SA 2.0 link')
      assert(!html.includes('5684661'), 'aberdeen: old pexels B must not be hero')
    }

    if (slug === 'le-havre-paris-france') {
      assert(human.provider === 'pexels', 'le havre provider')
      assert(/Zarina Maizel|pexels\.com\/photo\/scenic-view-of-river-and-town-in-le-havre-france-31781110/i.test(html), 'le havre: Pexels attribution')
      assert(!html.includes('11691091'), 'le havre: old marina B must not be hero')
    }
  }

  const indexHtml = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8')
  for (const slug of slugs) {
    const human = humanApproved[slug]
    const base = path.basename(human.url)
    assert(indexHtml.includes(base), `${slug}: directory thumbnail missing`)
  }

  console.log('OK test-port-images-geo-replacements-publication')
}

main()

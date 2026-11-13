#!/usr/bin/env node
'use strict'

/**
 * Post-apply checks for Batch 05 publication prep (targeted slugs only).
 */

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const manifestPath = path.join(repoRoot, 'data', 'destination-photo-batch-05-scoped-release-manifest.json')
const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const BASE_URL = 'https://seadays.app'

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

function main() {
  assert(fs.existsSync(manifestPath), 'run apply script first — missing scoped manifest')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const slugs = manifest.portSlugs || []
  assert(slugs.length === 12, `expected 12 applied slugs, got ${slugs.length}`)

  const excluded = new Set(manifest.excludedFromPublication || [])
  assert(excluded.has('dubai-united-arab-emirates'), 'manifest must list Dubai exclusion')
  assert(excluded.has('aberdeen-united-kingdom'), 'manifest must list Aberdeen exclusion')

  const review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
  const humanApproved = review.humanApproved || {}

  assert(!humanApproved['dubai-united-arab-emirates']?.ownerVisuallyApproved, 'Dubai must not be published')
  assert(!humanApproved['aberdeen-united-kingdom']?.ownerVisuallyApproved, 'Aberdeen must not be published')

  for (const slug of slugs) {
    const human = humanApproved[slug]
    assert(human && human.url, `${slug}: missing humanApproved`)
    assert(human.ownerVisuallyApproved === true, `${slug}: not owner approved`)
    assert(human.sourcePageUrl, `${slug}: missing sourcePageUrl`)
    assert(human.licenseUrl, `${slug}: missing licenseUrl`)
    assert(human.productionGeoVerified === true, `${slug}: geo must be verified for publication`)

    const assetPath = path.join(repoRoot, human.url.replace(/^\//, ''))
    assert(fs.existsSync(assetPath), `${slug}: asset missing ${assetPath}`)

    const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
    assert(fs.existsSync(htmlPath), `${slug}: missing port page`)
    const html = fs.readFileSync(htmlPath, 'utf8')
    const expectedRel = human.url
    const expectedAbs = `${BASE_URL}${expectedRel}`

    const heroMatches = [...html.matchAll(/class=["'][^"']*seo-hero-img[^"']*["'][^>]*\bsrc=["']([^"']+)["']/gi)]
    assert(heroMatches.length === 1, `${slug}: expected one seo-hero-img`)
    assert(heroMatches[0][1] === expectedRel, `${slug}: hero src mismatch`)

    const ogm = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i)
    assert(ogm && ogm[1] === expectedAbs, `${slug}: og:image mismatch`)

    const catalog = JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'destination-image-catalog.json'), 'utf8'))
    const row = (catalog.records || []).find((r) => r.portSlug === slug)
    assert(row, `${slug}: missing catalog record`)
    const catalogUrl =
      row.displayUrl || row.directoryImageUrl || row.heroImageUrl || row.url || ''
    assert(
      catalogUrl === expectedRel || String(catalogUrl).includes(path.basename(expectedRel, '.webp')),
      `${slug}: catalog url does not reference applied asset (${catalogUrl})`
    )

    if (human.provider === 'wikimedia') {
      const credit = html.match(/Larry D\. Moore|Wikimedia|creativecommons\.org\/licenses\/by\/4\.0/i)
      assert(credit, `${slug}: required Wikimedia / CC BY 4.0 attribution in HTML`)
      assert(human.attributionRequired === true, `${slug}: humanApproved must flag attributionRequired`)
    } else if (human.provider === 'unsplash' || human.provider === 'pexels') {
      const credit = html.match(/Photo by|pexels\.com|unsplash\.com/i)
      assert(credit, `${slug}: expected visible attribution hint in HTML`)
    }
  }

  const indexHtml = fs.readFileSync(path.join(repoRoot, 'ports', 'index.html'), 'utf8')
  for (const slug of slugs) {
    const human = humanApproved[slug]
    if (!human?.url) continue
    const base = path.basename(human.url)
    assert(indexHtml.includes(base) || indexHtml.includes(human.url), `${slug}: ports index missing thumbnail ref`)
  }

  console.log(`OK test-port-images-batch05-publication (${slugs.length} ports)`)
}

main()

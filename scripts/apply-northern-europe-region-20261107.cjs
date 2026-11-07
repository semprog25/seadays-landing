#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const REGION = path.join(repoRoot, 'data', 'ports-directory-region-images-provided.json')
const CATALOG = path.join(repoRoot, 'data', 'destination-image-catalog.json')

const PEXELS_LICENSE =
  'Pexels License (free for commercial use; no attribution required — credit appreciated)'
const REGION_URL = '/assets/img/ports-directory/regions/northern-europe-owner-portpic-20261107.webp'
const PREV_URL = '/assets/img/ports-directory/regions/northern-europe-owner-northern-europe.webp'
const SOURCE_SHA = '75f3cd1f0aa1fbfefec98d4f35c90341a4e8f496b26a98ac06cc8abbc5c91cee'

const region = JSON.parse(fs.readFileSync(REGION, 'utf8'))
const ne = region.regions['Northern Europe']
const prevApply = ne.ownerDownloadsApply || {}

ne.imageUrl = REGION_URL
ne.alt = 'Northern Europe cruise region'
ne.source = 'owner-provided'
ne.verificationStatus = 'owner_approved_stock_20261107'
ne.localSourceFile = 'Northern Europe.jpg'
ne.attribution = {
  license: PEXELS_LICENSE,
  licenseUrl: 'https://www.pexels.com/license/',
  photographer: 'Frank Wesneck',
  sourcePlatform: 'pexels',
  sourcePageUrl: 'https://www.pexels.com/photo/34514019/',
  providerImageId: 34514019,
  productionLicenseVerified: true,
}
ne.portpicApply = {
  sourceBasename: 'Northern Europe.jpg',
  sourceSha256: SOURCE_SHA,
  dimensions: prevApply.dimensions || { width: 4538, height: 2862 },
  supersededUrl: PREV_URL,
  provenanceStatus: 'STOCK_IDENTITY_VERIFIED_2026-11-07',
  stockIdentityVerifiedAt: '2026-11-07',
  approvedBy: 'owner-explicit-20261107',
  imageSlot: 'region:Northern Europe',
}

fs.writeFileSync(REGION, `${JSON.stringify(region, null, 2)}\n`)

const catalog = JSON.parse(fs.readFileSync(CATALOG, 'utf8'))
const ownerRec = catalog.records.find(
  (r) =>
    r.role === 'region-thumbnail' &&
    r.region === 'Northern Europe' &&
    r.displayUrl === PREV_URL
)
if (!ownerRec) throw new Error('Northern Europe owner catalog record not found')

ownerRec.provider = 'pexels'
ownerRec.imageId = '34514019'
ownerRec.sourcePageUrl = 'https://www.pexels.com/photo/34514019/'
ownerRec.photographer = 'Frank Wesneck'
ownerRec.licenseTerms = PEXELS_LICENSE
ownerRec.geographicEvidence = 'Northern Europe region browse (owner-approved Pexels 34514019)'
ownerRec.attribution = 'Stock verified 2026-11-07 — Frank Wesneck (Pexels)'
ownerRec.displayUrl = REGION_URL
ownerRec.verificationStatus = 'VERIFIED'
ownerRec.notes = 'Owner-approved region browse; licence verified 2026-11-07'

catalog.generatedAt = new Date().toISOString()
fs.writeFileSync(CATALOG, `${JSON.stringify(catalog, null, 2)}\n`)

console.log('[northern-europe] updated region manifest and catalog record')

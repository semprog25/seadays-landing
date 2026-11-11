#!/usr/bin/env node
/**
 * Apply OWNER_DOWNLOADS_APPLICATION_PLAN_53_FINAL.json: verify SHA256, write WebP+JPEG,
 * update data/ports-directory-image-review-state.json (ports) and
 * data/ports-directory-region-images-provided.json (regions). Rebuild destination-image-catalog.
 *
 * Does not modify Downloads. Does not touch Hamburg (not in plan). Does not edit batch ledgers.
 *
 *   node scripts/apply-owner-downloads-53-final.cjs --dry-run
 *   node scripts/apply-owner-downloads-53-final.cjs --apply
 */
'use strict'

const crypto = require('crypto')
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')

const {
  writeWebDerivatives,
  parsePexelsBasename,
  readDimensions,
} = require('./lib/ownerImageImportCore.cjs')

const repoRoot = path.join(__dirname, '..')
const defaultDownloads =
  '/Users/sharanestone/Downloads/Images for Regions in ports'
const downloadsDir = path.resolve(process.env.OWNER_DOWNLOADS_DIR || defaultDownloads)

const PLAN_REL = path.join(
  'qa-evidence',
  'owner-downloads-reconcile-20261106',
  'OWNER_DOWNLOADS_APPLICATION_PLAN_53_FINAL.json'
)
const FROZEN_LEDGER = path.join(
  repoRoot,
  'qa-evidence',
  'owner-downloads-reconcile-20261106',
  'OWNER_FROZEN_LOCAL_OVERRIDE_8_DECISIONS.json'
)

const REVIEW_STATE_PATH = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const REGION_PROVIDED_PATH = path.join(repoRoot, 'data', 'ports-directory-region-images-provided.json')

const OWNER_EXCLUDED = new Set([
  'Hamburg2.jpg',
  'd.jpg',
  'pexels-jan-tang-598592438-25014337.jpg',
  'pexels-pixabay-161815.jpg',
])

/** Same keys as scripts/ingest-owner-downloaded-images.cjs REGION_ASSET_SLUG */
const REGION_ASSET_SLUG = {
  Mediterranean: 'mediterranean',
  Caribbean: 'caribbean',
  'Northern Europe': 'northern-europe',
  Baltic: 'baltic',
  Fjords: 'fjords',
  'British Isles': 'british-isles',
  Alaska: 'alaska',
  Asia: 'asia',
  __virt_anz__: 'australia-new-zealand',
  __virt_na__: 'north-america',
  Atlantic: 'atlantic',
  'South America': 'south-america',
  'Middle East': 'middle-east',
  'Private Island': 'private-island',
}

function sha256File(abs) {
  return crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex')
}

function regionDestStem(assetSlug, basename) {
  const { photoId } = parsePexelsBasename(basename)
  if (photoId) return `${assetSlug}-pexels-${photoId}`
  const safe = basename
    .replace(/\.jpe?g$/i, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48)
  return `${assetSlug}-owner-${safe || 'download'}`
}

function resolveSourceAbs(entry) {
  const fromPlan = String(entry.absoluteSourcePath || '').trim()
  if (fromPlan && fs.existsSync(fromPlan)) return path.resolve(fromPlan)
  const rel = String(entry.relativePath || entry.sourceBasename || '').trim()
  const join = path.join(downloadsDir, rel)
  if (fs.existsSync(join)) return join
  return ''
}

function main() {
  const isApply = process.argv.includes('--apply')
  const isDry = process.argv.includes('--dry-run') || !isApply

  const planPath = path.join(repoRoot, PLAN_REL)
  if (!fs.existsSync(planPath)) {
    console.error('[apply-53] missing plan:', planPath)
    process.exit(1)
  }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8'))
  if (plan.status !== 'FINAL_APPLICATION_PLAN_READY') {
    console.error('[apply-53] plan status not ready:', plan.status)
    process.exit(1)
  }
  const entries = Array.isArray(plan.entries) ? plan.entries : []
  if (entries.length !== 53) {
    console.error('[apply-53] expected 53 entries, got', entries.length)
    process.exit(1)
  }

  let frozenLedger = null
  if (fs.existsSync(FROZEN_LEDGER)) {
    frozenLedger = JSON.parse(fs.readFileSync(FROZEN_LEDGER, 'utf8'))
  }

  const reportRows = []
  const slotSeen = new Set()

  for (const e of entries) {
    const slot = e.imageSlot
    if (slotSeen.has(slot)) {
      console.error('[apply-53] duplicate slot', slot)
      process.exit(1)
    }
    slotSeen.add(slot)

    const basename = String(e.sourceBasename || '').trim()
    if (OWNER_EXCLUDED.has(basename)) {
      console.error('[apply-53] excluded file in plan (must not apply):', basename)
      process.exit(1)
    }

    const expectedSha = String(e.sha256Manifest || e.proposedLocalImage?.sha256 || '').trim()
    const srcAbs = resolveSourceAbs(e)
    if (!srcAbs) {
      console.error('[apply-53] missing source for', basename)
      process.exit(1)
    }
    const onDisk = sha256File(srcAbs)
    if (onDisk !== expectedSha) {
      console.error('[apply-53] SHA256 mismatch', basename, '\n  expected', expectedSha, '\n  got     ', onDisk)
      process.exit(1)
    }

    const destType = e.destinationType
    if (destType === 'port') {
      const slug = String(e.canonicalPortSlug || '').trim()
      if (!slug) {
        console.error('[apply-53] missing port slug', basename)
        process.exit(1)
      }
      if (slug === 'hamburg-germany') {
        console.error('[apply-53] Hamburg must not be in apply plan')
        process.exit(1)
      }
      if (e.replacementImpact === 'FROZEN_BATCH_SUPERSEDED_BY_OWNER_OVERRIDE') {
        const row = (frozenLedger?.decisions || []).find((d) => d.portSlug === slug)
        if (!row || !row.sha256Verified) {
          console.error('[apply-53] frozen override ledger missing or unverified for', slug)
          process.exit(1)
        }
        if (row.localSha256OnDisk !== onDisk) {
          console.error('[apply-53] frozen ledger sha mismatch', slug)
          process.exit(1)
        }
      }
    }
  }

  const reviewState = fs.existsSync(REVIEW_STATE_PATH)
    ? JSON.parse(fs.readFileSync(REVIEW_STATE_PATH, 'utf8'))
    : { version: 1, humanApproved: {} }
  if (!reviewState.humanApproved || typeof reviewState.humanApproved !== 'object') {
    reviewState.humanApproved = {}
  }

  const regionPayload = fs.existsSync(REGION_PROVIDED_PATH)
    ? JSON.parse(fs.readFileSync(REGION_PROVIDED_PATH, 'utf8'))
    : { version: 1, regions: {} }
  if (!regionPayload.regions || typeof regionPayload.regions !== 'object') {
    regionPayload.regions = {}
  }

  for (const e of entries) {
    const basename = String(e.sourceBasename || '').trim()
    const srcAbs = resolveSourceAbs(e)
    const expectedSha = String(e.sha256Manifest || '').trim()
    const onDisk = sha256File(srcAbs)
    const dims = readDimensions(srcAbs)
    const previousRef = { kind: '', value: '' }

    if (e.destinationType === 'port') {
      const slug = String(e.canonicalPortSlug || '').trim()
      const prev = reviewState.humanApproved[slug]
      previousRef.kind = 'humanApproved.url'
      previousRef.value = prev && prev.url ? String(prev.url) : ''

      const stem = `destination-owner-downloads-53-${slug}`
      const destBase = path.join(repoRoot, 'assets/img/ports-directory/ports', slug, stem)
      const webpRel = `/assets/img/ports-directory/ports/${slug}/${stem}.webp`

      if (!isDry) {
        writeWebDerivatives(srcAbs, destBase, 1280)
        const geo =
          (prev && String(prev.depictedDestination || '').trim()) ||
          `${slug.replace(/-/g, ' ')} (owner download — confirm geography)`
        reviewState.humanApproved[slug] = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          url: webpRel,
          provider: 'owner',
          depictedDestination: geo,
          approvedAt: '2026-11-06',
          approvedBy: 'owner-downloads-53-final-local-apply',
          ownerDownloadsApply: {
            sourceBasename: basename,
            sourceSha256: onDisk,
            planSha256: expectedSha,
            dimensions: dims,
            imageSlot: e.imageSlot,
            replacementImpact: e.replacementImpact,
          },
        }
      }

      reportRows.push({
        slot: e.imageSlot,
        slug,
        type: 'port',
        sourceBasename: basename,
        sha256: onDisk,
        previousUrl: previousRef.value,
        newAssetWebp: isDry ? `(dry-run) ${stem}.webp` : webpRel,
        optimization: 'sips -Z 1280; cwebp -q 82',
        verification: onDisk === expectedSha ? 'HASH_OK' : 'HASH_FAIL',
      })
    } else if (e.destinationType === 'region') {
      const regionKey = String(e.regionKey || '').trim()
      const assetSlug = REGION_ASSET_SLUG[regionKey]
      if (!assetSlug) {
        console.error('[apply-53] unknown regionKey', regionKey)
        process.exit(1)
      }
      const stem = regionDestStem(assetSlug, basename)
      const webpRel = `/assets/img/ports-directory/regions/${stem}.webp`
      const destBase = path.join(repoRoot, 'assets/img/ports-directory/regions', stem)

      const prevRegion = regionPayload.regions[regionKey]
      previousRef.kind = 'regions.imageUrl'
      previousRef.value = prevRegion && prevRegion.imageUrl ? String(prevRegion.imageUrl) : ''

      if (!isDry) {
        writeWebDerivatives(srcAbs, destBase, 1280)
        const baseAlt = `${regionKey} cruise region`
        regionPayload.regions[regionKey] = {
          ...(prevRegion && typeof prevRegion === 'object' ? prevRegion : {}),
          imageUrl: webpRel,
          alt: String(prevRegion?.alt || baseAlt).trim() || baseAlt,
          source: 'owner-provided',
          verificationStatus: 'NEEDS_REVIEW',
          localSourceFile: basename,
          attribution: {
            license: 'Owner declared Pexels — confirm photo ID and licence',
            licenseUrl: 'https://www.pexels.com/license/',
          },
          ownerDownloadsApply: {
            sourceSha256: onDisk,
            planSha256: expectedSha,
            dimensions: dims,
            imageSlot: e.imageSlot,
          },
        }
      }

      reportRows.push({
        slot: e.imageSlot,
        regionKey,
        type: 'region',
        sourceBasename: basename,
        sha256: onDisk,
        previousUrl: previousRef.value,
        newAssetWebp: isDry ? `(dry-run) ${stem}.webp` : webpRel,
        optimization: 'sips -Z 1280; cwebp -q 82',
        verification: onDisk === expectedSha ? 'HASH_OK' : 'HASH_FAIL',
      })
    } else {
      console.error('[apply-53] unknown destinationType', e.destinationType)
      process.exit(1)
    }
  }

  if (!isDry) {
    fs.writeFileSync(REVIEW_STATE_PATH, JSON.stringify(reviewState, null, 2) + '\n')
    fs.writeFileSync(REGION_PROVIDED_PATH, JSON.stringify(regionPayload, null, 2) + '\n')
    try {
      execFileSync(process.execPath, [path.join(repoRoot, 'scripts', 'build-destination-image-catalog.js')], {
        cwd: repoRoot,
        stdio: 'inherit',
      })
    } catch (err) {
      console.error('[apply-53] build-destination-image-catalog failed', err?.message || err)
      process.exit(1)
    }
  }

  const outReport = path.join(
    repoRoot,
    'qa-evidence',
    'owner-downloads-reconcile-20261106',
    'OWNER_DOWNLOADS_53_APPLY_REPORT.json'
  )
  fs.writeFileSync(
    outReport,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: isDry ? 'dry-run' : 'apply',
        plan: PLAN_REL,
        downloadsDir,
        entryCount: reportRows.length,
        rows: reportRows,
      },
      null,
      2
    ) + '\n'
  )

  console.log(
    `[apply-53] ${isDry ? 'DRY-RUN' : 'APPLIED'} entries=${reportRows.length} report=${path.relative(repoRoot, outReport)}`
  )
}

main()

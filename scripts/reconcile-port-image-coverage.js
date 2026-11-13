#!/usr/bin/env node
'use strict'

/**
 * Read-only classification of port directory image coverage vs frozen batch ledgers.
 *   node scripts/reconcile-port-image-coverage.js
 */

const fs = require('fs')
const path = require('path')

const repoRoot = path.join(__dirname, '..')
const outPath = path.join(
  repoRoot,
  'qa-evidence',
  'port-images-batch03-04-20261113',
  'PORT_IMAGE_COVERAGE_RECONCILIATION.json'
)

const stagingRoot = process.env.SEADAYS_PORT_IMAGE_STAGING_ROOT || path.join(
  repoRoot,
  '..',
  'ports-directory-thumbnails-20261104'
)

const reviewPath = path.join(repoRoot, 'data', 'ports-directory-image-review-state.json')
const catalogPath = path.join(repoRoot, 'data', 'destination-image-catalog.json')
const publicGuidesPath = path.join(repoRoot, 'data', 'public-port-guides.json')

const ledgerPaths = [
  ['batch02', path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json')],
  ['batch03', path.join(stagingRoot, 'data', 'destination-photo-batch-03-owner-review-v1-decisions.json')],
  ['batch04', path.join(stagingRoot, 'data', 'destination-photo-batch-04-owner-review-v1-decisions.json')],
  ['batch05', path.join(stagingRoot, 'data', 'destination-photo-batch-05-owner-review-v1-decisions.json')],
]

function loadJson(p) {
  if (!fs.existsSync(p)) return null
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function portCatalogueSize() {
  const catalog = loadJson(catalogPath)
  if (catalog?.portCatalogueSize) return catalog.portCatalogueSize
  const guides = loadJson(publicGuidesPath)
  if (!guides?.ports) return null
  return Object.keys(guides.ports).length
}

function classifySlug(slug, humanApproved, catalogRecords) {
  const ha = humanApproved[slug]
  const rec = catalogRecords[slug]
  if (!ha && !rec) return 'missing_suitable_image'
  if (ha?.ownerVisuallyApproved) {
    const liveHero = fs.existsSync(path.join(repoRoot, 'ports', slug, 'index.html'))
    if (liveHero && ha.url) {
      const rel = ha.url.replace(/^\//, '')
      if (fs.existsSync(path.join(repoRoot, rel))) {
        const html = fs.readFileSync(path.join(repoRoot, 'ports', slug, 'index.html'), 'utf8')
        if (html.includes(ha.url) || html.includes(rel.split('/').pop())) {
          return 'approved_and_live'
        }
      }
    }
    return 'approved_but_unpublished'
  }
  if (ha && !ha.ownerVisuallyApproved) return 'candidate_awaiting_owner_approval'
  if (rec?.verificationStatus === 'REJECTED') return 'reviewed_but_rejected'
  return 'licensing_or_identity_unverified'
}

function frozenApprovals(ledger, key) {
  if (!ledger) return []
  if (ledger.selections) return ledger.selections.map((s) => s.portSlug)
  return (ledger.decisions || [])
    .filter((d) => d.decision === 'APPROVE_A' || d.decision === 'APPROVE_B')
    .map((d) => d.portSlug)
}

function main() {
  const review = loadJson(reviewPath) || { humanApproved: {} }
  const humanApproved = review.humanApproved || {}
  const catalog = loadJson(catalogPath) || { records: [] }
  const recordsBySlug = {}
  for (const r of catalog.records || []) {
    if (r.portSlug) recordsBySlug[r.portSlug] = r
  }

  const allSlugs = new Set(Object.keys(recordsBySlug))
  for (const slug of Object.keys(humanApproved)) allSlugs.add(slug)
  for (const [, p] of ledgerPaths) {
    const ledger = loadJson(p)
    for (const s of frozenApprovals(ledger)) allSlugs.add(s)
  }

  const byClass = {
    approved_and_live: [],
    approved_but_unpublished: [],
    reviewed_but_rejected: [],
    candidate_awaiting_owner_approval: [],
    missing_suitable_image: [],
    licensing_or_identity_unverified: [],
  }

  for (const slug of [...allSlugs].sort()) {
    const c = classifySlug(slug, humanApproved, recordsBySlug)
    byClass[c].push(slug)
  }

  const frozenUnpublished = []
  for (const [batch, p] of ledgerPaths) {
    const ledger = loadJson(p)
    for (const slug of frozenApprovals(ledger)) {
      if (!humanApproved[slug]?.ownerVisuallyApproved) {
        frozenUnpublished.push({ batch, portSlug: slug })
      }
    }
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    totalPortCatalogue: portCatalogueSize(),
    humanApprovedCount: Object.keys(humanApproved).filter((s) => humanApproved[s]?.ownerVisuallyApproved)
      .length,
    counts: Object.fromEntries(Object.entries(byClass).map(([k, v]) => [k, v.length])),
    slugsByClass: byClass,
    frozenApprovedNotYetHumanApproved: frozenUnpublished,
    batchLedgerSources: ledgerPaths.map(([b, p]) => ({ batch: b, path: p, exists: fs.existsSync(p) })),
  }

  saveJson(outPath, payload)
  console.log(`[reconcile-port-images] wrote ${path.relative(repoRoot, outPath)}`)
  console.log(JSON.stringify(payload.counts))
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`, 'utf8')
}

main()

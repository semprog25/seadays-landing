#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { allPorts } = require('./lib/appCruiseDataset')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { buildSlugToAppPortIdMap, loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { buildPortSlugToReviewKeyMap, getAppRepoRoot } = require('./lib/reviewAggregateMerge')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage76-remaining-56')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')

function main() {
  const inventory = JSON.parse(fs.readFileSync(INV, 'utf8'))
  const categoryD = inventory.filter((r) => r.category === 'D').map((r) => r.landing_slug).sort()

  const patchPath = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const bySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))
    const appRoot = getAppRepoRoot()
    const guides = loadPublicPortGuidesFile(REPO)
    const reviewMap = buildPortSlugToReviewKeyMap(appRoot, allPorts)
    const slugToApp = buildSlugToAppPortIdMap(allPorts, reviewMap, guides.byAppPortId || {})
    const appSlugSet = new Set(allPorts.map((p) => p.slug))

    const rows = []
    for (const landingSlug of categoryD) {
      const inv = inventory.find((r) => r.landing_slug === landingSlug)
      const row = bySlug.get(landingSlug)
      const seoInAppDataset = appSlugSet.has(landingSlug)
      const inferredAppId = slugToApp[landingSlug] || row?.app_port_id || ''
      const identifierStatus = row?.identifier_status || 'unknown'
      const collision = (manifest.collisions?.multi_slug_app_port_ids || []).find((c) =>
        (c.landing_slugs || []).includes(landingSlug)
      )

      let disposition = 'REMAINS_BLOCKED'
      let proposed_mapping = null
      let owner_decision = null

      if (collision) {
        disposition = 'GENUINE_COLLISION'
        owner_decision = 'Owner must pick canonical landing_slug for shared app slot or exclude'
      } else if (inferredAppId && identifierStatus === 'resolved') {
        disposition = 'VERIFIED_ONE_TO_ONE'
        proposed_mapping = {
          landing_slug: landingSlug,
          app_port_id: inferredAppId,
          evidence: 'identifier manifest resolved',
          safe_to_apply: false,
          note: 'Landing mapping JSON only — no app DB mutation in Stage 76',
        }
      } else if (seoInAppDataset && !inferredAppId) {
        disposition = 'APP_RECORD_PRESENT_NO_GUIDE_SLOT'
        owner_decision = 'Confirm guide id wiring in public-port-guides before publication'
      } else if (!seoInAppDataset && !inferredAppId) {
        disposition = 'GENUINELY_MISSING_APP_RECORD'
        owner_decision = 'Requires new app cruise-data port entry before passenger publication'
      } else if (inferredAppId && identifierStatus !== 'resolved') {
        disposition = 'INFERRED_NOT_OWNER_VERIFIED'
        proposed_mapping = {
          landing_slug: landingSlug,
          app_port_id: inferredAppId,
          evidence: row?.resolution_method || 'inferred',
          safe_to_apply: false,
        }
        owner_decision = 'Owner confirm inferred app_port_id before identifier gate clears'
      }

      rows.push({
        landing_slug: landingSlug,
        inventory_blocker: inv?.blocker,
        identifier_status: identifierStatus,
        seo_slug_in_app_dataset: seoInAppDataset,
        manifest_app_port_id: row?.app_port_id || null,
        slug_to_app_map: inferredAppId || null,
        disposition,
        proposed_mapping,
        owner_decision,
        collision_peers: collision?.landing_slugs || null,
      })
    }

    const summary = {
      category_d_count: categoryD.length,
      verified_one_to_one: rows.filter((r) => r.disposition === 'VERIFIED_ONE_TO_ONE').length,
      genuine_collision: rows.filter((r) => r.disposition === 'GENUINE_COLLISION').length,
      genuinely_missing_app_record: rows.filter((r) => r.disposition === 'GENUINELY_MISSING_APP_RECORD').length,
      inferred_not_owner_verified: rows.filter((r) => r.disposition === 'INFERRED_NOT_OWNER_VERIFIED').length,
      remains_blocked: rows.filter((r) => r.disposition === 'REMAINS_BLOCKED').length,
    }

    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(
      path.join(OUT, 'IDENTITY_DISPOSITION.json'),
      `${JSON.stringify({ generated_at_utc: new Date().toISOString(), summary, rows }, null, 2)}\n`,
      'utf8'
    )
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    cleanup()
  }
}

main()

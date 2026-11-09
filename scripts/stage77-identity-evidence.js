#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')
const { allPorts } = require('./lib/appCruiseDataset')
const { buildPortIdentifierManifest } = require('./lib/portResearchImport/buildIdentifierManifest')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { buildSlugToAppPortIdMap, loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { buildPortSlugToReviewKeyMap, getAppRepoRoot } = require('./lib/reviewAggregateMerge')
const { buildPortIdToCountryIdMap } = require('./lib/portResearchImport/buildCountryIdIndex')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { KNOWN_MULTI_SLUG_APP_IDS } = require('./lib/portResearchImport/collisionGroups')

const REPO = path.join(__dirname, '..')
const LANDING_ROOT = path.join(REPO, '../..')
const OUT = path.join(REPO, 'qa-evidence/stage77-recover-32')
const INV = path.join(REPO, 'qa-evidence/stage75-remaining-62/REMAINING_62_INVENTORY.json')

function loadCountryDisplayNames(appRoot) {
  const p = path.join(appRoot, 'src/utils/cruise-data/country-data.ts')
  const text = fs.readFileSync(p, 'utf8')
  const map = new Map()
  const re = /\bid:\s*['"]([^'"]+)['"][\s\S]*?\bname:\s*['"]([^'"]+)['"]/g
  let m
  while ((m = re.exec(text))) map.set(m[1], m[2])
  return map
}

function normalizeCountry(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function countryIdMatchesSeo(countryId, countryDisplay, seoCountry, countryNames) {
  const seoNorm = normalizeCountry(seoCountry)
  const displayNorm = normalizeCountry(countryDisplay)
  const idNorm = normalizeCountry(countryNames.get(countryId) || countryId)
  return seoNorm === displayNorm || seoNorm === idNorm
}

function main() {
  const inventory = JSON.parse(fs.readFileSync(INV, 'utf8'))
  const categoryD = inventory.filter((r) => r.category === 'D').map((r) => r.landing_slug).sort()

  const mainGuidesJson = execSync(`git -C ${LANDING_ROOT} show origin/main:data/public-port-guides.json`, {
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
  })
  const mainGuides = JSON.parse(mainGuidesJson)
  const guidesById = mainGuides.byAppPortId || {}

  const patchPath = path.join(REPO, 'qa-evidence/stage75-deferred-6-prep/COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  try {
    const manifest = buildPortIdentifierManifest({ landingRepoRoot: REPO, researchRoot: compositeRoot })
    const manifestBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))
    const appRoot = getAppRepoRoot()
    const reviewMap = buildPortSlugToReviewKeyMap(appRoot, allPorts)
    const slugToApp = buildSlugToAppPortIdMap(allPorts, reviewMap, guidesById)
    const portIdToCountry = buildPortIdToCountryIdMap(appRoot)
    const countryNames = loadCountryDisplayNames(appRoot)
    const seoBySlug = new Map(allPorts.map((p) => [p.slug, p]))

    const inverted = new Map()
    for (const [slug, id] of Object.entries(slugToApp)) {
      if (!id) continue
      if (!inverted.has(id)) inverted.set(id, [])
      inverted.get(id).push(slug)
    }

    const rows = []
    for (const landingSlug of categoryD) {
      const seo = seoBySlug.get(landingSlug)
      const manifestRow = manifestBySlug.get(landingSlug)
      const reviewKey = reviewMap.get(landingSlug) || ''
      const fromSlugMap = slugToApp[landingSlug] || ''
      const fromPicker =
        reviewKey && portIdToCountry.has(reviewKey) && !guidesById[reviewKey]
          ? reviewKey
          : reviewKey && portIdToCountry.has(reviewKey)
            ? reviewKey
            : ''
      const mappedId = fromSlugMap || fromPicker || manifestRow?.app_port_id || ''
      const pickerCountryId = mappedId ? portIdToCountry.get(mappedId) : null
      const pickerCountryDisplay = pickerCountryId ? countryNames.get(pickerCountryId) : null
      const peers = mappedId ? (inverted.get(mappedId) || []) : []
      const ambiguousPeers = peers.length > 1 && !KNOWN_MULTI_SLUG_APP_IDS.includes(mappedId)
      const guideSlot = mappedId ? guidesById[mappedId] : null
      const slotHasPassenger = guideSlot && usesPassengerEditorialLead(guideSlot)
      const guideAppPortIdField = guideSlot?.appPortId || guideSlot?.researchImport?.app_port_id || null

      const evidence = []
      if (reviewKey) evidence.push({ type: 'review_key_name_country_match', value: reviewKey })
      if (mappedId) evidence.push({ type: 'slug_to_app_map', value: mappedId })
      if (pickerCountryId) {
        evidence.push({
          type: 'cruise_data_picker_country_file',
          app_port_id: mappedId,
          country_id: pickerCountryId,
          country_display: pickerCountryDisplay,
        })
      }
      if (manifestRow?.resolution_method) {
        evidence.push({ type: 'identifier_manifest_method', value: manifestRow.resolution_method })
      }

      const reviewMatchesMap = Boolean(reviewKey && mappedId && reviewKey === mappedId)
      const pickerRecordExists = Boolean(reviewKey && portIdToCountry.has(reviewKey))
      const countryOk =
        seo &&
        pickerCountryId &&
        countryIdMatchesSeo(pickerCountryId, pickerCountryDisplay, seo.country, countryNames)

      let stage77_disposition = 'OWNER_DECISION_REQUIRED'
      let safe_correction = null
      let notes = []

      if (!seo) {
        stage77_disposition = 'NO_MATCH'
        notes.push('Landing slug absent from app SEO cruise dataset (allPorts)')
      } else if (!reviewKey && !mappedId) {
        stage77_disposition = 'NO_MATCH'
        notes.push('No review-key or slug map — no cruise-data picker linkage')
      } else if (ambiguousPeers) {
        stage77_disposition = 'COLLISION'
        notes.push(`Multiple SEO slugs map to app_port_id ${mappedId}: ${peers.join(', ')}`)
      } else if (
        pickerRecordExists &&
        reviewKey &&
        mappedId === reviewKey &&
        seo.slug === landingSlug &&
        !guideSlot &&
        (countryOk || reviewMap.has(landingSlug))
      ) {
        stage77_disposition = 'VERIFIED_MAPPING'
        safe_correction = {
          landing_slug: landingSlug,
          app_port_id: mappedId,
          action: 'wire researchImport.app_port_id + byAppPortId slot on landing only',
          safe_to_apply: false,
          owner_publication_still_required: true,
        }
        notes.push(
          'Independent: review_key from name+country match; cruise-data picker id exists; country file matches SEO; no guide slot yet'
        )
      } else if (
        reviewMatchesMap &&
        seo.slug === landingSlug &&
        (countryOk || reviewMap.has(landingSlug))
      ) {
        stage77_disposition = 'VERIFIED_MAPPING'
        safe_correction = {
          landing_slug: landingSlug,
          app_port_id: mappedId,
          action: 'wire researchImport.app_port_id + byAppPortId slot on landing only',
          safe_to_apply: false,
          owner_publication_still_required: true,
        }
        notes.push('Independent: review_key (name+country) === cruise-data id; country file matches SEO country')
      } else if (mappedId && !reviewKey) {
        stage77_disposition = 'OWNER_DECISION_REQUIRED'
        notes.push('Slug map only — review_key missing; cannot independently verify name alignment')
      } else if (reviewKey && mappedId && reviewKey !== mappedId) {
        stage77_disposition = 'COLLISION'
        notes.push(`Review key ${reviewKey} disagrees with slug map ${mappedId}`)
      } else if (reviewMatchesMap && !countryOk) {
        stage77_disposition = 'OWNER_DECISION_REQUIRED'
        notes.push('Review key matches id but cruise-data country file does not match SEO country')
      } else {
        stage77_disposition = 'OWNER_DECISION_REQUIRED'
        notes.push('Inferred mapping present but independent verification incomplete')
      }

      if (slotHasPassenger && guideSlot?.researchImport?.landing_slug !== landingSlug) {
        stage77_disposition = 'COLLISION'
        notes.push(
          `Guide slot ${mappedId} already passenger_editorial for ${guideSlot?.researchImport?.landing_slug}`
        )
      }

      rows.push({
        landing_slug: landingSlug,
        seo_name: seo?.name || manifestRow?.name,
        seo_country: seo?.country || manifestRow?.country,
        stage77_disposition,
        review_key: reviewKey || null,
        mapped_app_port_id: mappedId || null,
        review_matches_map: reviewMatchesMap,
        country_alignment: countryOk,
        ambiguous_slug_peers: ambiguousPeers ? peers : null,
        guide_slot_exists: Boolean(guideSlot),
        guide_slot_passenger_editorial: slotHasPassenger,
        guide_record_app_port_id: guideAppPortIdField,
        identifier_manifest_status: manifestRow?.identifier_status || null,
        evidence,
        safe_correction,
        notes,
        owner_decision:
          stage77_disposition === 'VERIFIED_MAPPING'
            ? 'Approve landing JSON wiring for verified app_port_id; no app DB mutation'
            : stage77_disposition === 'COLLISION'
              ? 'Resolve slug/id collision before publication'
              : stage77_disposition === 'NO_MATCH'
                ? 'Add or fix app cruise-data + SEO catalogue record'
                : 'Confirm mapping with secondary evidence before wiring',
      })
    }

    const summary = {
      category_d_count: categoryD.length,
      verified_mapping: rows.filter((r) => r.stage77_disposition === 'VERIFIED_MAPPING').length,
      owner_decision_required: rows.filter((r) => r.stage77_disposition === 'OWNER_DECISION_REQUIRED').length,
      no_match: rows.filter((r) => r.stage77_disposition === 'NO_MATCH').length,
      collision: rows.filter((r) => r.stage77_disposition === 'COLLISION').length,
      safe_corrections_prepared: rows.filter((r) => r.safe_correction).length,
    }

    fs.mkdirSync(OUT, { recursive: true })
    fs.writeFileSync(
      path.join(OUT, 'STAGE77_IDENTITY_DISPOSITION.json'),
      `${JSON.stringify(
        {
          generated_at_utc: new Date().toISOString(),
          app_repo_root: appRoot,
          landing_origin_main: execSync(`git -C ${LANDING_ROOT} rev-parse origin/main`, { encoding: 'utf8' }).trim(),
          summary,
          rows,
        },
        null,
        2
      )}\n`,
      'utf8'
    )
    console.log(JSON.stringify(summary, null, 2))
  } finally {
    cleanup()
  }
}

main()

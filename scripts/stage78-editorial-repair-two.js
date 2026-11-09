#!/usr/bin/env node
'use strict'

/**
 * Passenger editorial repair for long-beach + ponce (insufficient attractions / research leaks).
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections')
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize')
const { scanDraftFields, classifyOwnerBucket } = require('./lib/bulkPortPublication/stage23FieldReview')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage78-five-port-prep')

const PATCHES = {
  'long-beach-ca-united-states': {
    portInfo: {
      description:
        'Carnival operates the Long Beach Cruise Terminal at 231 Windsor Way beside the Queen Mary — a separate embarkation point from Port of Los Angeles San Pedro. Confirm US LGB vs US LAX on cruise documents and rideshare apps before you travel.',
    },
    gettingThere: {
      fromTerminal: 'Long Beach Cruise Terminal — 231 Windsor Way, Long Beach, CA 90802',
      distanceToCity:
        'Airports. Visit Long Beach publishes driving guidance from LAX and Long Beach Airport (LGB) on its cruise terminal pages — check those pages before sailing. Downtown. Pine Avenue and Shoreline Village are typically a short taxi or rideshare from Windsor Way; allow buffer on turnaround mornings.',
      distanceAnswer:
        'Airports. Visit Long Beach publishes driving guidance from LAX and Long Beach Airport (LGB) on its cruise terminal pages — check those pages before sailing. Downtown. Pine Avenue and Shoreline Village are typically a short taxi or rideshare from Windsor Way; allow buffer on turnaround mornings.',
      publicTransport:
        'Airports. Visit Long Beach publishes driving guidance from LAX and Long Beach Airport (LGB) on its cruise terminal pages — check those pages before sailing. Downtown. Pine Avenue and Shoreline Village are typically a short taxi or rideshare from Windsor Way; allow buffer on turnaround mornings.',
    },
    thingsToDo: {
      topThings: [
        'Aquarium of the Pacific — Shoreline Drive — ~150 min.',
        'Shoreline Village / Rainbow Harbor — walk or short rideshare — ~90 min.',
        'Queen Mary historic ship — adjacent to terminal — ~120 min.',
        'Pine Avenue dining district — short transfer — ~90 min.',
        'Downtown Long Beach waterfront — flexible short call.',
      ],
      shortCall:
        '≥4 h. Aquarium or Shoreline Village loop with ≥75 min buffer — terminal parking garage height limits apply (check Carnival/Visit Long Beach pages).',
    },
  },
  'ponce-puerto-rico': {
    portInfo: {
      description:
        'Autoridad del Puerto de Ponce documents cruise operations at piers 4, 5, and 6 on the south coast, with anchorage-and-tender assignments on some sailings. Confirm alongside vs tender on your daily programme before planning ashore time.',
    },
    gettingThere: {
      distanceToCity:
        'Historic centre. Allow a taxi or organised shore excursion from the municipal piers — confirm pier assignment and whether your ship is alongside or tendered before you leave the terminal area.',
      distanceAnswer:
        'Historic centre. Allow a taxi or organised shore excursion from the municipal piers — confirm pier assignment and whether your ship is alongside or tendered before you leave the terminal area.',
      publicTransport:
        'Historic centre. Allow a taxi or organised shore excursion from the municipal piers — confirm pier assignment and whether your ship is alongside or tendered before you leave the terminal area.',
    },
    thingsToDo: {
      topThings: [
        'Ponce historic centre — Plaza Las Delicias — ~120 min.',
        'Parque de Bombas firehouse museum — central Ponce — ~60 min.',
        'Museo de Arte de Ponce — longer call with taxi — ~150 min.',
        'La Guancha boardwalk — seafood lunch stop — ~90 min.',
        'Coffee plantation / south-coast coach — long call only.',
      ],
      shortCall:
        '≥4 h. One central Ponce stop (Plaza Las Delicias area) with ≥90 min tender/transport buffer if assigned anchorage.',
    },
    practicalTip:
      'Ponce is not San Juan — keep port codes and excursion pickup points labelled Ponce on your documents.',
  },
}

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — stage78 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`
}

function deepMerge(target, patch) {
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      target[k] = { ...(target[k] || {}), ...v }
    } else {
      target[k] = v
    }
  }
  return target
}

function main() {
  const manifestPath = path.join(PREP, 'STAGE78_PREP_MANIFEST.json')
  const recoveryPath = path.join(PREP, 'RECOVERY_RESULTS.json')
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'))
  const recovery = JSON.parse(fs.readFileSync(recoveryPath, 'utf8'))
  const patchPath = path.join(PREP, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })

  try {
    for (const [landingSlug, patch] of Object.entries(PATCHES)) {
      const proposedPath = path.join(PREP, 'proposed-guides', `${landingSlug}.json`)
      const guide = JSON.parse(fs.readFileSync(proposedPath, 'utf8'))
      guide.landing_slug = landingSlug
      deepMerge(guide, patch)
      if (patch.practicalTip) guide.thingsToDo.practicalTip = patch.practicalTip

      const leakBlob = JSON.stringify({
        portInfo: guide.portInfo,
        gettingThere: guide.gettingThere,
        thingsToDo: guide.thingsToDo,
      })
      if (containsInternalResearchLeak(leakBlob)) {
        throw new Error(`repair still leaks: ${landingSlug}`)
      }

      const portRow = manifest.ports.find((p) => p.landing_slug === landingSlug)
      if (!portRow) throw new Error(`manifest row missing: ${landingSlug}`)
      const validation = validateEditorialDraft({
        draft: guide,
        manifestRow: {
          landing_slug: landingSlug,
          app_port_id: portRow.app_port_id,
          qa_verdict: 'PASS',
          research_sha256: portRow.research_sha256,
          publication_bucket: 'NEEDS_REVIEW',
        },
        researchRoot: compositeRoot,
      })
      const scan = scanDraftFields(guide)
      const ownerBucket = classifyOwnerBucket({
        validationOk: validation.ok,
        supportedAttractions: (guide.thingsToDo?.topThings || []).length,
        scan,
        unresolved: guide.researchImport?.unresolved_claims,
        editorialFailures: validation.failures,
      })
      const factual = reviewConsequentialClaims({ guide, landingSlug, researchRoot: compositeRoot, fieldExclusions: [] })
      const fragment = buildPhase1GuideHtml({
        port: { name: guide.portName, slug: landingSlug, appPortId: guide.appPortId, country: guide.country },
        guide,
        terminals: [],
        affiliate: { show: false },
      })
      const html = shellHtml(fragment, guide.portName)
      const htmlVal = validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true })
      const callPlanCards = (html.match(/pg-call-plan-card/g) || []).length
      const portPass =
        validation.ok &&
        ownerBucket === 'READY_FOR_OWNER_APPROVAL' &&
        htmlVal.ok &&
        callPlanCards >= 3 &&
        !factual.exclude_from_release

      fs.writeFileSync(proposedPath, `${JSON.stringify(guide, null, 2)}\n`, 'utf8')
      fs.writeFileSync(path.join(PREP, 'previews-local-only', `${landingSlug}.html`), html, 'utf8')

      {
        portRow.proposed_content_hash = crypto.createHash('sha256').update(stableStringify(guide)).digest('hex')
        portRow.technical_apply_eligible = portPass
        portRow.publication_gates_pass = portPass
        portRow.owner_bucket = ownerBucket
      }

      const recRow = recovery.ports.find((p) => p.landing_slug === landingSlug)
      if (recRow) {
        Object.assign(recRow, {
          owner_bucket: ownerBucket,
          publication_gates_pass: portPass,
          validation_failures: validation.failures,
          call_plan_cards: callPlanCards,
        })
      }
      if (!portPass) {
        throw new Error(`gates still fail ${landingSlug}: ${validation.failures.join(',')}`)
      }
    }

    const technicallyEligible = manifest.ports.filter((p) => p.technical_apply_eligible)
    manifest.bundle_idempotency_hash = crypto
      .createHash('sha256')
      .update(
        stableStringify(
          technicallyEligible.map((p) => ({
            landing_slug: p.landing_slug,
            app_port_id: p.app_port_id,
            proposed_content_hash: p.proposed_content_hash,
          }))
        )
      )
      .digest('hex')
    manifest.slugs_technical_eligible = technicallyEligible.map((p) => p.landing_slug).sort()
    manifest.status = technicallyEligible.length === 5 ? 'READY_FOR_OWNER_REVIEW' : 'PARTIAL'

    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    fs.writeFileSync(recoveryPath, `${JSON.stringify(recovery, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ ok: true, eligible: technicallyEligible.length, bundle: manifest.bundle_idempotency_hash }, null, 2))
  } finally {
    cleanup()
  }
}

main()

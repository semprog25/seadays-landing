#!/usr/bin/env node
'use strict'

/**
 * Rebuild proposed guides + local previews from corrected-drafts (post Stage 72 repair).
 * Does not regenerate drafts from research.
 */

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { applyEditorialDraftToGuide } = require('./lib/bulkPortPublication/stage24ApplyEditorialDraft')
const { reviewConsequentialClaims } = require('./lib/bulkPortPublication/stage24FactualEvidence')
const { validateEditorialDraft } = require('./lib/bulkPortPublication/validateEditorialDraft')
const { validateGeneratedPortHtml } = require('./lib/bulkPortPublication/validatePortHtml')
const { buildPhase1GuideHtml, PORT_GUIDE_STYLES } = require('./lib/portGuideSections')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')
const { containsInternalResearchLeak, preparePassengerGuideText } = require('./lib/publicGuideCopySanitize')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { PROMPT_VERSION } = require('./lib/bulkPortPublication/editorialDraftSchema')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { dryRunPortImport } = require('./lib/portResearchImport/transformResearchToPublic')
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields')
const { buildBootstrapGuideShell } = require('./lib/bulkPortPublication/stage65UnpublishedCohort')

const REPO = path.join(__dirname, '..')
const OUT = path.join(REPO, 'qa-evidence/stage71-bootstrap-25')

function shellHtml(fragment, title) {
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — stage72 preview</title>
<style>${PORT_GUIDE_STYLES}</style>
</head><body class="pg-dark"><main class="pg-main">${fragment}</main></body></html>`
}

function sanitizePassengerGuideSurfaces(guide) {
  for (const { holder, key } of listPassengerTextFields(guide)) {
    if (typeof holder[key] !== 'string') continue
    holder[key] = preparePassengerGuideText(holder[key], { label: `guide_field_${key}` })
  }
  return guide
}

function main() {
  const slugsArg = process.argv[2]
  const repair = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE72_REPAIRS_APPLIED.json'), 'utf8'))
  const slugs = slugsArg ? slugsArg.split(',').map((s) => s.trim()) : repair.slugs
  const selected = JSON.parse(fs.readFileSync(path.join(OUT, 'SELECTED_CANDIDATES.json'), 'utf8'))
  const bySlug = new Map(selected.map((r) => [r.landing_slug, r]))
  const patchPath = path.join(OUT, 'COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({ landingRepoRoot: REPO, patchPath })
  const guides = loadPublicPortGuidesFile(REPO)
  const manifest = JSON.parse(fs.readFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), 'utf8'))
  const manifestBySlug = new Map(manifest.ports.map((p) => [p.landing_slug, p]))

  try {
    for (const landingSlug of slugs) {
      const row = bySlug.get(landingSlug)
      if (!row) throw new Error(`unknown slug ${landingSlug}`)
      const wrap = JSON.parse(fs.readFileSync(path.join(OUT, 'corrected-drafts', `${landingSlug}.json`), 'utf8'))
      const draft = wrap.draft
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug,
        manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
      })
      if (!sha.ok) throw new Error(`research sha mismatch ${landingSlug}`)

      const validation = validateEditorialDraft({ draft, manifestRow: row, researchRoot: compositeRoot })
      wrap.validation = validation
      fs.writeFileSync(path.join(OUT, 'corrected-drafts', `${landingSlug}.json`), `${JSON.stringify(wrap, null, 2)}\n`, 'utf8')

      const live = guides.byAppPortId[row.app_port_id]
      const existing = JSON.parse(JSON.stringify(live || buildBootstrapGuideShell(row)))
      const lockMeta = {
        draft_version: PROMPT_VERSION,
        research_sha256: row.research_sha256,
        landing_slug: landingSlug,
        locked_at_utc: new Date().toISOString(),
        draft_source: 'stage72-corrected-draft',
      }
      let proposed = applyEditorialDraftToGuide({
        existingGuide: existing,
        draft,
        fieldExclusions: [],
        lockMeta,
      })
      const researchMerge = dryRunPortImport({
        researchRoot: compositeRoot,
        landingSlug,
        manifestRow: { ...row, qa_verdict: 'PASS' },
        existingGuide: proposed,
        existingTerminals: [],
        qaVerdict: 'PASS',
      })
      if (researchMerge.mergedGuide) {
        proposed = { ...proposed, ...researchMerge.mergedGuide, appPortId: row.app_port_id }
      }
      if (String(draft.portInfo?.description || '').trim()) {
        proposed.portInfo = { ...(proposed.portInfo || {}), description: draft.portInfo.description }
      }
      if (draft.gettingThere) {
        proposed.gettingThere = { ...(proposed.gettingThere || {}), ...draft.gettingThere }
      }
      if (draft.thingsToDo) {
        proposed.thingsToDo = { ...(proposed.thingsToDo || {}), ...draft.thingsToDo }
      }
      proposed = sanitizePassengerGuideSurfaces(proposed)
      proposed.researchImport = {
        ...(proposed.researchImport || {}),
        stage71_bootstrap_release_candidate: true,
        owner_publication_authorized: false,
      }

      const factual = reviewConsequentialClaims({
        guide: proposed,
        landingSlug,
        researchRoot: compositeRoot,
        fieldExclusions: [],
      })
      const fragment = buildPhase1GuideHtml({
        port: {
          name: proposed.portName,
          slug: landingSlug,
          appPortId: proposed.appPortId,
          country: proposed.country,
        },
        guide: proposed,
        terminals: researchMerge.mergedTerminals || [],
        affiliate: { show: false },
      })
      const html = shellHtml(fragment, proposed.portName || landingSlug)
      validateGeneratedPortHtml(html, { slug: landingSlug, previewFragment: true })

      const proposedContentHash = crypto.createHash('sha256').update(stableStringify(proposed)).digest('hex')
      const draftSha = crypto.createHash('sha256').update(stableStringify(wrap)).digest('hex')

      fs.writeFileSync(path.join(OUT, 'proposed-guides', `${landingSlug}.json`), `${JSON.stringify(proposed, null, 2)}\n`, 'utf8')
      fs.writeFileSync(path.join(OUT, 'previews-local-only', `${landingSlug}.html`), html, 'utf8')

      const mp = manifestBySlug.get(landingSlug)
      if (mp) {
        mp.draft_content_hash = draftSha
        mp.proposed_content_hash = proposedContentHash
        mp.stage72_rebuilt_at_utc = new Date().toISOString()
      }
    }

    const eligible = manifest.ports.filter((p) => p.technical_apply_eligible)
    manifest.bundle_idempotency_hash = crypto
      .createHash('sha256')
      .update(
        stableStringify(
          eligible.map((p) => ({
            landing_slug: p.landing_slug,
            proposed_content_hash: p.proposed_content_hash,
            draft_content_hash: p.draft_content_hash,
            research_sha256: p.research_sha256,
          }))
        )
      )
      .digest('hex')
    fs.writeFileSync(path.join(OUT, 'STAGE71_MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
    console.log(JSON.stringify({ rebuilt: slugs.length, bundle: manifest.bundle_idempotency_hash }, null, 2))
  } finally {
    cleanup()
  }
}

main()

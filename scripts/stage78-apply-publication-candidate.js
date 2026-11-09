#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { execSync } = require('child_process')
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter')
const { verifyResearchPortSha } = require('./lib/portResearchImport/verifyResearchSha')
const { resolveCompositeResearchRoot } = require('./lib/portResearchImport/resolveCompositeResearchRoot')
const { removeStage65ExcludedGuideEntries } = require('./lib/bulkPortPublication/stage65PublicationGuards')
const { assignPublicPortGuideByAppPortId } = require('./lib/bulkPortPublication/crossCountryHomonymPublicationGuards')
const { getAliasRedirectTarget } = require('./lib/portSeoRedirects')
const { buildPublishedSlugSet, exclusionReasonForSlug } = require('./lib/bulkPortPublication/stage43PublishedBaseline')
const { usesPassengerEditorialLead } = require('./lib/publicGuideCopySanitize')
const { stableStringify } = require('./lib/portResearchImport/jsonDiff')

const REPO = path.join(__dirname, '..')
const PREP = path.join(REPO, 'qa-evidence/stage78-five-port-prep')
const EVIDENCE = path.join(REPO, 'qa-evidence/stage78-publication-5')
const PREP_MANIFEST = path.join(PREP, 'STAGE78_PREP_MANIFEST.json')
const CANDIDATE_MANIFEST = path.join(EVIDENCE, 'STAGE78_PUBLICATION_MANIFEST.json')

const PRESERVE_HTML_SLUGS = [
  'perfect-day-at-cococay-bahamas',
  'cape-liberty-bayonne-nj-united-states',
  'oslo-norway',
  'vancouver-bc-canada',
  'kefalonia-greece',
]

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')
}

function fail(msg) {
  console.error(JSON.stringify({ error: 'STAGE78_PUBLICATION_CANDIDATE_APPLY_STOP', message: msg }, null, 2))
  process.exit(42)
}

function loadGuideForApply(row) {
  const proposed = JSON.parse(fs.readFileSync(path.join(REPO, row.proposed_guide_ref), 'utf8'))
  const correctedPath = path.join(REPO, row.corrected_draft_ref || '')
  if (row.corrected_draft_ref && fs.existsSync(correctedPath)) {
    const correctedWrap = JSON.parse(fs.readFileSync(correctedPath, 'utf8'))
    const corrected = correctedWrap.draft || correctedWrap
    if (!String(proposed.portInfo?.description || '').trim() && String(corrected.portInfo?.description || '').trim()) {
      proposed.portInfo = { ...(proposed.portInfo || {}), ...(corrected.portInfo || {}) }
    }
  }
  if (!String(proposed.portInfo?.description || '').trim()) {
    fail(`portInfo.description required for HTML gen: ${row.landing_slug}`)
  }
  return proposed
}

function snapshotProtectedHtml(rollbackDir, landingSlug) {
  const page = path.join(REPO, 'ports', landingSlug, 'index.html')
  if (!fs.existsSync(page)) return
  fs.mkdirSync(path.join(rollbackDir, 'ports', landingSlug), { recursive: true })
  fs.copyFileSync(page, path.join(rollbackDir, 'ports', landingSlug, 'index.html'))
}

function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (!fs.existsSync(CANDIDATE_MANIFEST)) {
    fail('run stage78-prepare-publication-candidate.js first')
  }
  const candidate = JSON.parse(fs.readFileSync(CANDIDATE_MANIFEST, 'utf8'))
  if (candidate.publication_candidate_apply_permitted !== true) {
    fail('publication_candidate_apply_permitted is not true')
  }
  if (candidate.owner_publication_authorized === true || candidate.production_apply_permitted === true) {
    fail('owner publication flags must remain false on candidate manifest')
  }
  if ((candidate.slugs_approved || []).length > 0) {
    fail('slugs_approved must remain empty on candidate manifest')
  }

  const prepManifest = JSON.parse(fs.readFileSync(PREP_MANIFEST, 'utf8'))
  const EXPECTED_BUNDLE = candidate.preparation_bundle_hash
  if (!EXPECTED_BUNDLE || prepManifest.bundle_idempotency_hash !== EXPECTED_BUNDLE) {
    fail('bundle hash mismatch between prep manifest and candidate manifest')
  }

  const candidateAll = (candidate.slugs_publication_candidate || []).slice().sort()
  if (candidateAll.length !== 5) fail(`expected 5 candidate slugs, got ${candidateAll.length}`)

  const portsBySlug = new Map(prepManifest.ports.map((p) => [p.landing_slug, p]))
  const publishedSet = buildPublishedSlugSet(REPO)
  const guidesBefore = loadPublicPortGuidesFile(REPO)

  const patchPath = path.join(PREP, 'COMPOSITE_SHA_PATCH.json')
  if (!fs.existsSync(patchPath)) fail('missing COMPOSITE_SHA_PATCH.json')
  const { compositeRoot, cleanup } = resolveCompositeResearchRoot({
    landingRepoRoot: REPO,
    patchPath,
  })
  try {
    for (const landingSlug of candidateAll) {
      const row = portsBySlug.get(landingSlug)
      if (!row?.technical_apply_eligible || !row.publication_gates_pass) fail(`technical gates not pass: ${landingSlug}`)
      if (row.production_apply_allowed === true) {
        fail(`production_apply_allowed must remain false on prep row: ${landingSlug}`)
      }
      const ex = exclusionReasonForSlug(landingSlug, publishedSet)
      if (ex) fail(`not net-new: ${landingSlug} (${ex})`)
      const prior = guidesBefore.byAppPortId?.[row.app_port_id]
      if (prior && usesPassengerEditorialLead(prior)) fail(`slot already passenger_editorial: ${landingSlug}`)
      const proposedPath = path.join(REPO, row.proposed_guide_ref)
      if (!fs.existsSync(proposedPath)) fail(`missing proposed: ${landingSlug}`)
      const contentHash = crypto
        .createHash('sha256')
        .update(stableStringify(JSON.parse(fs.readFileSync(proposedPath, 'utf8'))))
        .digest('hex')
      if (row.proposed_content_hash && contentHash !== row.proposed_content_hash) {
        fail(`proposed content hash mismatch: ${landingSlug}`)
      }
      const sha = verifyResearchPortSha({
        researchRoot: compositeRoot,
        landingSlug,
        manifestRow: { landing_slug: landingSlug, sha256: row.research_sha256 },
      })
      if (!sha.ok) fail(`research sha ${landingSlug}: ${sha.reason}`)
    }
  } finally {
    cleanup()
  }

  const terminalsPath = path.join(REPO, 'data', 'public-port-terminals.json')
  const rollbackDir = path.join(EVIDENCE, 'rollback-pre-apply')
  const slugs = candidateAll.slice()

  if (!dryRun) {
    fs.mkdirSync(rollbackDir, { recursive: true })
    fs.copyFileSync(path.join(REPO, 'data/public-port-guides.json'), path.join(rollbackDir, 'public-port-guides.json'))
    if (fs.existsSync(terminalsPath)) {
      fs.copyFileSync(terminalsPath, path.join(rollbackDir, 'public-port-terminals.json'))
    }
    for (const landingSlug of slugs) {
      snapshotProtectedHtml(rollbackDir, landingSlug)
    }
    for (const landingSlug of PRESERVE_HTML_SLUGS) {
      snapshotProtectedHtml(rollbackDir, landingSlug)
    }
  }

  const nextGuides = JSON.parse(JSON.stringify(guidesBefore))
  const appliedAt = new Date().toISOString()
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug)
    const proposed = loadGuideForApply(row)
    const g = JSON.parse(JSON.stringify(proposed))
    g.researchImport = {
      ...(g.researchImport || {}),
      publication_tier: 'passenger_editorial',
      stage78_publication_candidate: true,
      stage78_preparation_bundle_hash: prepManifest.bundle_idempotency_hash,
      preparation_pr_head: candidate.preparation_pr_head,
      research_main_pin: candidate.research_main_pin,
      candidate_applied_at_utc: appliedAt,
      field_exclusions: row.field_exclusions || [],
      owner_publication_authorized: false,
    }
    assignPublicPortGuideByAppPortId(nextGuides, {
      landingSlug,
      appPortId: row.app_port_id,
      guide: g,
      priorGuideAtSlot: guidesBefore.byAppPortId[row.app_port_id],
    })
  }
  removeStage65ExcludedGuideEntries(nextGuides)

  if (dryRun) {
    console.log(JSON.stringify({ dry_run: true, slugs, bundle_hash: prepManifest.bundle_idempotency_hash }, null, 2))
    return
  }

  writePublicPortGuidesFile(REPO, nextGuides)
  for (const landingSlug of slugs) {
    const row = portsBySlug.get(landingSlug)
    const prior = guidesBefore.byAppPortId?.[row.app_port_id]
    const wasPassenger = prior && usesPassengerEditorialLead(prior)
    if (!wasPassenger) {
      const page = path.join(REPO, 'ports', landingSlug, 'index.html')
      if (fs.existsSync(page)) fs.unlinkSync(page)
    }
  }
  const standaloneAliases = slugs.filter((s) => getAliasRedirectTarget(s)).sort()
  const slugMap = {}
  for (const landingSlug of slugs) {
    slugMap[landingSlug] = portsBySlug.get(landingSlug).app_port_id
  }
  const slugMapPath = path.join(EVIDENCE, 'STAGE78_PUBLICATION_SLUG_MAP.json')
  fs.writeFileSync(slugMapPath, `${JSON.stringify(slugMap, null, 2)}\n`, 'utf8')
  const only = slugs.join(',')
  const genEnv = {
    ...process.env,
    STAGE68_PUBLICATION_STANDALONE_ALIAS_SLUGS: standaloneAliases.join(','),
    STAGE68_PUBLICATION_SLUG_MAP: slugMapPath,
    VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00314321',
    VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || '42383',
    VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
  }
  execSync(`node scripts/generateBlogs.js --ports-only --only=${only}`, { cwd: REPO, stdio: 'inherit', env: genEnv })

  const applyReport = {
    applied_at_utc: appliedAt,
    slugs,
    slug_count: slugs.length,
    bundle_hash: prepManifest.bundle_idempotency_hash,
    preparation_bundle_hash: prepManifest.bundle_idempotency_hash,
    guides_sha256: sha256File(path.join(REPO, 'data/public-port-guides.json')),
    manifest_lock: prepManifest.lock_version,
    candidate_only: true,
    owner_publication_authorized: false,
    research_main_pin: candidate.research_main_pin,
  }
  fs.mkdirSync(EVIDENCE, { recursive: true })
  fs.writeFileSync(path.join(EVIDENCE, 'APPLY_REPORT.json'), `${JSON.stringify(applyReport, null, 2)}\n`, 'utf8')
  console.log(JSON.stringify(applyReport, null, 2))
}

main()

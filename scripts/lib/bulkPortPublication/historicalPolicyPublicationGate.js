'use strict'

const fs = require('fs')
const path = require('path')
const {
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  STAGE60_OWNER_POLICY_EXCEPTION_SLUGS,
} = require('./stage43PublishedBaseline')
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter')
const { removeStage65ExcludedGuideEntries } = require('./stage65PublicationGuards')

const BODO_SLUG = 'bod-norway'

function landingSlugFromGuide(guide) {
  return guide?.researchImport?.landing_slug || null
}

function isUnauthorizedHistoricalPassengerEditorial(guide) {
  const slug = landingSlugFromGuide(guide)
  if (!slug) return false
  if (!STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug)) return false
  if (STAGE60_OWNER_POLICY_EXCEPTION_SLUGS.has(slug)) return false
  if (guide?.researchImport?.publication_tier !== 'passenger_editorial') return false
  if (guide?.researchImport?.owner_publication_authorized === true) return false
  return true
}

function findUnauthorizedHistoricalPassengerEditorialInGuides(guides) {
  const violations = []
  for (const [appPortId, guide] of Object.entries(guides?.byAppPortId || {})) {
    if (!isUnauthorizedHistoricalPassengerEditorial(guide)) continue
    violations.push({
      kind: 'guides_json',
      slug: landingSlugFromGuide(guide),
      app_port_id: appPortId,
      owner_publication_authorized: guide?.researchImport?.owner_publication_authorized ?? null,
    })
  }
  return violations
}

function countPassengerEditorialCallPlans(html) {
  return (String(html).match(/<article class="pg-call-plan-card/g) || []).length
}

function findUnauthorizedHistoricalEditorialHtml(repoRoot, guides) {
  const violations = []
  const bySlug = new Map()
  for (const guide of Object.values(guides?.byAppPortId || {})) {
    const slug = landingSlugFromGuide(guide)
    if (slug) bySlug.set(slug, guide)
  }
  for (const slug of STAGE43_HARD_EXCLUDE_HISTORICAL) {
    if (STAGE60_OWNER_POLICY_EXCEPTION_SLUGS.has(slug)) continue
    const htmlPath = path.join(repoRoot, 'ports', slug, 'index.html')
    if (!fs.existsSync(htmlPath)) continue
    const guide = bySlug.get(slug)
    if (guide?.researchImport?.owner_publication_authorized === true) continue
    const html = fs.readFileSync(htmlPath, 'utf8')
    const callPlans = countPassengerEditorialCallPlans(html)
    if (callPlans < 3) continue
    violations.push({
      kind: 'port_html',
      slug,
      call_plan_cards: callPlans,
      owner_publication_authorized: guide?.researchImport?.owner_publication_authorized ?? null,
    })
  }
  return violations
}

function collectHistoricalPolicyPublicationViolations(repoRoot, guidesInput) {
  const repo = repoRoot || path.join(__dirname, '..', '..', '..')
  const guides = guidesInput || loadPublicPortGuidesFile(repo)
  removeStage65ExcludedGuideEntries(guides)
  return [
    ...findUnauthorizedHistoricalPassengerEditorialInGuides(guides),
    ...findUnauthorizedHistoricalEditorialHtml(repo, guides),
  ]
}

function assertHistoricalPolicyPublicationGate(repoRoot, guidesInput) {
  const violations = collectHistoricalPolicyPublicationViolations(repoRoot, guidesInput)
  if (!violations.length) return { ok: true, violations: [] }
  const summary = violations
    .map((v) => `${v.kind}:${v.slug}${v.app_port_id ? `(${v.app_port_id})` : ''}`)
    .join('; ')
  const err = new Error(`historical policy publication gate: ${summary}`)
  err.violations = violations
  throw err
}

module.exports = {
  BODO_SLUG,
  isUnauthorizedHistoricalPassengerEditorial,
  findUnauthorizedHistoricalPassengerEditorialInGuides,
  findUnauthorizedHistoricalEditorialHtml,
  collectHistoricalPolicyPublicationViolations,
  assertHistoricalPolicyPublicationGate,
  countPassengerEditorialCallPlans,
}

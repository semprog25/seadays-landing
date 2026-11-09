'use strict'

const {
  buildPublishedSlugSet,
  STAGE43_HARD_EXCLUDE,
  exclusionReasonForSlug,
} = require('./stage43PublishedBaseline')
const {
  assertSafePublicPortGuideSlotWrite,
  FALMOUTH_JAMAICA_LANDING_SLUG,
} = require('./crossCountryHomonymPublicationGuards')
const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize')
const { normalizeCountryKey } = require('../publicPortGuideAdapter')

const STAGE69_OWNER_HOLD = new Set([
  'tokyo-yokohama-japan',
  'kirkenes-norway',
  'ocho-rios-jamaica',
  'glasgow-united-kingdom',
  'rostock-germany',
])

function identityBlockReason(row, { publishedSet, livePassengerSlugs, guides, cohortAppIds }) {
  const slug = row.landing_slug
  if (!slug) return 'missing_landing_slug'
  if (slug === FALMOUTH_JAMAICA_LANDING_SLUG) return 'falmouth_homonym_excluded'
  if (STAGE69_OWNER_HOLD.has(slug)) return 'owner_factual_hold'
  if (STAGE43_HARD_EXCLUDE.has(slug)) return 'historical_policy_hold'
  if (livePassengerSlugs.has(slug)) return 'already_published_passenger_editorial'
  if (publishedSet.has(slug) && !livePassengerSlugs.has(slug)) {
    return 'historical_ledger_not_live_passenger_editorial'
  }
  const ex = exclusionReasonForSlug(slug, publishedSet)
  if (ex && ex !== 'already_published_passenger_editorial') return ex
  if (!row.app_port_id) return 'missing_app_port_id'
  if (row.identifier_status === 'unresolved') return 'identifier_unresolved'
  if (row.qa_verdict !== 'PASS') return 'research_qa_not_pass'
  const prior = guides.byAppPortId[row.app_port_id]
  if (prior && usesPassengerEditorialLead(prior)) {
    const priorSlug = prior.researchImport?.landing_slug
    if (priorSlug && priorSlug !== slug) return 'app_port_id_occupied_by_passenger_editorial'
  }
  const cohortPeers = cohortAppIds.get(row.app_port_id) || []
  if (cohortPeers.length > 1) return 'duplicate_app_port_id_within_cohort'
  if (row.multi_slug_app_port_id_peers?.length) {
    const peerPublished = row.multi_slug_app_port_id_peers.some((s) => livePassengerSlugs.has(s))
    if (peerPublished) return 'multi_slug_peer_already_published'
  }
  const researchCountry = normalizeCountryKey(row.country || '')
  const priorCountry = prior ? normalizeCountryKey(prior.country || '') : ''
  if (prior && priorCountry && researchCountry && priorCountry !== researchCountry) {
    return 'cross_country_slot_conflict'
  }
  try {
    assertSafePublicPortGuideSlotWrite({
      landingSlug: slug,
      targetAppPortId: row.app_port_id,
      proposedGuide: {
        appPortId: row.app_port_id,
        country: row.country,
        researchImport: { landing_slug: slug },
      },
      priorGuideAtSlot: prior,
    })
  } catch (err) {
    return String(err.code || err.message)
  }
  return null
}

module.exports = {
  STAGE69_OWNER_HOLD,
  FALMOUTH_JAMAICA_LANDING_SLUG,
  identityBlockReason,
  buildPublishedSlugSet,
}

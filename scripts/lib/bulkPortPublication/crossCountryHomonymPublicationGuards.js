'use strict'

const { normalizeCountryKey } = require('../publicPortGuideAdapter')
const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize')

/** UK passenger guide locked at this app id until cross-repo id migration (see qa-evidence doc). */
const FALMOUTH_UK_APP_PORT_ID = 'falmouth'
const FALMOUTH_JAMAICA_LANDING_SLUG = 'falmouth-jamaica'
const FALMOUTH_UK_LANDING_SLUG = 'falmouth-united-kingdom'

const BLOCK_CODE = 'CROSS_COUNTRY_HOMONYM_BLOCKED'

function isLockedUkFalmouthGuide(guide) {
  if (!guide || typeof guide !== 'object') return false
  const landingSlug = String(guide.researchImport?.landing_slug || '').trim()
  if (landingSlug === FALMOUTH_UK_LANDING_SLUG) return true
  const country = normalizeCountryKey(guide.country || '')
  if (country !== 'united kingdom') return false
  return usesPassengerEditorialLead(guide) || landingSlug === FALMOUTH_UK_LANDING_SLUG
}

/**
 * Fail closed before slot assignment (bootstrap / stage apply).
 */
function assertSafePublicPortGuideSlotWrite({
  landingSlug,
  targetAppPortId,
  proposedGuide,
  priorGuideAtSlot,
}) {
  const slug = String(landingSlug || proposedGuide?.researchImport?.landing_slug || '').trim()
  const appId = String(targetAppPortId || '').trim()
  if (appId !== FALMOUTH_UK_APP_PORT_ID) return
  if (slug !== FALMOUTH_JAMAICA_LANDING_SLUG) return
  if (!isLockedUkFalmouthGuide(priorGuideAtSlot)) return
  const err = new Error(
    `${BLOCK_CODE}: ${FALMOUTH_JAMAICA_LANDING_SLUG} cannot write to byAppPortId.${FALMOUTH_UK_APP_PORT_ID} while UK passenger editorial is present`
  )
  err.code = BLOCK_CODE
  throw err
}

/**
 * Fail closed on full payload before any disk write via writePublicPortGuidesFile / atomic apply.
 */
function assertPublicPortGuidesPayloadSafe(payload) {
  if (!payload?.byAppPortId) return
  const slot = payload.byAppPortId[FALMOUTH_UK_APP_PORT_ID]
  if (!slot) return
  const landingSlug = String(slot.researchImport?.landing_slug || '').trim()
  const country = normalizeCountryKey(slot.country || '')
  if (landingSlug === FALMOUTH_JAMAICA_LANDING_SLUG) {
    const err = new Error(
      `${BLOCK_CODE}: byAppPortId.${FALMOUTH_UK_APP_PORT_ID} must not carry ${FALMOUTH_JAMAICA_LANDING_SLUG} researchImport`
    )
    err.code = BLOCK_CODE
    throw err
  }
  if (country === 'jamaica' && landingSlug !== FALMOUTH_UK_LANDING_SLUG) {
    const err = new Error(
      `${BLOCK_CODE}: byAppPortId.${FALMOUTH_UK_APP_PORT_ID} must not store Jamaica country metadata`
    )
    err.code = BLOCK_CODE
    throw err
  }
}

function assignPublicPortGuideByAppPortId(guides, { landingSlug, appPortId, guide, priorGuideAtSlot }) {
  assertSafePublicPortGuideSlotWrite({
    landingSlug,
    targetAppPortId: appPortId,
    proposedGuide: guide,
    priorGuideAtSlot,
  })
  if (!guides.byAppPortId) guides.byAppPortId = {}
  guides.byAppPortId[appPortId] = guide
}

module.exports = {
  BLOCK_CODE,
  FALMOUTH_UK_APP_PORT_ID,
  FALMOUTH_JAMAICA_LANDING_SLUG,
  FALMOUTH_UK_LANDING_SLUG,
  isLockedUkFalmouthGuide,
  assertSafePublicPortGuideSlotWrite,
  assertPublicPortGuidesPayloadSafe,
  assignPublicPortGuideByAppPortId,
}

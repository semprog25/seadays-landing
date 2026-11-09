'use strict'

/**
 * Stage 65 prepared glasgow-united-kingdom but owner-approved slugs excluded it
 * (replaced by greifswald-germany). Guide JSON must not retain passenger tier for glasgow.
 */
const STAGE65_EXCLUDED_APP_PORT_IDS = Object.freeze(['glasgow'])
const STAGE65_EXCLUDED_LANDING_SLUGS = Object.freeze(['glasgow-united-kingdom'])

function countPassengerEditorialGuides(guides) {
  const by = guides?.byAppPortId
  if (!by || typeof by !== 'object') return 0
  let n = 0
  for (const v of Object.values(by)) {
    if (v?.researchImport?.publication_tier === 'passenger_editorial') n += 1
  }
  return n
}

/**
 * @param {object} guides public-port-guides payload (mutated)
 * @returns {{ removed: string[] }}
 */
function removeStage65ExcludedGuideEntries(guides) {
  const removed = []
  if (!guides?.byAppPortId) return { removed }
  for (const appPortId of STAGE65_EXCLUDED_APP_PORT_IDS) {
    if (guides.byAppPortId[appPortId]) {
      delete guides.byAppPortId[appPortId]
      removed.push(appPortId)
    }
  }
  return { removed }
}

function assertStage65ExcludedNotPublished(guides) {
  const by = guides?.byAppPortId || {}
  for (const appPortId of STAGE65_EXCLUDED_APP_PORT_IDS) {
    const g = by[appPortId]
    if (!g) continue
    const tier = g?.researchImport?.publication_tier
    if (tier === 'passenger_editorial') {
      throw new Error(`stage65 excluded app port published: ${appPortId}`)
    }
  }
}

module.exports = {
  STAGE65_EXCLUDED_APP_PORT_IDS,
  STAGE65_EXCLUDED_LANDING_SLUGS,
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
  assertStage65ExcludedNotPublished,
}

'use strict'

const { preparePassengerGuideText } = require('../publicGuideCopySanitize')
const { readResearchMarkdown } = require('../portResearchImport/transformResearchToPublic')

const FREEPORT_LEAD =
  'Grand Bahama cruise calls use the Freeport Harbour complex (Hutchison Ports Bahamas FCP and FHC). Operator websites may not list pier dimensions or passenger-door coordinates—confirm your berth and shuttle plan on sailing documents and with the cruise line before you go ashore.'

const STUB_MARKETING = [
  /beautiful beaches, luxury resorts/i,
  /excellent facilities/i,
  /tropical attractions/i,
  /known for beaches, shopping/i,
]

function hedgedDistanceCopy() {
  return 'Walking and transfer times depend on which berth or tender point you use. Confirm with terminal staff and your ship before planning independent transport.'
}

function patchFreeport(draft, researchRoot) {
  const next = JSON.parse(JSON.stringify(draft))
  next.portName = 'Freeport'
  next.portInfo = {
    ...(next.portInfo || {}),
    description: FREEPORT_LEAD,
    population: '',
    location: '',
  }
  next.gettingThere = {
    ...(next.gettingThere || {}),
    fromTerminal:
      'Confirm whether you berth at Lucayan Harbour / Freeport Harbour cruise facilities—names on daily port programmes differ. These are not interchangeable with Nassau.',
    distanceAnswer: hedgedDistanceCopy(),
    distanceToCity: hedgedDistanceCopy(),
    publicTransport:
      'Taxis and resort shuttles are common when ships are in port; routes to Port Lucaya or beaches are not guaranteed without a confirmed pier—verify locally.',
  }
  next.thingsToDo = {
    ...(next.thingsToDo || {}),
    practicalTip: 'Match the facility name on your sailing documents before booking independent transport.',
    topThings: [
      'Port Lucaya / marketplace—only when your call uses confirmed Freeport Harbour landings and transfers.',
      'Grand Bahama beach time—conditional on berth, weather, and agreed return time.',
      'Organised snorkel or nature tours—book through the ship or verified operators with a generous all-aboard buffer.',
    ],
  }
  next.passengerSurfaceClear = ['size', 'climate', 'facts', 'hero', 'terminals', 'reviews', 'experiences']
  return next
}

function patchGenericStub(draft, landingSlug, researchRoot) {
  const next = JSON.parse(JSON.stringify(draft))
  const desc = String(next.portInfo?.description || '')
  const isStub = STUB_MARKETING.some((re) => re.test(desc)) || desc.length < 80
  if (isStub && researchRoot) {
    try {
      const md = readResearchMarkdown(researchRoot, landingSlug)
      const overview = md.split(/^## Overview/m)[1]?.split(/^## /m)[0] || ''
      const paragraph = overview
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith('-') && !l.startsWith('|'))
        .slice(0, 2)
        .join(' ')
      if (paragraph) {
        const cleaned = preparePassengerGuideText(paragraph, { label: 'overview' })
        if (cleaned && cleaned.length > 60) next.portInfo.description = cleaned
      }
    } catch {
      /* keep synthesized draft */
    }
  }
  if (!String(next.gettingThere?.distanceAnswer || '').trim()) {
    next.gettingThere = { ...(next.gettingThere || {}), distanceAnswer: hedgedDistanceCopy() }
  }
  next.passengerSurfaceClear = ['size', 'climate', 'facts']
  return next
}

function applyBatch05PassengerPatch({ landingSlug, draft, researchRoot }) {
  if (landingSlug === 'freeport-bahamas') return patchFreeport(draft, researchRoot)
  return patchGenericStub(draft, landingSlug, researchRoot)
}

module.exports = {
  FREEPORT_LEAD,
  applyBatch05PassengerPatch,
}

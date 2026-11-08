'use strict';

const RESEARCH_SOURCE_MARKER_RE = /\[S\d+(?:\s+[^\]]*)?\]/i;

/**
 * Passenger-facing string fields that may flow into rendered port guides.
 * Does not include identifiers, coordinates, SEO blobs, Viator, or reviews.
 */
function listPassengerTextFields(guide) {
  const slots = [];
  if (typeof guide?.portInfo?.description === 'string') {
    slots.push({ holder: guide.portInfo, key: 'description' });
  }
  const getting = guide?.gettingThere;
  if (getting && typeof getting === 'object') {
    for (const key of ['fromTerminal', 'publicTransport', 'walkingTime', 'distanceToCity', 'taxiCost', 'notes']) {
      if (typeof getting[key] === 'string') slots.push({ holder: getting, key });
    }
  }
  const things = guide?.thingsToDo;
  if (things && typeof things === 'object') {
    for (const key of ['intro', 'shortCall', 'standardCall', 'longerCall', 'practicalTip']) {
      if (typeof things[key] === 'string') slots.push({ holder: things, key });
    }
    if (Array.isArray(things.topThings)) {
      things.topThings.forEach((item, index) => {
        if (typeof item === 'string') slots.push({ holder: things.topThings, key: index });
      });
    }
  }
  return slots;
}

function containsResearchSourceMarker(text) {
  return RESEARCH_SOURCE_MARKER_RE.test(String(text || ''));
}

module.exports = {
  RESEARCH_SOURCE_MARKER_RE,
  listPassengerTextFields,
  containsResearchSourceMarker,
};

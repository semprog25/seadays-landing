'use strict';

const { listPassengerTextFields } = require('../publicPortGuidePassengerTextFields');
const { preparePassengerGuideText } = require('../publicGuideCopySanitize');

/** Final passenger-surface pass before draft validation (research [S#] tokens must not leak). */
function sanitizePassengerDraftSurfaces(draft) {
  if (!draft || typeof draft !== 'object') return draft;
  for (const { holder, key } of listPassengerTextFields(draft)) {
    if (typeof holder[key] !== 'string') continue;
    const cleaned = preparePassengerGuideText(holder[key], { label: `draft_field_${key}` });
    holder[key] = cleaned;
  }
  return draft;
}

module.exports = { sanitizePassengerDraftSurfaces };

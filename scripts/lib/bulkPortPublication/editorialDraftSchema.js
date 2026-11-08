'use strict';

const SCHEMA_VERSION = 1;
const PROMPT_VERSION = 'stage22-deterministic-v2.5-marker-strip';
const MIN_TOP_THINGS = 3;
const MAX_TOP_THINGS = 5;

const REQUIRED_PATHS = [
  'portInfo.description',
  'gettingThere.fromTerminal',
  'gettingThere.distanceAnswer',
  'thingsToDo.intro',
  'thingsToDo.shortCall',
  'thingsToDo.standardCall',
  'thingsToDo.longerCall',
  'thingsToDo.practicalTip',
];

function emptyDraftMeta(overrides = {}) {
  return {
    schema_version: SCHEMA_VERSION,
    prompt_version: PROMPT_VERSION,
    draft_status: 'draft',
    publication_tier: 'passenger_editorial_draft',
    research_sha256: null,
    existing_guide_hash: null,
    source_provenance: [],
    unresolved_claims: [],
    generated_at_utc: null,
    cache_key: null,
    ...overrides,
  };
}

function validateDraftStructure(draft) {
  const errors = [];
  if (!draft || typeof draft !== 'object') {
    errors.push('draft_not_object');
    return { ok: false, errors };
  }
  if (!draft.appPortId) errors.push('missing_app_port_id');
  if (!draft.landing_slug) errors.push('missing_landing_slug');
  const top = draft.thingsToDo?.topThings;
  if (!Array.isArray(top) || top.length < MIN_TOP_THINGS) errors.push(`top_things_${top?.length || 0}`);
  if (Array.isArray(top) && top.length > MAX_TOP_THINGS) errors.push(`top_things_over_${top.length}`);
  for (const pathKey of REQUIRED_PATHS) {
    const val = pathKey.split('.').reduce((o, k) => (o && o[k] != null ? o[k] : ''), draft);
    if (!String(val || '').trim()) errors.push(`missing_${pathKey.replace(/\./g, '_')}`);
  }
  return { ok: errors.length === 0, errors };
}

function draftToGuideShape(draft) {
  return {
    appPortId: draft.appPortId,
    portName: draft.portName,
    country: draft.country,
    portInfo: draft.portInfo,
    gettingThere: draft.gettingThere,
    thingsToDo: draft.thingsToDo,
    shorePlansFirst: draft.shorePlansFirst !== false,
    researchImport: {
      ...(draft.researchImport || {}),
      publication_tier: 'passenger_editorial_draft',
      schema_version: SCHEMA_VERSION,
    },
  };
}

module.exports = {
  SCHEMA_VERSION,
  PROMPT_VERSION,
  MIN_TOP_THINGS,
  MAX_TOP_THINGS,
  REQUIRED_PATHS,
  emptyDraftMeta,
  validateDraftStructure,
  draftToGuideShape,
};

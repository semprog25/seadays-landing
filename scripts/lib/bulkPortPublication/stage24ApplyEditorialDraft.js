'use strict';

const crypto = require('crypto');
const { draftToGuideShape } = require('./editorialDraftSchema');
const { stableStringify } = require('../portResearchImport/jsonDiff');

const PRESERVE_KEYS = [
  'hero',
  'facts',
  'terminals',
  'reviews',
  'experiences',
  'viator',
  'media',
  'sourcesUsed',
  'lastEnrichment',
  'seo',
];

function applyFieldExclusions(out, exclusions, existingGuide) {
  for (const ex of exclusions) {
    if (ex === 'portInfo.description') {
      const preserved = String(existingGuide?.portInfo?.description || '').trim()
      if (out.portInfo) {
        if (preserved) out.portInfo.description = existingGuide.portInfo.description
        else delete out.portInfo.description
      }
      continue
    }
    if (ex.startsWith('thingsToDo.topThings[')) {
      const idx = Number(ex.match(/\[(\d+)\]/)?.[1]);
      if (!Number.isNaN(idx) && Array.isArray(out.thingsToDo?.topThings)) {
        out.thingsToDo.topThings[idx] = null;
      }
      continue;
    }
    const parts = ex.split('.');
    let cur = out;
    for (let i = 0; i < parts.length - 1; i += 1) {
      if (!cur[parts[i]]) break;
      cur = cur[parts[i]];
    }
    if (cur && parts.length) delete cur[parts[parts.length - 1]];
  }
  if (Array.isArray(out.thingsToDo?.topThings)) {
    out.thingsToDo.topThings = out.thingsToDo.topThings.filter(Boolean);
  }
}

const LEGACY_PASSENGER_SECTIONS = ['size', 'politics', 'climate', 'facts'];

function applyPassengerSurfaceClear(out, draft) {
  const clear = Array.isArray(draft?.passengerSurfaceClear) ? draft.passengerSurfaceClear : [];
  for (const key of clear) {
    if (LEGACY_PASSENGER_SECTIONS.includes(key)) delete out[key];
  }
  if (draft?.politics && typeof draft.politics === 'object') {
    out.politics = JSON.parse(JSON.stringify(draft.politics));
  }
  if (draft?.climate && typeof draft.climate === 'object') {
    out.climate = JSON.parse(JSON.stringify(draft.climate));
  }
  if (draft?.facts && typeof draft.facts === 'object') {
    out.facts = JSON.parse(JSON.stringify(draft.facts));
  }
  if (draft?.gettingThere && typeof draft.gettingThere === 'object') {
    for (const gkey of Object.keys(draft.gettingThere)) {
      if (draft.gettingThere[gkey] === undefined) continue;
      if (draft.gettingThere[gkey] === null || draft.gettingThere[gkey] === '') {
        if (out.gettingThere) delete out.gettingThere[gkey];
        continue;
      }
    }
  }
}

function applyEditorialDraftToGuide({
  existingGuide,
  draft,
  fieldExclusions = [],
  lockMeta,
}) {
  const patch = draftToGuideShape(draft);
  const out = JSON.parse(JSON.stringify(existingGuide || {}));
  const exclusions = fieldExclusions || [];

  out.portInfo = { ...(out.portInfo || {}), ...(patch.portInfo || {}) };
  if (patch.gettingThere && typeof patch.gettingThere === 'object') {
    out.gettingThere = JSON.parse(JSON.stringify(patch.gettingThere));
  } else if (patch.gettingThere) {
    out.gettingThere = { ...(out.gettingThere || {}), ...(patch.gettingThere || {}) };
  }
  out.thingsToDo = { ...(out.thingsToDo || {}), ...(patch.thingsToDo || {}) };
  if (patch.shorePlansFirst != null) out.shorePlansFirst = patch.shorePlansFirst;

  applyFieldExclusions(out, exclusions, existingGuide);
  applyPassengerSurfaceClear(out, draft);

  const clearedSections = new Set(draft?.passengerSurfaceClear || []);
  for (const key of PRESERVE_KEYS) {
    if (clearedSections.has(key)) continue;
    if (existingGuide?.[key] != null) out[key] = existingGuide[key];
  }

  out.appPortId = existingGuide?.appPortId || patch.appPortId;
  out.portName = patch.portName || existingGuide?.portName;
  out.country = existingGuide?.country || patch.country;

  const prevImport = existingGuide?.researchImport || {};
  out.researchImport = {
    ...prevImport,
    schema_version: patch.researchImport?.schema_version || prevImport.schema_version || 1,
    publication_tier: 'passenger_editorial_candidate',
    stage24_release_candidate: true,
    draft_id: lockMeta.draft_id,
    draft_version: lockMeta.draft_version,
    research_sha256: lockMeta.research_sha256,
    landing_slug: lockMeta.landing_slug,
    candidate_content_hash: null,
    locked_at_utc: lockMeta.locked_at_utc,
    field_exclusions: exclusions.slice().sort(),
    owner_approved: false,
    import_tier: 'stage24_dry_run_only',
  };

  const hashPayload = {
    portInfo: out.portInfo,
    gettingThere: out.gettingThere,
    thingsToDo: out.thingsToDo,
    shorePlansFirst: out.shorePlansFirst,
    field_exclusions: exclusions.slice().sort(),
    draft_id: lockMeta.draft_id,
  };
  out.researchImport.candidate_content_hash = crypto
    .createHash('sha256')
    .update(stableStringify(hashPayload))
    .digest('hex');

  return out;
}

module.exports = {
  applyEditorialDraftToGuide,
  applyPassengerSurfaceClear,
  PRESERVE_KEYS,
  LEGACY_PASSENGER_SECTIONS,
};

'use strict';

/** Port overrides aligned with qa-evidence/.../PORT_RESEARCH_MERGE_POLICY.md */
const PORT_POLICY_OVERRIDES = {
  'aalborg-denmark': {
    enrichment_mode: true,
    allow_thingsToDo_replace: true,
    allow_gettingThere_publicTransport_replace: true,
    allow_portInfo_description_replace: false,
    allow_terminal_map_pin: false,
    content_only_until_pin_verified: true,
    preserve_terminal_coordinates: true,
    preserve_terminal_descriptions: false,
    max_terminal_cards: 1,
    allow_entrance_sub_pins: false,
    allow_new_terminal_cards: false,
    reject_duplicate_terminal_slugs: [],
    reject_terminal_slug_patterns: [],
  },
  'hamburg-germany': {
    allow_thingsToDo_replace: false,
    allow_gettingThere_publicTransport_replace: false,
    allow_portInfo_description_replace: false,
    preserve_terminal_coordinates: true,
    preserve_terminal_descriptions: true,
    max_terminal_cards: 4,
    allow_entrance_sub_pins: false,
    allow_new_terminal_cards: false,
    reject_duplicate_terminal_slugs: ['cruise-center-baakenhoeft'],
    reject_terminal_slug_patterns: [/^steinwerder-(terminal|baggage)/i],
  },
};

const DEFAULT_POLICY = {
  enrichment_mode: false,
  allow_terminal_map_pin: true,
  content_only_until_pin_verified: false,
  allow_thingsToDo_replace: false,
  allow_gettingThere_publicTransport_replace: false,
  allow_portInfo_description_replace: false,
  preserve_terminal_coordinates: true,
  preserve_terminal_descriptions: true,
  max_terminal_cards: null,
  allow_entrance_sub_pins: false,
  allow_new_terminal_cards: false,
  reject_duplicate_terminal_slugs: [],
  reject_terminal_slug_patterns: [],
};

function getPortMergePolicy(landingSlug) {
  const patch = PORT_POLICY_OVERRIDES[landingSlug] || {};
  return { ...DEFAULT_POLICY, ...patch };
}

function shouldRejectTerminalSlug(slug, policy) {
  const s = String(slug || '').toLowerCase();
  if (!s) return { reject: true, reason: 'missing_slug' };
  for (const blocked of policy.reject_duplicate_terminal_slugs || []) {
    if (s === String(blocked).toLowerCase()) return { reject: true, reason: `duplicate_slug:${blocked}` };
  }
  for (const re of policy.reject_terminal_slug_patterns || []) {
    if (re.test(s)) return { reject: true, reason: `pattern:${re.source}` };
  }
  return { reject: false, reason: null };
}

module.exports = {
  getPortMergePolicy,
  shouldRejectTerminalSlug,
  PORT_POLICY_OVERRIDES,
};

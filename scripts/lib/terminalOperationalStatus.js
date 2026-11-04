'use strict';

const TERMINAL_STATUS = Object.freeze({
  ACTIVE: 'active',
  CLOSED: 'closed',
  TRANSITIONING: 'transitioning',
  PLANNED: 'planned',
});

const KNOWN = new Set(Object.values(TERMINAL_STATUS));

/**
 * Missing/empty status → active (backward compatible).
 * Unknown strings → null (fail-safe: not treated as active).
 */
function normalizeTerminalStatus(raw) {
  const s = String(raw || '')
    .trim()
    .toLowerCase();
  if (!s) return TERMINAL_STATUS.ACTIVE;
  if (!KNOWN.has(s)) return null;
  return s;
}

function isTerminalStatusActive(raw) {
  return normalizeTerminalStatus(raw) === TERMINAL_STATUS.ACTIVE;
}

function filterActiveTerminalsForDisplay(terminals) {
  return (Array.isArray(terminals) ? terminals : []).filter((t) => isTerminalStatusActive(t && t.terminal_status));
}

function collectTransitioningVisitorNotices(terminals) {
  return (Array.isArray(terminals) ? terminals : [])
    .filter((t) => normalizeTerminalStatus(t && t.terminal_status) === TERMINAL_STATUS.TRANSITIONING)
    .map((t) => String(t.visitor_notice || '').trim())
    .filter(Boolean);
}

module.exports = {
  TERMINAL_STATUS,
  normalizeTerminalStatus,
  isTerminalStatusActive,
  filterActiveTerminalsForDisplay,
  collectTransitioningVisitorNotices,
};

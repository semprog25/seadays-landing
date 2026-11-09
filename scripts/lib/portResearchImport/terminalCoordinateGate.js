'use strict';

/** Precision tiers allowed on the public map layer (not passenger door unless entrance type). */
const IMPORTABLE_PRECISION = new Set([
  'verified',
  'verified_approx',
  'verified_entrance_approx',
]);

const APPROX_FACILITY_TYPES = new Set([
  'port_area_approximate',
  'tender_landing_approximate',
]);

const ENTRANCE_FACILITY_TYPES = new Set(['terminal_entrance', 'tender_landing']);

function parseCoord(value) {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(String(value).trim());
  if (!Number.isFinite(n)) return null;
  if (n < -90 || n > 90) return null;
  return n;
}

function parseLng(value) {
  const n = parseCoord(value);
  if (n == null) return null;
  if (n < -180 || n > 180) return null;
  return n;
}

/**
 * @returns {{
 *   importable: boolean,
 *   tier: 'none'|'approximate_area'|'approximate_entrance'|'verified',
 *   reasons: string[],
 *   lat: number|null,
 *   lng: number|null,
 *   label: string
 * }}
 */
function evaluateTerminalPin(terminal) {
  const reasons = [];
  const lat = parseCoord(terminal?.latitude);
  const lng = parseLng(terminal?.longitude);
  if (lat == null || lng == null) {
    reasons.push('missing_finite_coordinates');
    return {
      importable: false,
      tier: 'none',
      reasons,
      lat: null,
      lng: null,
      label: 'no_pin',
    };
  }

  const precision = String(terminal?.coordinate_precision || '').trim();
  const facilityType = String(terminal?.facility_type || '').trim();
  const verification = String(terminal?.verification_status || '').trim();

  if (!IMPORTABLE_PRECISION.has(precision)) {
    reasons.push(`precision_not_importable:${precision || 'unset'}`);
    return { importable: false, tier: 'none', reasons, lat, lng, label: 'blocked_precision' };
  }

  if (!terminal?.pin_provenance || typeof terminal.pin_provenance !== 'object') {
    reasons.push('missing_pin_provenance');
    return { importable: false, tier: 'none', reasons, lat, lng, label: 'blocked_provenance' };
  }

  let tier = 'verified';
  let label = 'Verified location';

  if (ENTRANCE_FACILITY_TYPES.has(facilityType)) {
    tier = precision.includes('approx') ? 'approximate_entrance' : 'verified';
    label =
      precision.includes('approx')
        ? 'Approximate entrance reference — confirm at the terminal'
        : 'Terminal entrance reference';
  } else if (APPROX_FACILITY_TYPES.has(facilityType) || precision.includes('approx')) {
    tier = 'approximate_area';
    label = 'Approximate port-area reference — not a passenger door';
    reasons.push('approximate_area_pin');
  }

  if (verification === 'blocked' || verification === 'rejected') {
    reasons.push(`verification_status:${verification}`);
    return { importable: false, tier: 'none', reasons, lat, lng, label: 'blocked_verification' };
  }

  return {
    importable: true,
    tier,
    reasons,
    lat,
    lng,
    label,
  };
}

function buildTerminalImportNote(terminal, gate) {
  const parts = [gate.label];
  if (terminal?.assignment_caveat) {
    parts.push(String(terminal.assignment_caveat).trim());
  }
  if (gate.tier === 'approximate_area') {
    parts.push('Map pin is a building or port-area centroid, not a guaranteed gangway or check-in door.');
  }
  return parts.filter(Boolean).join(' ');
}

module.exports = {
  IMPORTABLE_PRECISION,
  evaluateTerminalPin,
  buildTerminalImportNote,
  parseCoord,
  parseLng,
};

'use strict';

const fs = require('fs');
const path = require('path');

let cached;

function loadPortPageOverrides() {
  if (cached) return cached;
  const file = path.join(__dirname, '..', '..', 'data', 'port-page-overrides.json');
  try {
    cached = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    cached = {};
  }
  return cached;
}

function applyPortPageOverrides(port, relatedPorts, relatedShips) {
  const overrides = loadPortPageOverrides();
  const entry = overrides[port && port.slug];
  if (!entry) {
    return {
      relatedPorts: [],
      relatedShips: [],
      hideCallingShips: true,
      hideRelatedPorts: true,
    };
  }
  const curatedPorts = Array.isArray(entry.relatedPorts) ? entry.relatedPorts : [];
  const curatedShips = Array.isArray(entry.callingShips) ? entry.callingShips : [];
  const hideCallingShips = entry.hideCallingShips === true || curatedShips.length === 0;
  return {
    relatedPorts: curatedPorts,
    relatedShips: hideCallingShips ? [] : curatedShips,
    hideCallingShips,
    hideRelatedPorts: curatedPorts.length === 0,
  };
}

module.exports = {
  applyPortPageOverrides,
  loadPortPageOverrides,
};

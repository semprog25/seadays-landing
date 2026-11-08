#!/usr/bin/env node
'use strict';

/**
 * Remove internal research source markers ([S1], [S2 gap], …) from passenger JSON fields only.
 *
 * Usage: node scripts/strip-public-port-guide-research-markers.js
 *        node scripts/strip-public-port-guide-research-markers.js --write
 */

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');
const REPORT_PATH = path.join(REPO, 'data', 'reports', 'port-guide-research-marker-strip-report.json');

const { stripWikiCitationMarkers } = require('./lib/portCopyHygiene');
const { listPassengerTextFields, containsResearchSourceMarker } = require('./lib/publicPortGuidePassengerTextFields');

const WRITE = process.argv.includes('--write');

function loadGuides() {
  return JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
}

function stripGuides(payload) {
  const by = payload.byAppPortId;
  if (!by || typeof by !== 'object') throw new Error('public-port-guides.json missing byAppPortId');
  const report = { ports: [], totalMarkers: 0, fieldsTouched: 0 };

  for (const [portId, guide] of Object.entries(by)) {
    for (const slot of listPassengerTextFields(guide)) {
      const before = slot.holder[slot.key];
      if (!containsResearchSourceMarker(before)) continue;
      const markers = before.match(/\[S\d+(?:\s+[^\]]*)?\]/gi) || [];
      const after = stripWikiCitationMarkers(before);
      if (after === before) continue;
      report.totalMarkers += markers.length;
      report.fieldsTouched += 1;
      report.ports.push({
        portId,
        field: slot.holder === guide.thingsToDo?.topThings ? `thingsToDo.topThings.${slot.key}` : inferFieldPath(guide, slot),
        markers,
        before,
        after,
      });
      if (WRITE) slot.holder[slot.key] = after;
    }
  }
  return report;
}

function inferFieldPath(guide, slot) {
  if (slot.holder === guide.portInfo) return `portInfo.${slot.key}`;
  if (slot.holder === guide.gettingThere) return `gettingThere.${slot.key}`;
  if (slot.holder === guide.thingsToDo) return `thingsToDo.${slot.key}`;
  if (slot.holder === guide.thingsToDo?.topThings) return `thingsToDo.topThings.${slot.key}`;
  return String(slot.key);
}

function main() {
  const payload = loadGuides();
  const report = stripGuides(payload);
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, `${JSON.stringify({ generatedAt: new Date().toISOString(), write: WRITE, ...report }, null, 2)}\n`, 'utf8');
  if (WRITE) {
    fs.writeFileSync(GUIDES_PATH, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  }
  console.log(
    `[strip-public-port-guide-research-markers] ports=${new Set(report.ports.map((p) => p.portId)).size} fields=${report.fieldsTouched} markers=${report.totalMarkers} write=${WRITE}`
  );
}

main();

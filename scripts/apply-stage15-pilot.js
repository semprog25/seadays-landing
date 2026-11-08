#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const { STAGE15_PILOT_GUIDES } = require('./lib/stage15PilotEditorial');
const { loadPublicPortGuidesFile, writePublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const { assertPassengerReadyGuideFields } = require('./lib/publicGuideCopySanitize');

function parseArgs(argv) {
  return { apply: argv.includes('--apply') };
}

function mergePilotGuide(existing, pilot) {
  const merged = {
    ...existing,
    portInfo: { ...(existing.portInfo || {}), ...(pilot.portInfo || {}) },
    gettingThere: { ...(existing.gettingThere || {}), ...(pilot.gettingThere || {}) },
    thingsToDo: { ...(existing.thingsToDo || {}), ...(pilot.thingsToDo || {}) },
    researchImport: { ...(existing.researchImport || {}), ...(pilot.researchImport || {}) },
  };
  if (pilot.shorePlansFirst != null) merged.shorePlansFirst = pilot.shorePlansFirst;
  return merged;
}

function main() {
  const { apply } = parseArgs(process.argv);
  const guides = loadPublicPortGuidesFile(REPO);
  const report = { ports: [], errors: [] };

  for (const [appPortId, pilot] of Object.entries(STAGE15_PILOT_GUIDES)) {
    const existing = guides.byAppPortId[appPortId];
    if (!existing) {
      report.errors.push({ appPortId, error: 'missing_existing_guide' });
      continue;
    }
    const merged = mergePilotGuide(existing, pilot);
    try {
      assertPassengerReadyGuideFields(merged, appPortId);
    } catch (err) {
      report.errors.push({ appPortId, error: err.message });
      continue;
    }
    report.ports.push({
      appPortId,
      landing_slug: pilot.researchImport?.landing_slug,
      fields: ['portInfo.description', 'gettingThere', 'thingsToDo', 'shorePlansFirst', 'researchImport'],
    });
    if (apply) guides.byAppPortId[appPortId] = merged;
  }

  if (report.errors.length) {
    console.error(JSON.stringify({ error: 'validation_failed', report }, null, 2));
    process.exit(2);
  }

  if (apply) {
    writePublicPortGuidesFile(REPO, guides);
  }

  console.log(JSON.stringify({ ok: true, apply, report }, null, 2));
}

main();

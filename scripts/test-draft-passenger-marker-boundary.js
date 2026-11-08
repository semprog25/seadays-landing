#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { synthesizePassengerDraft } = require('./lib/bulkPortPublication/passengerDraftSynthesize');
const { RESEARCH_SOURCE_MARKER_RE } = require('./lib/publicPortGuidePassengerTextFields');
const { sanitizePassengerDraftSurfaces } = require('./lib/bulkPortPublication/sanitizePassengerDraftSurfaces');

function assertNoSourceMarkers(draft) {
  const blob = JSON.stringify({
    portInfo: draft.portInfo,
    gettingThere: draft.gettingThere,
    thingsToDo: draft.thingsToDo,
  });
  assert.ok(!RESEARCH_SOURCE_MARKER_RE.test(blob), `draft still contains [S#] markers: ${blob.slice(0, 200)}`);
}

function main() {
  const factPack = {
    research_sha256: 'test-sha',
    overview_raw: 'Overview with authority cite [S1] and gap [S2 gap].',
    things_raw: {
      intro: 'Intro [S1].',
      shortCall: 'Short [S3].',
      standardCall: 'Standard.',
      longerCall: 'Long.',
      practicalTip: 'Tip [S1 gap].',
      topThings: ['Attraction one [S2]', 'Attraction two'],
    },
    things_section_bullets: [],
    attraction_names: [],
    terminal_notes: [{ name: 'Test Cruise Terminal' }],
    terminals_arrival: 'Arrival quay [S4].',
    getting_summary: 'Walking distance [S1].',
    getting_bullets: [],
    provenance: ['research_markdown'],
    unresolved: [],
  };

  const draft = synthesizePassengerDraft({
    landingSlug: 'test-port',
    appPortId: 'test-port',
    portName: 'Test Port',
    country: 'Test',
    factPack,
    existingGuide: {
      appPortId: 'test-port',
      portName: 'Test Port',
      thingsToDo: { topThings: [] },
      gettingThere: {},
    },
  });
  assertNoSourceMarkers(draft);

  const dirty = sanitizePassengerDraftSurfaces({
    portInfo: { description: 'Dirty line [S9].' },
    gettingThere: { fromTerminal: 'Terminal [S1 gap].' },
    thingsToDo: { practicalTip: 'Keep time [S2].', topThings: ['A [S3]', 'B'] },
  });
  assert.strictEqual(dirty.portInfo.description, 'Dirty line.');
  assertNoSourceMarkers(dirty);

  console.log('test-draft-passenger-marker-boundary PASS');
}

main();

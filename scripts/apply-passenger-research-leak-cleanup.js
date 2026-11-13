#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { preparePassengerGuideText, containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { listPassengerTextFields } = require('./lib/publicPortGuidePassengerTextFields');

const REPO = path.join(__dirname, '..');
const GUIDES_PATH = path.join(REPO, 'data', 'public-port-guides.json');

/** Passenger-safe rewrites before sentence-level sanitizer (keeps useful uncertainty). */
const GLOBAL_STRING_REPLACEMENTS = [
  [
    /Door GPS remain null;\s*confirm MICT building exit with the line\.?/gi,
    'Confirm the MICT terminal exit with your cruise line before heading into the city.',
  ],
  [
    /Door GPS remain null;\s*confirm berth assignment with your line on the daily programme\.?/gi,
    'Confirm berth assignment with your cruise line on the daily programme.',
  ],
  [
    /Door-threshold coordinates remain null\.?/gi,
    '',
  ],
  [
    /Door GPS not published as verified decimals on the captured page\.?/gi,
    '',
  ],
  [
    /Door GPS for the cruise\/yacht touristic berth was not published on the captured pages\.?/gi,
    '',
  ],
  [
    /Exact tender-pier coordinates are not published as WGS84 on the destination page — keep pins null\.?\s*Catalog flag:[^.]+\.?/gi,
    'The cruise line operates regular tender shuttles between the ship and the beach destination.',
  ],
  [
    /\(research notes the same harbour as gateway slug goa-india — owner policy governs passenger publication scope\)\.?/gi,
    '',
  ],
  [
    /\(archived when live mptgoa\.gov\.in TLS fails\)/gi,
    '(MbPA published facility details)',
  ],
  [
    / — reconcile with the \d+ m Visit Lofoten figure before import\.?/gi,
    '.',
  ],
  [
    /Live fetch of palmasport\.es failed TLS, so door GPS and named terminal building details remain null\.?/gi,
    'Confirm terminal building details with the port authority or your cruise line before you go ashore.',
  ],
  [
    /A dedicated passenger-terminal specification page was not captured \(deep URL 404\), so berth length\/depth and door GPS remain null\.?/gi,
    'Confirm berth and terminal details with the port operator or your cruise line.',
  ],
  [
    /Exact passenger-door coordinates and current tender-vs-dock rules by LOA remain null beyond the LOA statements\.?/gi,
    'Confirm whether your ship will dock or tender, and follow the gangway location given on your daily programme.',
  ],
  [
    /Door GPS remains null; MTS contact address text on the page references Safaga — not treated as the Hurghada street address\.?/gi,
    'Confirm the correct passenger terminal address with MTS or your cruise line.',
  ],
];

const BY_APP_PORT_ID = {
  antwerp: {
    description:
      'Port of Antwerp-Bruges manages the combined Antwerp and Bruges/Zeebrugge port system. Zeebrugge cruise arrivals are documented separately; this guide focuses on Antwerp city calls. Confirm your Scheldt berth and gangway with the port authority or your cruise line.',
  },
};

function scrubPassengerString(text) {
  let s = String(text || '');
  for (const [re, repl] of GLOBAL_STRING_REPLACEMENTS) {
    s = s.replace(re, repl);
  }
  return preparePassengerGuideText(s.replace(/\s+/g, ' ').trim());
}

function main() {
  const write = process.argv.includes('--write');
  const raw = JSON.parse(fs.readFileSync(GUIDES_PATH, 'utf8'));
  const guides = raw.byAppPortId;
  let fieldsChanged = 0;
  const touchedIds = new Set();

  for (const [id, guide] of Object.entries(guides)) {
    const override = BY_APP_PORT_ID[id];
    if (override) {
      for (const [key, value] of Object.entries(override)) {
        if (guide.portInfo && guide.portInfo[key] !== value) {
          guide.portInfo[key] = value;
          fieldsChanged += 1;
          touchedIds.add(id);
        }
      }
    }
    for (const { holder, key } of listPassengerTextFields(guide)) {
      const before = holder[key];
      if (typeof before !== 'string' || !before.trim()) continue;
      const after = scrubPassengerString(before);
      if (after !== before) {
        if (write) holder[key] = after;
        fieldsChanged += 1;
        touchedIds.add(id);
      }
    }
    const distanceAnswer = guide?.gettingThere?.distanceAnswer;
    if (typeof distanceAnswer === 'string' && distanceAnswer.trim()) {
      const after = scrubPassengerString(distanceAnswer);
      if (after !== distanceAnswer) {
        if (write) guide.gettingThere.distanceAnswer = after;
        fieldsChanged += 1;
        touchedIds.add(id);
      }
    }
  }

  const remaining = [];
  for (const [id, guide] of Object.entries(guides)) {
    for (const { holder, key } of listPassengerTextFields(guide)) {
      const value = holder[key];
      if (typeof value === 'string' && containsInternalResearchLeak(value)) {
        remaining.push({ id, field: key, sample: value.slice(0, 100) });
      }
    }
  }

  const report = {
    write,
    fieldsChanged,
    portIdsTouched: [...touchedIds].sort(),
    remainingJsonLeaks: remaining.length,
    remainingSamples: remaining.slice(0, 12),
  };
  console.log(JSON.stringify(report, null, 2));

  if (write && fieldsChanged) {
    fs.writeFileSync(GUIDES_PATH, `${JSON.stringify(raw, null, 2)}\n`);
  }

  if (remaining.length) process.exitCode = 1;
}

main();

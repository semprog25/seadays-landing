#!/usr/bin/env node
/**
 * Inject real AdSense client + CO₂ slot IDs into co2/index.html from adsenseConfig.
 * Idempotent — safe to re-run after config changes.
 *
 * Usage:
 *   node scripts/inject-co2-ad-slots.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  ADSENSE_CLIENT_ID,
  ADSENSE_CO2_SLOT,
  isCo2AdSenseConfigured,
} = require('./lib/adsenseConfig');

const co2Path = path.join(__dirname, '..', 'co2', 'index.html');

function injectCo2AdSlots(html) {
  if (!isCo2AdSenseConfigured()) {
    throw new Error(
      'CO₂ AdSense is not configured. Set SEADAYS_ADSENSE_CLIENT_ID and SEADAYS_ADSENSE_CO2_SLOT.'
    );
  }

  let next = html;

  next = next.replace(
    /data-ad-client="(?:ca-pub-XXXXXXXXXX|ca-pub-\d+)"/g,
    `data-ad-client="${ADSENSE_CLIENT_ID}"`
  );
  next = next.replace(
    /data-ad-slot="(?:XXXXXXXXXX|\d+)"/g,
    `data-ad-slot="${ADSENSE_CO2_SLOT}"`
  );

  const slotCount = (next.match(new RegExp(`data-ad-slot="${ADSENSE_CO2_SLOT}"`, 'g')) || []).length;
  if (slotCount !== 2) {
    throw new Error(`Expected 2 CO₂ ad slots after injection, found ${slotCount}.`);
  }

  return next;
}

function main() {
  const html = fs.readFileSync(co2Path, 'utf8');
  const updated = injectCo2AdSlots(html);

  if (updated === html) {
    console.log('co2/index.html already has configured AdSense IDs.');
    return;
  }

  fs.writeFileSync(co2Path, updated, 'utf8');
  console.log(`Updated co2/index.html with ${ADSENSE_CLIENT_ID} / slot ${ADSENSE_CO2_SLOT}.`);
}

main();

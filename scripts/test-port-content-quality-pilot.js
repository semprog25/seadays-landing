#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const {
  stripResearchNotVerifiedShorthand,
  preparePassengerGuideText,
} = require('./lib/publicGuideCopySanitize');
const {
  evaluatePushReleaseGuard,
  loadReleaseGuard,
} = require('./lib/ciGenerationReleaseGuard');

const REPO = path.join(__dirname, '..');
const PILOT_SLUGS = ['acapulco-mexico', 'wismar-germany', 'skagway-ak-united-states'];

function passengerProse(html) {
  const main = html.match(/<main[\s\S]*?<\/main>/i);
  const body = main ? main[0] : html;
  return body
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

function assertValidJsonLd(html, slug) {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi)) {
    JSON.parse(m[1]);
  }
}

function main() {
  assert.match(
    stripResearchNotVerifiedShorthand('Fuerte de San Diego — nearby framing — hours Not verified.'),
    /^Fuerte de San Diego — nearby framing/
  );
  assert.strictEqual(
    preparePassengerGuideText('Walk. Timed taxi fares Not verified. New pier opens in 2027.'),
    'Walk. New pier opens in 2027.'
  );
  assert.strictEqual(
    preparePassengerGuideText('Not verified until the gangway is known. UNESCO centre is compact once ashore.'),
    'UNESCO centre is compact once ashore.'
  );
  const shipConfirm =
    'Confirm local transport options with the ship on your call date.';
  assert.strictEqual(preparePassengerGuideText(shipConfirm), shipConfirm);
  const museumStrip = preparePassengerGuideText(
    'Royal BC Museum — adjacent harbour framing; hours Not verified.'
  );
  assert.ok(!/\bnot verified\b/i.test(museumStrip));
  assert.ok(!/\b(open daily|opens at \d|always available|guaranteed)\b/i.test(museumStrip));
  assert.ok(
    museumStrip.includes('Royal BC Museum'),
    'verified framing kept when unverified hours removed'
  );
  const airport = preparePassengerGuideText('Airport (TPA): Not verified.');
  assert.ok(!/\bnot verified\b/i.test(airport));
  assert.ok(!/\d+\s*km\b/i.test(airport), 'must not invent airport transfer distance');

  for (const slug of PILOT_SLUGS) {
    const file = path.join(REPO, 'ports', slug, 'index.html');
    assert.ok(fs.existsSync(file), `missing pilot page ${slug}`);
    const html = fs.readFileSync(file, 'utf8');
    const prose = passengerProse(html);
    assert.ok(!/\bnot verified\b/i.test(prose), `${slug} still has Not verified in prose`);
    assert.ok(!/\b(?:remain|stays?|keep)\s+null\b/i.test(prose), `${slug} has remain-null research copy`);
    assert.ok(/<link[^>]+rel="canonical"/i.test(html), `${slug} missing canonical`);
    assertValidJsonLd(html, slug);
  }

  const auditOut = execSync(
    `SEADAYS_AUDIT_PORT_SLUGS=${PILOT_SLUGS.join(',')} node scripts/audit-passenger-visible-research-shorthand.js`,
    { cwd: REPO, encoding: 'utf8' }
  );
  const audit = JSON.parse(auditOut);
  assert.strictEqual(audit.passengerVisibleNotVerified, 0);
  assert.strictEqual(audit.passengerVisibleRemainNull, 0);

  const guard = loadReleaseGuard(REPO);
  assert.strictEqual(guard.profile, 'port-content-quality-pilot-release');
  const exactPaths = guard.exactPaths.slice().sort();
  const verdict = evaluatePushReleaseGuard(exactPaths, { repoRoot: REPO });
  assert.strictEqual(verdict.action, 'suppress');

  console.log('test-port-content-quality-pilot PASS', { pilot: PILOT_SLUGS });
}

main();
#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { preparePassengerGuideText } = require('./lib/publicGuideCopySanitize');
const { stripWikiCitationMarkers } = require('./lib/portCopyHygiene');

function main() {
  assert.strictEqual(
    stripWikiCitationMarkers('Authority note [S1].'),
    'Authority note.',
    'stripWikiCitationMarkers removes [S1]'
  );
  assert.strictEqual(
    stripWikiCitationMarkers('Tender timing [S1 gap].'),
    'Tender timing.',
    'stripWikiCitationMarkers removes [S1 gap]'
  );
  assert.strictEqual(
    stripWikiCitationMarkers('See [section 2] in the manual.'),
    'See [section 2] in the manual.',
    'non-research bracketed phrase preserved'
  );
  assert.ok(!/\[S\d+/i.test(preparePassengerGuideText('Tip body [S3].')));
  console.log('test-research-source-marker-strip PASS');
}

main();

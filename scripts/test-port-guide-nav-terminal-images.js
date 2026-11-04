#!/usr/bin/env node
'use strict';

const assert = require('assert');
const { PORT_GUIDE_STYLES, buildTerminalsSection } = require('./lib/portGuideSections');
const {
  terminalIdentityKey,
  resolveTerminalVerifiedImage,
} = require('./lib/terminalVerifiedImages');

assert.ok(!/\.port-jump\s*\{[^}]*position:\s*sticky/s.test(PORT_GUIDE_STYLES), 'port-jump must not be sticky');
assert.ok(/scroll-margin-top:\s*72px/.test(PORT_GUIDE_STYLES), 'pg-section anchor offset');

const hafenCity = {
  country_id: 'germany',
  slug: 'cruise-center-hafencity',
  name: 'Cruise Center HafenCity',
  terminal_type: 'both',
  address: 'Überseeboulevard 7',
  description: 'HafenCity terminal.',
  is_primary: true,
};
const altona = {
  country_id: 'germany',
  slug: 'cruise-center-altona',
  name: 'Cruise Center Altona',
  terminal_type: 'both',
  address: 'Van-der-Smissen-Straße 5',
  description: 'Altona terminal.',
};

assert.strictEqual(
  terminalIdentityKey(hafenCity, 'hamburg'),
  'germany/hamburg/cruise-center-hafencity'
);

const hafenImage = resolveTerminalVerifiedImage(hafenCity, 'hamburg');
assert.ok(hafenImage && hafenImage.url.includes('Cruise_Center_HafenCity'), 'HafenCity verified image');

const altonaImage = resolveTerminalVerifiedImage(altona, 'hamburg');
assert.strictEqual(altonaImage, null, 'Altona must not inherit HafenCity photo');

const gridHtml = buildTerminalsSection([hafenCity, altona], {
  portAppId: 'hamburg',
  logistics: 'Logistics.',
});
assert.ok(gridHtml.includes('pg-terminal-card-photo'), 'photo on verified terminal only');
const photoCount = (gridHtml.match(/pg-terminal-card-photo/g) || []).length;
assert.strictEqual(photoCount, 1, 'exactly one terminal photo');
const hafenBlock = gridHtml.match(
  /<details class="pg-terminal-card pg-terminal-card--has-photo"[\s\S]*?<\/details>/
);
assert.ok(hafenBlock, 'photo card markup');
const block = hafenBlock[0];
const badgeIdx = block.indexOf('pg-terminal-card-badge-row');
const photoIdx = block.indexOf('pg-terminal-card-photo');
const titleIdx = block.indexOf('pg-terminal-card-title');
assert.ok(badgeIdx >= 0 && photoIdx > badgeIdx && titleIdx > photoIdx, 'badge → photo → title order');
assert.ok(!/position:\s*sticky/.test(PORT_GUIDE_STYLES), 'port-jump not sticky');

console.log('test-port-guide-nav-terminal-images: OK');

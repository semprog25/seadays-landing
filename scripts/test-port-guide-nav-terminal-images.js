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
const steinwerder = {
  country_id: 'germany',
  slug: 'cruise-center-steinwerder',
  name: 'Cruise Center Steinwerder',
  terminal_type: 'both',
  address: 'Buchheisterstraße 16',
  description: 'Steinwerder terminal.',
};
const baakenhoeft = {
  country_id: 'germany',
  slug: 'baakenhoeft',
  name: 'Baakenhöft',
  terminal_type: 'both',
  address: 'Baakenhöft 1',
  description: 'Baakenhöft berth.',
};

assert.strictEqual(
  terminalIdentityKey(hafenCity, 'hamburg'),
  'germany/hamburg/cruise-center-hafencity'
);

const hafenImage = resolveTerminalVerifiedImage(hafenCity, 'hamburg');
assert.ok(hafenImage && hafenImage.url.includes('Cruise_Center_HafenCity'), 'HafenCity verified image');

const altonaImage = resolveTerminalVerifiedImage(altona, 'hamburg');
assert.ok(altonaImage && altonaImage.url.includes('Cruise_Center_Altona'), 'Altona verified image');
assert.ok(!altonaImage.url.includes('HafenCity'), 'Altona must not use HafenCity asset');

const steinwerderImage = resolveTerminalVerifiedImage(steinwerder, 'hamburg');
assert.ok(
  steinwerderImage && steinwerderImage.url.includes('Steinwerder_12'),
  'Steinwerder verified image'
);

const baakenhoeftImage = resolveTerminalVerifiedImage(baakenhoeft, 'hamburg');
assert.ok(
  baakenhoeftImage && baakenhoeftImage.url.includes('Baakenh'),
  'Baakenhöft verified image'
);

const urls = new Set([
  hafenImage.url,
  altonaImage.url,
  steinwerderImage.url,
  baakenhoeftImage.url,
]);
assert.strictEqual(urls.size, 4, 'each Hamburg terminal photo must use a distinct Commons URL');

const gridHtml = buildTerminalsSection([hafenCity, altona], {
  portAppId: 'hamburg',
  logistics: 'Logistics.',
});
assert.ok(gridHtml.includes('pg-terminal-card-photo'), 'photo on verified terminal only');
const photoCount = (gridHtml.match(/pg-terminal-card-photo/g) || []).length;
assert.strictEqual(photoCount, 2, 'two terminal photos in partial grid');
const hafenBlock = gridHtml.match(
  /<article class="pg-terminal-card pg-terminal-card--has-photo"[\s\S]*?<\/article>/
);
assert.ok(hafenBlock, 'photo card markup');
const block = hafenBlock[0];
const badgeIdx = block.indexOf('pg-terminal-card-badge-row');
const photoIdx = block.indexOf('pg-terminal-card-photo');
const titleIdx = block.indexOf('pg-terminal-card-title');
assert.ok(badgeIdx >= 0 && photoIdx > badgeIdx && titleIdx > photoIdx, 'badge → photo → title order');
assert.ok(!/position:\s*sticky/.test(PORT_GUIDE_STYLES), 'port-jump not sticky');

const allTerminalsHtml = buildTerminalsSection([hafenCity, altona, steinwerder, baakenhoeft], {
  portAppId: 'hamburg',
  logistics: 'Logistics.',
});
const allPhotoCount = (allTerminalsHtml.match(/pg-terminal-card--has-photo/g) || []).length;
assert.strictEqual(allPhotoCount, 4, 'all four Hamburg terminals have verified photos');

console.log('test-port-guide-nav-terminal-images: OK');

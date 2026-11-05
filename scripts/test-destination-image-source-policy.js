#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const {
  isApprovedDestinationPhotographyUrl,
  isAllowedRegionCountrySourceUrl,
  isCommerciallyReusableCommonsLicense,
  isWikimediaCommonsUrl,
  isAllowedOwnerDestinationSourceBasename,
  DESTINATION_POLICY_NOTE,
} = require('./lib/destinationImageSourcePolicy');
const {
  loadVerifiedPortDestinationUrlBySlug,
  loadVerifiedShipHeroUrlBySlug,
  resetPortsDirectoryImageCachesForTests,
} = require('./lib/portsDirectoryImageResolve');
const { assessPortDirectoryThumbnail, resetDirectoryThumbnailQualityCachesForTests } = require('./lib/directoryThumbnailQuality');
const { resolveVerifiedCatalogPreviewHero, resolveVerifiedCatalogPreviewPortInfrastructure } = require('./lib/catalogImage/resolveVerifiedCatalogPreview');

const repoRoot = path.join(__dirname, '..');

assert(isApprovedDestinationPhotographyUrl('https://images.pexels.com/photos/123/pexels-photo-123.jpeg'));
assert(isApprovedDestinationPhotographyUrl('https://images.unsplash.com/photo-1'));
assert(!isApprovedDestinationPhotographyUrl('/assets/img/ports-directory/seadays-no-image.webp'));
assert(!isApprovedDestinationPhotographyUrl('/assets/img/ports-directory/ui/back-to-regions-card-owner.webp'));
assert(isApprovedDestinationPhotographyUrl('/assets/img/ports-directory/ports/foo.webp'));
assert(!isApprovedDestinationPhotographyUrl('https://upload.wikimedia.org/wikipedia/commons/a/a1/Example.jpg'));
assert(isAllowedRegionCountrySourceUrl('https://upload.wikimedia.org/wikipedia/commons/a/a1/Example.jpg'));
assert(isCommerciallyReusableCommonsLicense('CC BY-SA 4.0'));
assert(isCommerciallyReusableCommonsLicense('CC0'));
assert(!isCommerciallyReusableCommonsLicense('CC BY-NC 4.0'));
assert(!isCommerciallyReusableCommonsLicense('CC BY-ND 4.0'));
assert(!isAllowedOwnerDestinationSourceBasename('commons-harbor.jpg'));
assert(isAllowedOwnerDestinationSourceBasename('pexels-jane-12857738.jpg'));

const wm = 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/1a/x.jpg/800px-x.jpg';
const thumb = assessPortDirectoryThumbnail(wm, { slug: 'test-port' }, repoRoot);
assert.strictEqual(thumb.ok, false);
assert(thumb.reason.includes('wikimedia') || thumb.reason.includes('policy'));

resetPortsDirectoryImageCachesForTests();
resetDirectoryThumbnailQualityCachesForTests();
const destMap = loadVerifiedPortDestinationUrlBySlug(repoRoot);
for (const url of Object.values(destMap)) {
  assert(!isWikimediaCommonsUrl(url), `verified destination map must not expose Wikimedia: ${url.slice(0, 80)}`);
}

const shipMap = loadVerifiedShipHeroUrlBySlug(repoRoot);
const shipUrls = Object.values(shipMap);
assert(shipUrls.length > 0, 'ship Wikimedia heroes should still resolve for directory');
assert(shipUrls.some((u) => isWikimediaCommonsUrl(u)), 'ships remain Wikimedia-sourced');

const barcelonaInfra = resolveVerifiedCatalogPreviewPortInfrastructure('barcelona', { previewEnabled: true });
const barcelonaHero = resolveVerifiedCatalogPreviewHero('port', 'barcelona', { previewEnabled: true });
if (barcelonaInfra && barcelonaInfra.displayUrl) {
  assert(isWikimediaCommonsUrl(barcelonaInfra.displayUrl), 'terminal infra preview may use Wikimedia');
}
if (barcelonaHero) {
  assert(!isWikimediaCommonsUrl(barcelonaHero.displayUrl), 'port destination catalog preview must not use Wikimedia');
}

const html = fs.readFileSync(path.join(repoRoot, 'ports/index.html'), 'utf8');
assert(!html.includes('upload.wikimedia.org'), 'ports directory index must not embed Wikimedia destination URLs');
const photoTiles = (html.match(/directory-card--with-photo/g) || []).length;

assert(DESTINATION_POLICY_NOTE.includes('Pexels'), 'policy note documented');
assert(DESTINATION_POLICY_NOTE.includes('Wikimedia Commons for region and country'), 'commons region/country fallback documented');
assert(isAllowedOwnerDestinationSourceBasename('destination-exterior-batch02-r3-pixabay-12345.webp'), 'pixabay local basename');

console.log('OK test-destination-image-source-policy', {
  verifiedDestinationSlugs: Object.keys(destMap).length,
  shipHeroSlugs: shipUrls.length,
  directoryPhotoTiles: photoTiles,
});

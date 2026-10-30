'use strict';

/** Disabled by default. Verified fixture preview — no production KV / Edge calls. */
function isVerifiedCatalogPreviewEnabled() {
  const flag = process.env.SEADAYS_VERIFIED_CATALOG_PREVIEW;
  return String(flag || '').trim().toLowerCase() === 'true';
}

function shouldSkipVerifiedCatalogPreviewForEntityImage(entityImage) {
  return Boolean(entityImage && String(entityImage).trim());
}

module.exports = {
  isVerifiedCatalogPreviewEnabled,
  shouldSkipVerifiedCatalogPreviewForEntityImage,
};

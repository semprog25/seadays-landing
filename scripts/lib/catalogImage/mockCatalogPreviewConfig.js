'use strict';

/** Disabled by default. MOCK / TEST ONLY — no production KV reads or writes. */
function isMockCatalogPreviewEnabled() {
  const flag = process.env.SEADAYS_MOCK_CATALOG_PREVIEW;
  return String(flag || '').trim().toLowerCase() === 'true';
}

function shouldSkipMockCatalogPreviewForEntityImage(entityImage) {
  return Boolean(entityImage && String(entityImage).trim());
}

module.exports = {
  isMockCatalogPreviewEnabled,
  shouldSkipMockCatalogPreviewForEntityImage,
};

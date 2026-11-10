'use strict';

/**
 * Port slugs that share a canonical destination page.
 * Aliases stay on disk as noindex redirects; they are omitted from the browse grid.
 * Keep aligned with PORT_ALIAS_REDIRECTS in portSeoRedirects.js.
 */

const DIRECTORY_ALIAS_TO_CANONICAL = {
  'chennai-port-india': 'chennai-india',
  'cochin-india': 'kochi-india',
  'cochin-port-india': 'kochi-india',
  'mumbai-port-india': 'mumbai-india',
  'vizag-india': 'visakhapatnam-india',
  'doha-port-qatar': 'doha-qatar',
};

/** Redirect-only dataset slugs (not in DIRECTORY_ALIAS_TO_CANONICAL). */
const PORT_SEO_REDIRECT_ALIASES = {
  'doha-cruise-terminal-qatar': 'doha-qatar',
  'port-of-aqaba-jordan': 'aqaba-jordan',
  'port-of-ashdod-israel': 'ashdod-israel',
  'port-of-haifa-israel': 'haifa-israel',
  'dubai-cruise-terminal-united-arab-emirates': 'dubai-united-arab-emirates',
  'port-zayed-abu-dhabi-united-arab-emirates': 'abu-dhabi-united-arab-emirates',
  'port-sultan-qaboos-muscat-oman': 'muscat-oman',
  'jeddah-islamic-port-saudi-arabia': 'jeddah-saudi-arabia',
  'mina-salman-manama-bahrain': 'manama-bahrain',
  'goa-india': 'mormugao-port-goa-india',
  'gran-canaria-spain': 'las-palmas-spain',
  'rostock-germany': 'warnemunde-berlin-germany',
  'rugen-germany': 'sassnitz-mukran-germany',
  'glasgow-united-kingdom': 'greenock-united-kingdom',
  'nordkapp-norway': 'honningsvag-norway',
};

function buildPortAliasRedirectMap() {
  return { ...DIRECTORY_ALIAS_TO_CANONICAL, ...PORT_SEO_REDIRECT_ALIASES };
}

function buildBrowseHiddenAliasMap() {
  return buildPortAliasRedirectMap();
}

module.exports = {
  DIRECTORY_ALIAS_TO_CANONICAL,
  PORT_SEO_REDIRECT_ALIASES,
  buildPortAliasRedirectMap,
  buildBrowseHiddenAliasMap,
};

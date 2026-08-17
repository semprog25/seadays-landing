'use strict';

/**
 * Same-origin favicon tags for GitHub Pages.
 * Cross-origin storage PNGs are ignored by Safari; /favicon.ico must live on seadays.app.
 */
function getFaviconHeadHtml() {
  return `  <link rel="icon" href="/favicon.ico" sizes="any">
  <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192.png">
  <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">`;
}

module.exports = { getFaviconHeadHtml };

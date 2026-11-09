#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { rewriteHtml } = require('./rewrite-download-ctas');
const { mergePublishedPortHtmlPreservation } = require('./lib/publishedPortHtmlPreserve');

const ROOT = path.join(__dirname, '..');
const details = [
  'ports/mumbai-india/index.html',
  'ports/adelaide-australia/index.html',
  'ports/hamburg-germany/index.html',
  'ships/celebrity-solstice/index.html',
];
const SECTION_RE = /<section class="seadays-contextual-cta"[^>]*>[\s\S]*?<\/section>/g;
const OLD_RE = /<p class="seo-inline-more seadays-contextual-cta"/g;

function verify(rel, html) {
  const rewritten = rewriteHtml(html, rel);
  const mainEnd = rewritten.indexOf('</main>');
  const ctaStart = rewritten.indexOf('<section class="seadays-contextual-cta"');
  assert.ok(mainEnd !== -1 && ctaStart !== -1 && ctaStart < mainEnd, `${rel}: CTA must be inside main`);
  assert.equal((rewritten.match(SECTION_RE) || []).length, 1, `${rel}: exactly one CTA`);
  assert.equal((rewritten.match(OLD_RE) || []).length, 0, `${rel}: no legacy CTA`);
  assert.match(rewritten.slice(ctaStart, mainEnd), /href="\/download\/\?utm_source=seadays_web&amp;utm_medium=(?:port_guide|ship_guide)/);
  assert.equal(rewriteHtml(rewritten, rel), rewritten, `${rel}: idempotent rewrite`);

  // Regeneration against the currently published HTML must never restore the orphan.
  const merged = mergePublishedPortHtmlPreservation(rewritten, html, {});
  const finalHtml = rewriteHtml(merged, rel);
  assert.equal((finalHtml.match(SECTION_RE) || []).length, 1, `${rel}: regenerated CTA count`);
  assert.ok(finalHtml.indexOf('<section class="seadays-contextual-cta"') < finalHtml.indexOf('</main>'), `${rel}: regenerated CTA remains inside main`);
  assert.equal((finalHtml.match(OLD_RE) || []).length, 0, `${rel}: regen must not restore legacy markup`);
}

for (const rel of details) {
  const html = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  assert.match(html, /<\/main>/, `${rel}: expected page structure`);
  verify(rel, html);
}

// A redirect-only page with no <main> must not acquire an orphan CTA.
const redirect = '<html><body><script>location.replace("/ports/other/")</script></body></html>';
assert.equal(rewriteHtml(redirect, 'ports/goa-india/index.html'), redirect);

// A fresh generated page without prior CTA still gains exactly one inside main.
verify('ports/example/index.html', '<html><main><h1>Example</h1></main><!-- seadays-site-shell:footer --></html>');

console.log('test-contextual-cta-layout PASS (read-only, 4 representative pages + fixtures)');

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  mergePublishedPortHtmlPreservation,
  dedupePortDetailHeadJsonLd,
  extractRobotsContent,
  extractBookableExperiencesSection,
} = require('./lib/publishedPortHtmlPreserve');

const root = path.join(__dirname, '..');

const OLD_BOOK =
  '<section class="pg-section pg-booking" id="bookable-experiences"><a href="https://www.viator.com/searchResults/all?text=Halifax&amp;campaign=seadays-web-phalifax">Browse</a></section>';
const NEW_APP =
  '<section class="pg-section pg-booking" id="bookable-experiences"><a href="/download/">Continue in SeaDays →</a></section>';
const NEW_VIATOR =
  '<section class="pg-section pg-booking" id="bookable-experiences"><a href="https://www.viator.com/searchResults/all?text=Halifax&amp;campaign=seadays-web-phalifax-new">Browse</a></section>';

function head(robots) {
  return `<!DOCTYPE html><html><head><meta name="robots" content="${robots}"></head><body>`;
}

function wrap(bookable) {
  return `${head('index, follow')}${bookable}</body></html>`;
}

assert.strictEqual(
  extractRobotsContent(
    mergePublishedPortHtmlPreservation(
      wrap(NEW_APP),
      wrap(OLD_BOOK).replace('index, follow', 'noindex, follow'),
      { affiliate: { url: null } }
    )
  ),
  'noindex, follow',
  'blocks noindex→index'
);

assert.ok(
  mergePublishedPortHtmlPreservation(wrap(NEW_APP), wrap(OLD_BOOK), { affiliate: { url: null } }).includes(
    'seadays-web-phalifax'
  ),
  'preserves viator when config missing'
);

assert.ok(
  mergePublishedPortHtmlPreservation(wrap(NEW_VIATOR), wrap(OLD_BOOK), {
    affiliate: { url: 'https://www.viator.com/x' },
  }).includes('seadays-web-phalifax-new'),
  'CI affiliate url keeps fresh generated block'
);

assert.strictEqual(
  mergePublishedPortHtmlPreservation(wrap(NEW_APP), '', { affiliate: { url: null } }),
  wrap(NEW_APP),
  'missing existing html'
);

const headWithTripleNewlineInStyle = `<!DOCTYPE html><html><head>
  <script type="application/ld+json">{"@type":"TouristDestination","name":"X"}</script>
  <script type="application/ld+json">{"@type":"TouristDestination","name":"Y"}</script>
  <link rel="stylesheet" href="/assets/css/site-shell.css">
  <style>
* { margin: 0; }


.seo-detail { color: #fff; }
</style>
</head><body></body></html>`;
const dedupedHead = dedupePortDetailHeadJsonLd(headWithTripleNewlineInStyle);
assert.ok(
  dedupedHead.includes('\n\n\n.seo-detail'),
  'JSON-LD dedupe must not collapse newlines inside inline style blocks'
);

const { patchPortGuideTerminalCss } = require('./patch-port-guide-pr57-published');

const halifaxPath = path.join(root, 'ports', 'halifax-ns-canada', 'index.html');
const halifaxHtml = fs.readFileSync(halifaxPath, 'utf8');
const once = patchPortGuideTerminalCss(halifaxHtml);
const twice = patchPortGuideTerminalCss(once);
assert.strictEqual(once, twice, 'terminal css patch idempotent');

const committedFaqBody = `${head('noindex, follow')}<section class="pg-section" id="traveler-questions"><h2>Traveler questions</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Committed long transport answer with Rejseplanen and DSB detail.</p></article></div></section>${OLD_BOOK}</body></html>`;
const generatedFaqBody = `${head('noindex, follow')}<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Transport?","acceptedAnswer":{"@type":"Answer","text":"Short regenerated."}}]}</script><section class="pg-section" id="traveler-questions"><h2>Traveler questions</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Short regenerated.</p></article></div></section>${NEW_VIATOR}</body></html>`;
const mergedFaq = mergePublishedPortHtmlPreservation(generatedFaqBody, committedFaqBody, {
  affiliate: { url: 'https://www.viator.com/x' },
});
assert.ok(
  mergedFaq.includes('Rejseplanen and DSB'),
  'keeps committed traveler FAQ when merge preserves section (no refreshPreservedPortAnswers drift)',
);
assert.ok(
  !mergedFaq.includes('<p>Short regenerated.</p>'),
  'does not replace preserved traveler FAQ cards with regenerated copy',
);
assert.ok(
  mergedFaq.includes('Rejseplanen and DSB'),
  'preserves committed FAQ JSON-LD when traveler block is kept',
);
assert.ok(mergedFaq.includes('seadays-web-phalifax-new'), 'banner-only merge still applies generated bookable');

const ldShort =
  '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Transport?","acceptedAnswer":{"@type":"Answer","text":"Short old."}}]}';
const ldLong =
  '{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Transport?","acceptedAnswer":{"@type":"Answer","text":"Intentionally updated long transport answer from regen with Rejseplanen detail."}}]}';
const committedShortFaq = `${head('noindex, follow')}<script type="application/ld+json">${ldShort}</script><section class="pg-section" id="traveler-questions"><h2>T</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Short old.</p></article></div></section>${OLD_BOOK}</body></html>`;
const generatedLongFaq = `${head('noindex, follow')}<script type="application/ld+json">${ldLong}</script><section class="pg-section" id="traveler-questions"><h2>T</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Intentionally updated long transport answer from regen with Rejseplanen detail.</p></article></div></section>${NEW_VIATOR}</body></html>`;
const mergedIntentionalFaq = mergePublishedPortHtmlPreservation(generatedLongFaq, committedShortFaq, {
  affiliate: { url: 'https://www.viator.com/x' },
});
assert.ok(
  mergedIntentionalFaq.includes('Intentionally updated long transport answer'),
  'intentional FAQ regen updates visible traveler cards',
);
assert.ok(
  mergedIntentionalFaq.includes('Rejseplanen detail'),
  'intentional FAQ regen updates FAQPage JSON-LD',
);
assert.ok(mergedIntentionalFaq.includes('seadays-web-phalifax-new'), 'bookable banner still refreshes');

console.log('test-published-port-html-preserve: OK');

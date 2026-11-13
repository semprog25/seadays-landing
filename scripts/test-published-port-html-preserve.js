'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  mergePublishedPortHtmlPreservation,
  dedupePortDetailHeadJsonLd,
  extractRobotsContent,
  extractBookableExperiencesSection,
  extractJsonLdScriptTagByType,
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

/** Same opts shape as generateBlogs → mergePublishedPortHtmlPreservation (CI port detail write path). */
function mergeLikePortDetailWrite(generatedHtml, existingHtml, opts = {}) {
  return mergePublishedPortHtmlPreservation(generatedHtml, existingHtml, {
    affiliate: { url: 'https://www.viator.com/x' },
    ...opts,
  });
}

function faqPageJsonLd(html) {
  const tag = extractJsonLdScriptTagByType(html, 'FAQPage');
  if (!tag) return null;
  const inner = tag.replace(/^[\s\S]*?>/, '').replace(/<\/script>[\s\S]*$/, '');
  return JSON.parse(inner);
}

function faqBody(robots, ldMainEntity, cardsHtml, bookable) {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: ldMainEntity,
  });
  return `${head(robots)}<script type="application/ld+json">${ld}</script><section class="pg-section" id="traveler-questions"><h2>Traveler questions</h2><div class="pg-qa-grid">${cardsHtml}</div></section>${bookable}</body></html>`;
}

function faqCard(question, answer) {
  return `<article class="pg-qa-card"><h3>${question}</h3><p>${answer}</p></article>`;
}

const BOOKABLE_RE =
  /<section class="pg-section pg-booking" id="bookable-experiences"[\s\S]*?<\/section>/i;

function stripBookable(html) {
  return String(html).replace(BOOKABLE_RE, '<!--BOOKABLE-->');
}

assert.strictEqual(
  extractRobotsContent(
    mergePublishedPortHtmlPreservation(
      wrap(NEW_APP),
      wrap(OLD_BOOK).replace('index, follow', 'noindex, follow'),
      { affiliate: { url: null } },
    ),
  ),
  'noindex, follow',
  'blocks noindex→index',
);

assert.ok(
  mergePublishedPortHtmlPreservation(wrap(NEW_APP), wrap(OLD_BOOK), { affiliate: { url: null } }).includes(
    'seadays-web-phalifax',
  ),
  'preserves viator when config missing',
);

assert.ok(
  mergePublishedPortHtmlPreservation(wrap(NEW_VIATOR), wrap(OLD_BOOK), {
    affiliate: { url: 'https://www.viator.com/x' },
  }).includes('seadays-web-phalifax-new'),
  'CI affiliate url keeps fresh generated block',
);

assert.strictEqual(
  mergePublishedPortHtmlPreservation(wrap(NEW_APP), '', { affiliate: { url: null } }),
  wrap(NEW_APP),
  'missing existing html',
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
  'JSON-LD dedupe must not collapse newlines inside inline style blocks',
);

const { patchPortGuideTerminalCss } = require('./patch-port-guide-pr57-published');

const halifaxPath = path.join(root, 'ports', 'halifax-ns-canada', 'index.html');
const halifaxHtml = fs.readFileSync(halifaxPath, 'utf8');
const once = patchPortGuideTerminalCss(halifaxHtml);
const twice = patchPortGuideTerminalCss(once);
assert.strictEqual(once, twice, 'terminal css patch idempotent');

const committedFaqBody = `${head('noindex, follow')}<section class="pg-section" id="traveler-questions"><h2>Traveler questions</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Committed long transport answer with Rejseplanen and DSB detail.</p></article></div></section>${OLD_BOOK}</body></html>`;
const generatedFaqBody = `${head('noindex, follow')}<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[{"@type":"Question","name":"Transport?","acceptedAnswer":{"@type":"Answer","text":"Short regenerated."}}]}</script><section class="pg-section" id="traveler-questions"><h2>Traveler questions</h2><div class="pg-qa-grid"><article class="pg-qa-card"><h3>Transport?</h3><p>Short regenerated.</p></article></div></section>${NEW_VIATOR}</body></html>`;
const mergedFaq = mergeLikePortDetailWrite(generatedFaqBody, committedFaqBody, {
  bannerOnlyFaqPreserve: true,
});
assert.ok(
  mergedFaq.includes('Rejseplanen and DSB'),
  'banner-only: keeps committed traveler FAQ when regen would clip',
);
assert.ok(!mergedFaq.includes('<p>Short regenerated.</p>'), 'banner-only: rejects clipped regen cards');
assert.ok(mergedFaq.includes('seadays-web-phalifax-new'), 'banner-only: bookable still refreshes');

const committedShortFaq = faqBody(
  'noindex, follow',
  [
    {
      '@type': 'Question',
      name: 'Transport?',
      acceptedAnswer: { '@type': 'Answer', text: 'Short old.' },
    },
  ],
  faqCard('Transport?', 'Short old.'),
  OLD_BOOK,
);
const generatedLongFaq = faqBody(
  'noindex, follow',
  [
    {
      '@type': 'Question',
      name: 'Transport?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Intentionally updated long transport answer from regen with Rejseplanen detail.',
      },
    },
  ],
  faqCard('Transport?', 'Intentionally updated long transport answer from regen with Rejseplanen detail.'),
  NEW_VIATOR,
);
const mergedLong = mergeLikePortDetailWrite(generatedLongFaq, committedShortFaq, { bannerOnlyFaqPreserve: false });
assert.ok(mergedLong.includes('Intentionally updated long transport answer'), 'normal regen: longer FAQ in cards');
assert.ok(faqPageJsonLd(mergedLong).mainEntity[0].acceptedAnswer.text.includes('Rejseplanen detail'), 'normal regen: longer FAQ in JSON-LD');
assert.ok(mergedLong.includes('seadays-web-phalifax-new'), 'normal regen: banner updates');

const committedVerbose = faqBody(
  'noindex, follow',
  [
    {
      '@type': 'Question',
      name: 'Transport?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Verbose wrong committed transport copy that should be shortened.',
      },
    },
  ],
  faqCard('Transport?', 'Verbose wrong committed transport copy that should be shortened.'),
  OLD_BOOK,
);
const generatedShortCorrect = faqBody(
  'noindex, follow',
  [{ '@type': 'Question', name: 'Transport?', acceptedAnswer: { '@type': 'Answer', text: 'Concise corrected transport.' } }],
  faqCard('Transport?', 'Concise corrected transport.'),
  NEW_VIATOR,
);
const mergedShortFix = mergeLikePortDetailWrite(generatedShortCorrect, committedVerbose, {
  bannerOnlyFaqPreserve: false,
});
assert.ok(mergedShortFix.includes('Concise corrected transport.'), 'normal regen: shorter correction in cards');
assert.strictEqual(
  faqPageJsonLd(mergedShortFix).mainEntity[0].acceptedAnswer.text,
  'Concise corrected transport.',
  'normal regen: shorter correction in FAQPage JSON-LD',
);

const committedTwoQ = faqBody(
  'noindex, follow',
  [
    {
      '@type': 'Question',
      name: 'Transport?',
      acceptedAnswer: { '@type': 'Answer', text: 'Long committed transport detail with Rejseplanen.' },
    },
    { '@type': 'Question', name: 'Distance?', acceptedAnswer: { '@type': 'Answer', text: 'Extra question to drop.' } },
  ],
  faqCard('Transport?', 'Long committed transport detail with Rejseplanen.') +
    faqCard('Distance?', 'Extra question to drop.'),
  OLD_BOOK,
);
const generatedClipAndDrop = faqBody(
  'noindex, follow',
  [
    {
      '@type': 'Question',
      name: 'Transport?',
      acceptedAnswer: { '@type': 'Answer', text: 'Walking only.' },
    },
  ],
  faqCard('Transport?', 'Walking only.'),
  NEW_VIATOR,
);
const mergedRemoval = mergeLikePortDetailWrite(generatedClipAndDrop, committedTwoQ, {
  bannerOnlyFaqPreserve: false,
});
const removalLd = faqPageJsonLd(mergedRemoval);
assert.strictEqual(removalLd.mainEntity.length, 1, 'normal regen: removed question drops from JSON-LD');
assert.ok(removalLd.mainEntity[0].acceptedAnswer.text.includes('Walking'), 'normal regen: applies clipped transport answer');
assert.ok(!mergedRemoval.includes('Extra question to drop'), 'normal regen: removed question drops from cards');

const bannerClipKeep = mergeLikePortDetailWrite(generatedClipAndDrop, committedTwoQ, {
  bannerOnlyFaqPreserve: true,
});
assert.ok(bannerClipKeep.includes('Extra question to drop'), 'banner-only: keeps committed block when another answer clipped');
assert.ok(bannerClipKeep.includes('Long committed transport detail'), 'banner-only: keeps long transport when regen clips');
assert.strictEqual(stripBookable(bannerClipKeep), stripBookable(committedTwoQ), 'banner-only: byte-identical outside bookable');
assert.ok(bannerClipKeep.includes('seadays-web-phalifax-new'), 'banner-only: new banner survives');

const aalborgPath = path.join(root, 'ports', 'aalborg-denmark', 'index.html');
const aalborgBase = fs.readFileSync(aalborgPath, 'utf8');
const aalborgGenBook = aalborgBase.replace(
  BOOKABLE_RE,
  '<section class="pg-section pg-booking" id="bookable-experiences"><a href="https://www.viator.com/banner-fixture">NEW BANNER</a></section>',
);
const aalborgMerged = mergeLikePortDetailWrite(aalborgGenBook, aalborgBase, { bannerOnlyFaqPreserve: true });
assert.ok(aalborgMerged.includes('NEW BANNER'), 'aalborg fixture: banner survives');
assert.strictEqual(stripBookable(aalborgMerged), stripBookable(aalborgBase), 'aalborg fixture: outside bookable identical');

const tamperedBase = aalborgBase.replace('Limfjord city', 'Limfjord city TAMPER');
assert.notStrictEqual(stripBookable(tamperedBase), stripBookable(aalborgBase), 'guard: non-banner tamper detected');

console.log('test-published-port-html-preserve: OK');

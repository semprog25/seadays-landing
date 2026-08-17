#!/usr/bin/env node
'use strict';

/**
 * Phase 1 technical SEO unit tests (no network).
 * Run: node scripts/test-seo-phase1.js
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { buildShipAggregateRatingJsonLd, buildShipBreadcrumbJsonLd } = require('./lib/seoShipPortPages');
const {
  formatIsoDate,
  buildArticleAuthorJsonLd,
  articleAuthorDisplayName,
  extractArticleLastmodFromHtml,
  publicStaticSitemapUrls,
  buildSitemapXml,
} = require('./generateBlogs');

function main() {
  assert.strictEqual(
    buildShipAggregateRatingJsonLd({ rating: null, reviewCount: 0 }),
    null,
    'omits aggregateRating when rating/count are missing'
  );
  assert.strictEqual(
    buildShipAggregateRatingJsonLd({ rating: 4.5, reviewCount: 0 }),
    null,
    'omits aggregateRating when reviewCount is not positive'
  );
  assert.strictEqual(
    buildShipAggregateRatingJsonLd({ rating: 0, reviewCount: 12 }),
    null,
    'omits aggregateRating when rating is not positive'
  );
  assert.strictEqual(
    buildShipAggregateRatingJsonLd({}),
    null,
    'omits aggregateRating with empty ship data'
  );
  const genuine = buildShipAggregateRatingJsonLd({ rating: 4.2, reviewCount: 17 });
  assert.ok(genuine, 'emits aggregateRating for genuine reviews');
  assert.strictEqual(genuine['@type'], 'AggregateRating');
  assert.strictEqual(genuine.ratingValue, 4.2);
  assert.strictEqual(genuine.reviewCount, 17);
  assert.ok(!JSON.stringify(genuine).includes('100') || genuine.reviewCount !== 100);

  const crumbs = buildShipBreadcrumbJsonLd(
    { name: 'Celebrity Solstice' },
    'https://seadays.app/ships/celebrity-solstice/'
  );
  assert.strictEqual(crumbs['@type'], 'BreadcrumbList');
  assert.strictEqual(crumbs.itemListElement.length, 3);
  assert.strictEqual(crumbs.itemListElement[1].item, 'https://seadays.app/ships/');

  assert.deepStrictEqual(buildArticleAuthorJsonLd({ author: 'Seadays' }), {
    '@type': 'Organization',
    name: 'SeaDays',
  });
  assert.deepStrictEqual(buildArticleAuthorJsonLd({ author: '' }), {
    '@type': 'Organization',
    name: 'SeaDays',
  });
  assert.deepStrictEqual(buildArticleAuthorJsonLd({ author: 'Jane Rivera' }), {
    '@type': 'Person',
    name: 'Jane Rivera',
  });
  assert.strictEqual(articleAuthorDisplayName({ author: 'Seadays' }), 'SeaDays');
  assert.strictEqual(articleAuthorDisplayName({ author: 'Jane Rivera' }), 'Jane Rivera');

  assert.strictEqual(formatIsoDate('2026-05-06'), '2026-05-06');
  assert.strictEqual(formatIsoDate('2026-05-06T12:00:00.000Z'), '2026-05-06');
  assert.strictEqual(formatIsoDate(Date.UTC(2026, 3, 19)), '2026-04-19');
  assert.strictEqual(formatIsoDate(null), '');
  assert.strictEqual(formatIsoDate(''), '');

  const html = `<script type="application/ld+json">{"@type":"Article","datePublished":"2026-04-19","dateModified":"2026-04-21"}</script>`;
  assert.strictEqual(extractArticleLastmodFromHtml(html), '2026-04-21');
  assert.strictEqual(extractArticleLastmodFromHtml('<p>no json</p>'), '');

  const repoRoot = path.join(__dirname, '..');
  const staticUrls = publicStaticSitemapUrls(repoRoot).map((u) => u.loc);
  for (const loc of [
    'https://seadays.app/about.html',
    'https://seadays.app/faq.html',
    'https://seadays.app/help.html',
    'https://seadays.app/contact.html',
    'https://seadays.app/privacy.html',
    'https://seadays.app/terms.html',
    'https://seadays.app/cookies.html',
    'https://seadays.app/gdpr.html',
    'https://seadays.app/press/',
  ]) {
    assert.ok(staticUrls.includes(loc), `sitemap static pages include ${loc}`);
  }
  assert.ok(!staticUrls.includes('https://seadays.app/privacy'));
  assert.ok(!staticUrls.includes('https://seadays.app/blog'));
  assert.ok(!staticUrls.includes('https://seadays.app/seo-admin.html'));
  assert.ok(!staticUrls.includes('https://seadays.app/blog.html'));
  assert.ok(!staticUrls.includes('https://seadays.app/blog-article.html'));

  const { xml, count } = buildSitemapXml(repoRoot, { articles: [], seoShips: [], seoPorts: [] });
  assert.ok(count > 0, 'sitemap has URLs');
  assert.ok(xml.includes('<urlset'));
  assert.ok(xml.includes('https://seadays.app/privacy.html'));
  assert.ok(xml.includes('https://seadays.app/blog/'));
  assert.ok(!xml.includes('https://seadays.app/privacy</loc>'));
  assert.ok(!xml.includes('hreflang'));

  const drinkArticle = path.join(
    repoRoot,
    'blog',
    'the-seadays-drink-package-calculator-math-that-tells-you-when-to-skip-the-package-entirely',
    'index.html'
  );
  if (fs.existsSync(drinkArticle)) {
    const articleHtml = fs.readFileSync(drinkArticle, 'utf8');
    const lastmod = extractArticleLastmodFromHtml(articleHtml);
    assert.ok(/^\d{4}-\d{2}-\d{2}$/.test(lastmod), 'article lastmod is a calendar date');
  }

  console.log('test-seo-phase1: ok');
}

main();

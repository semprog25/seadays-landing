#!/usr/bin/env node
'use strict';

const assert = require('assert');
const path = require('path');
const {
  resolveBlogIndexCardFields,
  buildIndexArticleCardHtml,
} = require('./generateBlogs');

const repoRoot = path.join(__dirname, '..');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

const overrideSlug = '12-cruise-ship-secrets-the-crew-wont-tell-you-but-you-should-know';

test('override meta wins for index card title and excerpt', () => {
  const article = {
    slug: overrideSlug,
    title: 'Legacy CMS title for cruise secrets',
    excerpt: 'Legacy CMS excerpt that should not appear on the card.',
    content: '<p>Fallback content slice should not be used when override description exists.</p>',
  };
  const { cardTitle, cardExcerpt } = resolveBlogIndexCardFields(article, repoRoot);
  assert.strictEqual(cardTitle, 'Passenger tips that show up every cruise week');
  assert.ok(cardExcerpt.includes('Passenger checklist'));
  assert.ok(!cardExcerpt.includes('Legacy CMS'));
});

test('CMS fields used when slug has no override meta', () => {
  const article = {
    slug: 'synthetic-slug-with-no-meta-json-entry-xyz',
    title: 'CMS headline only',
    excerpt: 'CMS card blurb only',
    content: '<p>Should not slice content when excerpt is set.</p>',
  };
  const { cardTitle, cardExcerpt } = resolveBlogIndexCardFields(article, repoRoot);
  assert.strictEqual(cardTitle, 'CMS headline only');
  assert.strictEqual(cardExcerpt, 'CMS card blurb only');
});

test('index card href uses slug only', () => {
  const article = {
    slug: overrideSlug,
    title: 'Legacy CMS title for cruise secrets',
    excerpt: 'x',
  };
  const html = buildIndexArticleCardHtml(
    article,
    { url: 'https://example.com/img.jpg', source: 'test', type: 'image/jpeg' },
    false,
    repoRoot,
  );
  const expectedHref = `href="https://seadays.app/blog/${overrideSlug}/"`;
  assert.ok(html.includes(expectedHref), `expected ${expectedHref} in card HTML`);
  assert.ok(!html.includes('Legacy CMS title for cruise secrets'));
});

test('index card HTML escapes title and excerpt', () => {
  const article = {
    slug: 'synthetic-escape-test-slug',
    title: 'Tom & Jerry <script>',
    excerpt: 'Quote "double" & ampersand',
    content: '',
  };
  const html = buildIndexArticleCardHtml(
    article,
    { url: 'https://example.com/img.jpg', source: 'test', type: 'image/jpeg' },
    false,
    repoRoot,
  );
  assert.ok(html.includes('Tom &amp; Jerry &lt;script&gt;'));
  assert.ok(html.includes('Quote &quot;double&quot; &amp; ampersand'));
  assert.ok(html.includes('alt="Tom &amp; Jerry &lt;script&gt;"'));
});

console.log('blog-index-card-overrides tests passed');

#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  isGenericBrandAuthor,
  buildArticleAuthorJsonLd,
  articleAuthorDisplayName,
  articleAuthorBylineLabel,
  articleAuthorBylineHtml,
  fixArticleJsonLdObject,
  ORGANIZATION_ID,
  getPublisherJsonLd,
  loadSiteAuthor,
} = require('./lib/publicationSchema');
const fs = require('fs');
const path = require('path');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('generic brand authors normalize to Organization @id', () => {
  for (const name of ['SeaDays', 'Seadays', 'SeaStories', 'Portside', 'Anonymous', '']) {
    const author = buildArticleAuthorJsonLd({ author: name }, null);
    assert.strictEqual(author['@type'], 'Organization');
    assert.strictEqual(author['@id'], ORGANIZATION_ID);
    assert.strictEqual(author.name, 'SeaDays');
    assert.match(author.url, /^https:\/\/seadays\.app\//);
    assert.match(articleAuthorBylineLabel({ author: name }, null), /^Published by SeaDays$/);
  }
});

test('real person authors stay Person', () => {
  const author = buildArticleAuthorJsonLd({ author: 'sharanestone' }, null);
  assert.strictEqual(author['@type'], 'Person');
  assert.strictEqual(author.name, 'sharanestone');
  assert.strictEqual(articleAuthorBylineLabel({ author: 'sharanestone' }, null), 'By sharanestone');
});

test('fixArticleJsonLdObject links publisher and mainEntityOfPage', () => {
  const canonical = 'https://seadays.app/blog/example/';
  const fixed = fixArticleJsonLdObject(
    {
      '@type': 'Article',
      headline: 'Example',
      author: { '@type': 'Person', name: 'SeaStories' },
      publisher: { '@type': 'Organization', name: 'SeaDays', logo: { '@type': 'ImageObject', url: 'https://seadays.app/logo.png' } },
      mainEntityOfPage: canonical,
    },
    canonical,
    null
  );
  assert.deepStrictEqual(fixed.author, {
    '@type': 'Organization',
    '@id': ORGANIZATION_ID,
    name: 'SeaDays',
    url: 'https://seadays.app/',
  });
  assert.deepStrictEqual(fixed.publisher, getPublisherJsonLd());
  assert.deepStrictEqual(fixed.mainEntityOfPage, { '@type': 'WebPage', '@id': canonical });
});

const SITE = { name: 'Jane Example', url: '/about.html', absoluteUrl: 'https://seadays.app/about.html' };

test('a configured site author is used for every article', () => {
  for (const name of ['SeaDays', 'sharanestone', 'Someone Else', '']) {
    assert.deepStrictEqual(buildArticleAuthorJsonLd({ author: name }, SITE), {
      '@type': 'Person',
      name: 'Jane Example',
      url: 'https://seadays.app/about.html',
    });
    assert.strictEqual(articleAuthorBylineLabel({ author: name }, SITE), 'By Jane Example');
    assert.strictEqual(articleAuthorBylineHtml({ author: name }, SITE), 'By <a href="/about.html" rel="author">Jane Example</a>');
  }
  const fixed = fixArticleJsonLdObject({ '@type': 'Article', author: { '@type': 'Person', name: 'sharanestone' } }, '', SITE);
  assert.strictEqual(fixed.author.name, 'Jane Example');
});

test('every committed post carries the same configured byline', () => {
  const site = loadSiteAuthor();
  const root = path.join(__dirname, '..');
  const bylines = new Set();
  const authors = new Set();
  for (const slug of fs.readdirSync(path.join(root, 'blog'))) {
    const file = path.join(root, 'blog', slug, 'index.html');
    if (!fs.existsSync(file)) continue;
    const html = fs.readFileSync(file, 'utf8');
    const m = html.match(/<div class="article-meta">\s*<span class="author">((?:<a [^>]*>[^<]*<\/a>|[^<])*)<\/span>/);
    if (!m) continue;
    bylines.add(m[1]);
    for (const a of html.matchAll(/"@type":"Article"[\s\S]*?"author":(\{[^}]*\})/g)) authors.add(a[1]);
  }
  assert.strictEqual(bylines.size, 1, `expected one byline, saw ${[...bylines].join(' | ')}`);
  assert.strictEqual(authors.size, 1, `expected one JSON-LD author, saw ${[...authors].join(' | ')}`);
  if (site) assert.ok([...bylines][0].includes(site.name), 'byline does not match data/editorial-author.json');
});

console.log('All publication metadata tests passed.');

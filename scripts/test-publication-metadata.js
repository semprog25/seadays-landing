#!/usr/bin/env node
'use strict';

const assert = require('assert');
const {
  isGenericBrandAuthor,
  buildArticleAuthorJsonLd,
  articleAuthorDisplayName,
  articleAuthorBylineLabel,
  fixArticleJsonLdObject,
  ORGANIZATION_ID,
  getPublisherJsonLd,
} = require('./lib/publicationSchema');

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

test('generic brand authors normalize to Organization @id', () => {
  for (const name of ['SeaDays', 'Seadays', 'SeaStories', 'Portside', 'Anonymous', '']) {
    const author = buildArticleAuthorJsonLd({ author: name });
    assert.strictEqual(author['@type'], 'Organization');
    assert.strictEqual(author['@id'], ORGANIZATION_ID);
    assert.strictEqual(author.name, 'SeaDays');
    assert.match(author.url, /^https:\/\/seadays\.app\//);
    assert.match(articleAuthorBylineLabel({ author: name }), /^Published by SeaDays$/);
  }
});

test('real person authors stay Person', () => {
  const author = buildArticleAuthorJsonLd({ author: 'sharanestone' });
  assert.strictEqual(author['@type'], 'Person');
  assert.strictEqual(author.name, 'sharanestone');
  assert.strictEqual(articleAuthorBylineLabel({ author: 'sharanestone' }), 'By sharanestone');
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
    canonical
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

console.log('All publication metadata tests passed.');

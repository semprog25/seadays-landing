#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  resolveArticleModifiedIso,
  resolveArticlePublicationDates,
} = require('./generateBlogs');

const repoRoot = path.join(__dirname, '..');

function loadOverrideMeta() {
  const file = path.join(repoRoot, 'data', 'blog-body-overrides', 'meta.json');
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function test(name, fn) {
  fn();
  console.log('PASS', name);
}

function ogModifiedTime(modifiedIso) {
  return modifiedIso
    ? `<meta property="article:modified_time" content="${modifiedIso}">`
    : '';
}

function jsonLdDateModified(publishedIso, modifiedIso) {
  return modifiedIso || publishedIso || undefined;
}

test('A: valid editorial dateModified used for OG and JSON-LD contract', () => {
  const slug = 'the-real-cost-of-cruise-drink-packages-is-it-worth-it';
  const overrideMeta = loadOverrideMeta()[slug] || {};
  const article = {
    slug,
    publishedAt: '2026-04-01',
    updatedAt: '2026-10-22',
  };
  const { publishedIso, modifiedIso } = resolveArticlePublicationDates(article, overrideMeta);
  assert.strictEqual(modifiedIso, '2026-10-28');
  assert.ok(ogModifiedTime(modifiedIso).includes('2026-10-28'));
  assert.strictEqual(jsonLdDateModified(publishedIso, modifiedIso), '2026-10-28');
});

test('B: no override dateModified preserves CMS updatedAt fallback', () => {
  const article = {
    slug: 'synthetic-no-override-date-slug',
    publishedAt: '2026-04-01',
    updatedAt: '2026-10-22',
    timestamp: '2026-09-01',
  };
  const modifiedIso = resolveArticleModifiedIso(article, {});
  assert.strictEqual(modifiedIso, '2026-10-22');
});

test('C: invalid override dateModified falls back to CMS timestamps', () => {
  const article = {
    slug: 'synthetic-invalid-date-slug',
    publishedAt: '2026-04-01',
    updatedAt: '2026-10-22',
  };
  const modifiedIso = resolveArticleModifiedIso(article, { dateModified: 'not-a-real-date' });
  assert.strictEqual(modifiedIso, '2026-10-22');
  assert.strictEqual(formatMalformedGuard(modifiedIso), true);
});

function formatMalformedGuard(iso) {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso);
}

test('D: datePublished unchanged when editorial modified date is set', () => {
  const article = {
    slug: 'synthetic-published-vs-modified',
    publishedAt: '2026-03-15',
    updatedAt: '2026-10-22',
  };
  const { publishedIso, modifiedIso } = resolveArticlePublicationDates(article, {
    dateModified: '2026-10-28',
  });
  assert.strictEqual(publishedIso, '2026-03-15');
  assert.strictEqual(modifiedIso, '2026-10-28');
  assert.notStrictEqual(publishedIso, modifiedIso);
});

test('E: scheduled-style CMS refresh does not replace editorial modified date', () => {
  const article = {
    slug: 'the-best-cruise-ship-cabins-and-which-ones-to-avoid',
    publishedAt: '2026-04-10',
    updatedAt: '2026-10-22',
  };
  const overrideMeta = loadOverrideMeta()[article.slug] || {};
  const modifiedIso = resolveArticleModifiedIso(article, overrideMeta);
  assert.strictEqual(modifiedIso, '2026-10-21');
  assert.notStrictEqual(modifiedIso, '2026-10-22');
});

console.log('blog-datemodified-override tests passed');

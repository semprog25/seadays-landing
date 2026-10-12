#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { blogStoreUrls, downloadPageStoreUrls, loadAppleProviderToken } = require('./lib/storeLinks');
const { applyBlogStoreCtasToHtml, buildBlogStoreCtaHtml } = require('./lib/blogStoreCta');

const slug = 'why-cruise-ship-cabins-sometimes-feel-small';
const intro = blogStoreUrls(slug, 'intro');
const end = blogStoreUrls(slug, 'end');

assert.strictEqual(loadAppleProviderToken(), '');
assert.ok(!intro.apple.includes('pt='));
assert.ok(!end.apple.includes('pt='));
assert.ok(!intro.apple.includes('mt='));
assert.ok(intro.apple.includes('ct=blog_' + slug));
assert.ok(intro.apple.includes('utm_source=seadays_blog'));
assert.ok(intro.apple.includes('utm_medium=blog_cta'));
assert.ok(intro.apple.includes('utm_campaign=' + slug));
assert.ok(intro.apple.includes('utm_content=intro'));
assert.ok(end.apple.includes('utm_content=end'));
assert.ok(end.apple.includes('ct=blog_' + slug));
assert.ok(intro.play.startsWith('https://play.google.com/store/apps/details?id=com.seadays.app'));
assert.ok(intro.play.includes('utm_source=seadays_blog'));
assert.ok(intro.play.includes('utm_medium=blog_cta'));
assert.ok(intro.play.includes('utm_campaign=' + slug));
assert.ok(intro.play.includes('utm_content=intro'));
assert.ok(intro.play.includes('referrer='));
assert.ok(decodeURIComponent(new URL(intro.play).searchParams.get('referrer')).includes('utm_content=intro'));
assert.ok(decodeURIComponent(new URL(end.play).searchParams.get('referrer')).includes('utm_content=end'));

const download = downloadPageStoreUrls();
assert.ok(download.play.includes('utm_source=seadays_web'));
assert.ok(download.play.includes('utm_medium=download_page'));
assert.ok(download.play.includes('utm_campaign=download'));
assert.ok(decodeURIComponent(new URL(download.play).searchParams.get('referrer')).includes('utm_medium=download_page'));
assert.ok(download.apple.includes('ct=download_page'));
assert.ok(download.apple.includes('utm_campaign=download'));
assert.ok(!download.apple.includes('pt='));
assert.ok(!download.apple.includes('mt='));

const image = '<img src="https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/blog-images/example.jpg" alt="Cabin photo" loading="lazy">';
const ad = '<aside class="seadays-ad-slot" data-ad-placement="article-mid" aria-label="Advertisement"><ins class="adsbygoogle"></ins></aside>';
const page =
  '<html><head></head><body><article><div class="article-body"><h2>Intro</h2><p>First paragraph stays.</p><p>Second paragraph.</p>' +
  ad +
  '<h2>Later</h2><p>More copy.</p></div>\n        <section class="explore-seadays"></section></article></body></html>';

const once = applyBlogStoreCtasToHtml(page, slug);
const twice = applyBlogStoreCtasToHtml(once, slug);
assert.strictEqual(twice, once);
assert.strictEqual((once.match(/data-seadays-blog-cta="intro"/g) || []).length, 1);
assert.strictEqual((once.match(/data-seadays-blog-cta="end"/g) || []).length, 1);
assert.ok(once.includes(image) === false);
assert.ok(once.includes('First paragraph stays.'));
assert.ok(once.includes('alt="Cabin photo"') === false);
const introAt = once.indexOf('data-seadays-blog-cta="intro"');
const secondP = once.indexOf('Second paragraph.');
const adAt = once.indexOf('seadays-ad-slot');
assert.ok(introAt > once.indexOf('First paragraph stays.'));
assert.ok(introAt < secondP);
assert.ok(introAt < adAt);
const adSlots = once.match(/<aside\b[^>]*\bseadays-ad-slot\b[^>]*>[\s\S]*?<\/aside>/gi) || [];
assert.strictEqual(adSlots.length, 1);
assert.ok(adSlots.every((slot) => !slot.includes('get-seadays-cta')));
assert.ok(once.indexOf('data-seadays-blog-cta="end"') > once.indexOf('</div>'));
assert.ok(once.includes('loading="lazy"'));
assert.ok(once.includes('alt="Download SeaDays on the App Store"'));
assert.ok(once.includes('alt="Get SeaDays on Google Play"'));
assert.ok(once.includes('data-seadays-fixed-store="1"'));

const withImage =
  '<div class="article-body"><p>Lead.</p>' + image + '</div><section class="same-topic-section"></section>';
const wrapped = `<html><body><article>${withImage}</article></body></html>`;
const withCta = applyBlogStoreCtasToHtml(wrapped, slug);
assert.ok(withCta.includes(image));
assert.strictEqual((withCta.match(/example\.jpg/g) || []).length, 1);

const cta = buildBlogStoreCtaHtml(slug, 'intro');
assert.ok(!cta.includes('seadays-ad-slot'));
assert.ok(!cta.includes('adsbygoogle'));

const root = path.join(__dirname, '..');
const samplePath = path.join(root, 'blog', slug, 'index.html');
if (fs.existsSync(samplePath)) {
  const live = fs.readFileSync(samplePath, 'utf8');
  if (live.includes('data-seadays-blog-cta="intro"')) {
    assert.ok(live.includes('utm_campaign=' + slug));
    assert.ok(live.includes('utm_content=intro'));
    assert.ok(live.includes('utm_content=end'));
    assert.ok(live.includes(image.split('src="')[0]) || live.includes('article-hero-image') || live.includes('<img'));
  }
}

const downloadHtml = fs.readFileSync(path.join(root, 'download/index.html'), 'utf8');
assert.ok(downloadHtml.includes(download.play.replace(/&/g, '&amp;')));
assert.ok(downloadHtml.includes(download.apple.replace(/&/g, '&amp;')));

console.log('test-blog-store-cta: PASS');

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { buildDestinationCardMediaHtml } = require('./lib/destinationDirectoryCard');

const root = path.join(__dirname, '..');

function assertCopenhagenUnchanged() {
  const indexHtml = fs.readFileSync(path.join(root, 'ports/index.html'), 'utf8');
  const cph = indexHtml.match(
    /copenhagen-denmark\/[^>]+data-directory-focal="50% 44%"/,
  );
  assert(cph, 'Copenhagen directory focal metadata unchanged');
  assert(
    indexHtml.includes('style="object-position:50% 44%;"') ||
      indexHtml.match(/copenhagen-denmark[\s\S]{0,800}object-position:50% 44%/),
    'Copenhagen directory object-position applied from focal metadata',
  );
}

function main() {
  const media = buildDestinationCardMediaHtml({
    imgUrl:
      '/assets/img/ports-directory/ports/stockholm-sweden/destination-exterior-batch01r-pexels-37499978.webp',
    alt: 'Stockholm, Sweden',
    objectPosition: { x: 50, y: 28 },
  });
  assert(media.html.includes('data-directory-focal="50% 28%"'), 'Stockholm data-directory-focal');
  assert(media.html.includes('style="object-position:50% 28%;"'), 'Stockholm inline object-position');

  const guide = fs.readFileSync(path.join(root, 'ports/stockholm-sweden/index.html'), 'utf8');
  assert(
    guide.includes('--seo-hero-focal: 58% 32%'),
    'Stockholm hero focal 58% 32%',
  );
  assert(guide.includes('Margo Evardson'), 'Stockholm attribution preserved');
  assert(
    guide.includes('destination-exterior-batch01r-pexels-37499978.webp'),
    'Stockholm hero URL unchanged',
  );

  const stockholmCard = fs.readFileSync(path.join(root, 'ports/index.html'), 'utf8');
  assert(
    stockholmCard.includes('stockholm-sweden') &&
      stockholmCard.match(/stockholm-sweden[\s\S]{0,600}50% 28%/),
    'Stockholm directory card focal 50% 28%',
  );

  const neutral = buildDestinationCardMediaHtml({
    imgUrl:
      '/assets/img/ports-directory/ports/miami-fl-united-states/destination-exterior-batch01-pexels-378570.webp',
    alt: 'Miami',
    objectPosition: null,
  });
  assert(!neutral.html.includes('object-position'), 'No focal → no object-position style');

  assertCopenhagenUnchanged();

  console.log('OK test-stockholm-crop-focal');
}

main();

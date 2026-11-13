#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { loadVerifiedShipHeroUrlBySlug } = require('./lib/portsDirectoryImageResolve');

const repoRoot = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(repoRoot, 'ships/index.html'), 'utf8');
const verified = loadVerifiedShipHeroUrlBySlug(repoRoot);
const manifestCount = Object.keys(verified).length;
const catalogMatch = html.match(
  /<script type="application\/json" id="shipsDirectoryCatalog">([\s\S]*?)<\/script>/
);
if (!catalogMatch) throw new Error('missing shipsDirectoryCatalog');
const catalog = JSON.parse(catalogMatch[1]);
const catalogPhotoCount = catalog.filter((s) => s.imgUrl && String(s.imgUrl).trim()).length;
const htmlPhotoCards = (html.match(/data-verified-photo="1"/g) || []).length;
const htmlWithImg = (html.match(/<img class="directory-card-image/g) || []).length;
if (htmlWithImg !== htmlPhotoCards) {
  throw new Error(`static html photo mismatch verified=${htmlPhotoCards} imgTags=${htmlWithImg}`);
}
if (catalogPhotoCount < 1) {
  throw new Error('catalog should include ships with directory photos');
}
if (!html.includes('.directory-card--with-photo { display: flex')) {
  throw new Error('ships index missing photo-card CSS (padding:0 / flex column)');
}
console.log(
  `[ships-photos] manifest=${manifestCount} catalogPhotos=${catalogPhotoCount} staticHtmlImgs=${htmlWithImg} css=ok`
);
console.log('test-ships-directory-photos: ok');

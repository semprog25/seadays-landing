#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');
const pexels = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/ports-directory-region-images-pexels.json'), 'utf8')
);
const provided = JSON.parse(
  fs.readFileSync(path.join(repoRoot, 'data/ports-directory-region-images-provided.json'), 'utf8')
);

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

const regions = pexels.regions || {};
const ids = new Map();
for (const [key, entry] of Object.entries(regions)) {
  assert(entry.pexelsPhotoId, `${key} missing pexelsPhotoId`);
  assert(entry.imageUrl && entry.imageUrl.includes(String(entry.pexelsPhotoId)), `${key} url/id mismatch`);
  const prev = ids.get(entry.pexelsPhotoId);
  if (prev && prev !== key) {
    assert(
      ['Northern Europe', 'Fjords', 'South America', 'Arctic'].includes(key) &&
        ['Northern Europe', 'Fjords', 'South America', 'Arctic'].includes(prev),
      `duplicate pexels id ${entry.pexelsPhotoId} on ${prev} and ${key}`
    );
  }
  ids.set(entry.pexelsPhotoId, key);
}

assert(!provided.regions.Mediterranean?.localSourceFile?.includes('25014337'), 'alpine Mediterranean override removed');
assert(
  regions.Mediterranean?.pexelsPhotoId === 29418689 ||
    String(provided.regions.Mediterranean?.imageUrl || '').includes('29418689'),
  'Mediterranean uses owner coastal clement pexels'
);
assert(regions.Atlantic.pexelsPhotoId !== regions.Caribbean.pexelsPhotoId, 'Atlantic ≠ Caribbean photo');
assert(
  regions['Atlantic Islands'].pexelsPhotoId !== regions.Mediterranean.pexelsPhotoId,
  'Atlantic Islands ≠ Mediterranean photo'
);

const alaskaProvided = provided.regions.Alaska;
assert(alaskaProvided, 'Alaska owner-provided entry missing');
assert(
  alaskaProvided.imageUrl.includes('alaska-owner-alaska.webp'),
  'Alaska must use owner Alaska.jpg derivative not northern-lights pexels'
);
assert(
  !alaskaProvided.imageUrl.includes('1933320'),
  'Alaska must not use pexels northern lights fallback in provided manifest'
);
assert(alaskaProvided.localSourceFile === 'Alaska.jpg', 'Alaska localSourceFile');

const portsHtml = fs.readFileSync(path.join(repoRoot, 'ports/index.html'), 'utf8');
assert(
  portsHtml.includes('alaska-owner-alaska.webp'),
  'ports index Alaska card must load owner webp'
);
assert(
  !portsHtml.includes('Northern lights over snowy mountains'),
  'ports index must not use northern lights alt on Alaska card'
);

console.log('OK test-region-image-identity');

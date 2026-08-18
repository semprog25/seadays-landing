#!/usr/bin/env node
'use strict';

/**
 * Deterministic image-pipeline regression tests (no network for unit assertions
 * except optional live HEAD checks gated by SEADAYS_IMAGE_LIVE_HEAD=1).
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const https = require('https');

const {
  isSignedStorageUrl,
  classifyImageUrl,
  validateImageUrl,
  resolveImageUrl,
  replaceSignedStorageImgSrcInHtml,
  getFallbackImage,
} = require('./generateBlogs');

const { isUsableArticleImage } = (() => {
  const mod = require('./lib/seoShipPortPages');
  return { isUsableArticleImage: mod.isUsableArticleImage };
})();

const SIGNED_SAMPLE =
  'https://soqkgrfzluewpuiguypm.supabase.co/storage/v1/object/sign/make-51d3ca8d-note-images/example/path.jpg?token=test';
const PUBLIC_SAMPLE =
  'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png';

function headOk(url) {
  return new Promise((resolve) => {
    try {
      const req = https.request(url, { method: 'HEAD', timeout: 8000 }, (res) => {
        resolve(res.statusCode === 200);
        res.resume();
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
      req.end();
    } catch {
      resolve(false);
    }
  });
}

function countSigned(html) {
  return (String(html || '').match(/https:\/\/[^"'\\\s]+\/storage\/v1\/object\/sign\//gi) || []).length;
}

async function main() {
  assert.strictEqual(isSignedStorageUrl(SIGNED_SAMPLE), true, 'detects signed');
  assert.strictEqual(classifyImageUrl(SIGNED_SAMPLE), null, 'signed classified unusable');
  assert.strictEqual(validateImageUrl(SIGNED_SAMPLE), null, 'signed does not validate');
  assert.strictEqual(isUsableArticleImage(SIGNED_SAMPLE), false, 'related cards reject signed');

  assert.strictEqual(classifyImageUrl(PUBLIC_SAMPLE), 'supabase', 'C public classified');
  assert.ok(validateImageUrl(PUBLIC_SAMPLE), 'C public validates');

  const stripped = replaceSignedStorageImgSrcInHtml(
    `<img src="${SIGNED_SAMPLE}" alt="x"><img src="${PUBLIC_SAMPLE}" alt="y">`
  );
  assert.ok(!/\/object\/sign\//.test(stripped), 'strip removes signed');
  assert.ok(stripped.includes(PUBLIC_SAMPLE), 'public preserved in strip');
  assert.ok(stripped.includes(getFallbackImage(0)) || /Websitehomebucket|seadaysfav/.test(stripped), 'fallback used');

  const deadSigned =
    'https://soqkgrfzluewpuiguypm.supabase.co/storage/v1/object/sign/make-51d3ca8d-note-images/does-not-exist/missing.jpg?token=dead';
  const stableNull = await resolveImageUrl(deadSigned, 'test-article', 0, {});
  assert.strictEqual(stableNull, null, 'unreachable signed resolves to null, never kept');

  if (String(process.env.SEADAYS_IMAGE_LIVE_HEAD || '').trim() === '1') {
    let liveSigned = process.env.SEADAYS_TEST_SIGNED_URL || '';
    if (liveSigned) {
      const kept = await resolveImageUrl(liveSigned, 'live-test', 0, {});
      if (kept) {
        assert.ok(!isSignedStorageUrl(kept), 'live resolve never returns signed');
        assert.ok(/\/object\/public\//.test(kept) || /seadays\.app\//.test(kept), 'live result is public');
      }
    }
  }

  const root = path.join(__dirname, '..');
  const portsIndex = fs.readFileSync(path.join(root, 'ports/index.html'), 'utf8');
  const shipsIndex = fs.readFileSync(path.join(root, 'ships/index.html'), 'utf8');
  assert.strictEqual(countSigned(portsIndex), 0, 'ports index signed = 0');
  assert.strictEqual(countSigned(shipsIndex), 0, 'ships index signed = 0');

  const marketingOrFav =
    /Websitehomebucket\/Cruise%20planner\.jpg|Websitehomebucket\/Discover%20Ships%20%20Ports\.jpg|SeadaysPublic\/seadaysfav\.png/i;
  for (const [label, html] of [
    ['ports', portsIndex],
    ['ships', shipsIndex],
  ]) {
    const badPrimary = [...html.matchAll(/<a class="guide-card"[^>]*>[\s\S]*?<img\b([^>]*)>/gi)].filter((m) => {
      const attrs = m[1] || '';
      const src = (attrs.match(/\bsrc="([^"]+)"/i) || [])[1] || '';
      const type = (attrs.match(/data-img-type="([^"]+)"/i) || [])[1] || '';
      return type === 'fallback' || marketingOrFav.test(src);
    });
    assert.strictEqual(badPrimary.length, 0, `${label} featured guide cards must not use marketing/favicon placeholders`);
  }

  console.log('test-image-pipeline PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

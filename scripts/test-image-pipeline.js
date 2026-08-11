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
  // Re-implement the exported policy from seoShipPortPages without pulling the whole SEO builder.
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

async function main() {
  // A/D — classify + validate accept signed CMS URLs
  assert.strictEqual(isSignedStorageUrl(SIGNED_SAMPLE), true, 'detects signed');
  assert.strictEqual(classifyImageUrl(SIGNED_SAMPLE), 'supabase', 'A/D signed classified supabase');
  assert.ok(validateImageUrl(SIGNED_SAMPLE), 'A/D signed validates');
  assert.ok(isUsableArticleImage(SIGNED_SAMPLE), 'G related card allows signed');

  // C — public stable preserved
  assert.strictEqual(classifyImageUrl(PUBLIC_SAMPLE), 'supabase', 'C public classified');
  assert.ok(validateImageUrl(PUBLIC_SAMPLE), 'C public validates');

  // E — index stripper replaces signed in HTML
  const stripped = replaceSignedStorageImgSrcInHtml(
    `<img src="${SIGNED_SAMPLE}" alt="x"><img src="${PUBLIC_SAMPLE}" alt="y">`
  );
  assert.ok(!/\/object\/sign\//.test(stripped), 'E index strip removes signed');
  assert.ok(stripped.includes(PUBLIC_SAMPLE), 'E public preserved in strip');
  assert.ok(stripped.includes(getFallbackImage(0)) || /Websitehomebucket|seadaysfav/.test(stripped), 'E fallback used');

  // Invalid / unreachable signed with stablePublicOnly → null (no keep)
  const prevMat = process.env.SEADAYS_MATERIALIZE_SIGNED;
  process.env.SEADAYS_MATERIALIZE_SIGNED = '';
  const deadSigned =
    'https://soqkgrfzluewpuiguypm.supabase.co/storage/v1/object/sign/make-51d3ca8d-note-images/does-not-exist/missing.jpg?token=dead';
  const stableNull = await resolveImageUrl(deadSigned, 'test-article', 0, { stablePublicOnly: true });
  assert.strictEqual(stableNull, null, 'B/E stablePublicOnly rejects unreachable signed');

  // Blog path: working signed URL preserved when HEAD succeeds (optional live)
  if (String(process.env.SEADAYS_IMAGE_LIVE_HEAD || '').trim() === '1') {
    const root = path.join(__dirname, '..');
    const beforePath = path.join(
      root,
      'blog/aidacosma-vs-msc-seashore-ship-comparison-guide/index.html'
    );
    // Prefer a known-good signed URL from git history if present in current tree or via env.
    let liveSigned = process.env.SEADAYS_TEST_SIGNED_URL || '';
    if (!liveSigned) {
      try {
        const { execSync } = require('child_process');
        const hist = execSync(
          'git show daea2eb49:blog/aidacosma-vs-msc-seashore-ship-comparison-guide/index.html',
          { encoding: 'utf8', maxBuffer: 20e6, cwd: root }
        );
        const m = hist.match(/src="(https:\/\/[^"]+\/storage\/v1\/object\/sign\/[^"]+)"/);
        if (m) liveSigned = m[1];
      } catch {
        /* ignore */
      }
    }
    if (liveSigned) {
      assert.ok(await headOk(liveSigned), 'live signed still 200');
      const kept = await resolveImageUrl(liveSigned, 'live-test', 0, {});
      assert.ok(kept, 'A working signed preserved or upgraded');
      assert.ok(
        isSignedStorageUrl(kept) || /\/object\/public\//.test(kept),
        'A result is signed or public'
      );
      assert.ok(!/Websitehomebucket/.test(kept), 'A not generic fallback');
    }
  }

  // F — body replacement must not blank out when resolve returns a signed URL
  // (behavioral contract): classify must not null a signed resolve result.
  assert.ok(classifyImageUrl(SIGNED_SAMPLE), 'F signed not null after classify');

  // Generated HTML regression gates (after regenerate)
  const root = path.join(__dirname, '..');
  const portsIndex = fs.readFileSync(path.join(root, 'ports/index.html'), 'utf8');
  const shipsIndex = fs.readFileSync(path.join(root, 'ships/index.html'), 'utf8');
  const portsSigned = [...portsIndex.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)].filter((m) =>
    /\/object\/sign\//i.test(m[1] || '')
  );
  const shipsSigned = [...shipsIndex.matchAll(/<img\b[^>]*?\bsrc=["']([^"']+)["']/gi)].filter((m) =>
    /\/object\/sign\//i.test(m[1] || '')
  );
  assert.strictEqual(portsSigned.length, 0, 'E ports index signed imgs = 0');
  assert.strictEqual(shipsSigned.length, 0, 'E ships index signed imgs = 0');

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

  if (prevMat === undefined) delete process.env.SEADAYS_MATERIALIZE_SIGNED;
  else process.env.SEADAYS_MATERIALIZE_SIGNED = prevMat;

  console.log('test-image-pipeline PASS');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  PROVIDER_GEO_CONTRADICTIONS,
  isExcludedFromPublicDirectoryRender,
} = require('./lib/destinationPhotoBatch02GeoPolicy');
const { resetPortsDirectoryImageCachesForTests } = require('./lib/portsDirectoryImageResolve');

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exit(1);
  }
}

function slugCardSnippet(html, slug) {
  const needle = `data-item="${slug}"`;
  const i = html.indexOf(needle);
  if (i < 0) return '';
  return html.slice(i, i + 900);
}

function hasNeutralDirectoryCard(html, slug) {
  const chunk = slugCardSnippet(html, slug);
  return (
    chunk.includes('data-verified-photo="0"') &&
    chunk.includes('directory-card-media--neutral') &&
    chunk.includes('seadays-no-image.webp')
  );
}

function readIndexMarkers(html) {
  return {
    batch02: (html.match(/destination-exterior-batch02/g) || []).length,
    batch01: (html.match(/destination-exterior-batch01/g) || []).length,
    verifiedPhotoTiles: (html.match(/data-verified-photo="1"/g) || []).length,
    imgTags: (html.match(/<img/g) || []).length,
    wikimedia: html.includes('upload.wikimedia.org') ? 1 : 0,
    regionImages: (html.match(/region-card-image/g) || []).length,
    curacaoNeutral: hasNeutralDirectoryCard(html, 'curacao-willemstad-curacao'),
    costaMayaNeutral: hasNeutralDirectoryCard(html, 'costa-maya-mexico'),
  };
}

function assertProductionIndexMarkers(html, label) {
  const m = readIndexMarkers(html);
  assert(m.batch02 >= 20, `${label}: batch02 asset refs (got ${m.batch02})`);
  assert(m.batch01 >= 2, `${label}: batch01 asset refs (got ${m.batch01})`);
  assert(m.verifiedPhotoTiles >= 20, `${label}: verified photo tiles (got ${m.verifiedPhotoTiles})`);
  assert(m.imgTags >= 50, `${label}: directory img tags (got ${m.imgTags})`);
  assert(m.wikimedia === 0, `${label}: no Wikimedia destination URLs`);
  assert(m.regionImages >= 10, `${label}: region card images (got ${m.regionImages})`);
  assert(m.curacaoNeutral, `${label}: Curaçao neutral card`);
  assert(m.costaMayaNeutral, `${label}: Costa Maya neutral card`);
  assert(!/owner-review|reject13-debug|image-review-label/i.test(html), `${label}: no debug labels`);

  const finalPath = path.join(repoRoot, 'data', 'destination-photo-batch-02-final-approvals.json');
  const finalDoc = JSON.parse(fs.readFileSync(finalPath, 'utf8'));
  let eligible = 0;
  for (const row of finalDoc.selections) {
    if (!isExcludedFromPublicDirectoryRender(row.portSlug)) eligible += 1;
    if (isExcludedFromPublicDirectoryRender(row.portSlug)) {
      const ha = JSON.parse(
        fs.readFileSync(path.join(repoRoot, 'data', 'ports-directory-image-review-state.json'), 'utf8')
      ).humanApproved?.[row.portSlug];
      if (ha?.url) assert(!html.includes(ha.url), `${label}: excluded tile absent ${row.portSlug}`);
    }
  }
  assert(eligible === 23, `${label}: 23 eligible batch02 public photos`);
  assert(Object.keys(PROVIDER_GEO_CONTRADICTIONS).length === 2, `${label}: two geo contradictions`);
}

const repoRoot = path.join(__dirname, '..');
const indexPath = path.join(repoRoot, 'ports', 'index.html');
const indexBackup = fs.readFileSync(indexPath, 'utf8');

function runPortsCatalogueChannel() {
  resetPortsDirectoryImageCachesForTests();
  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env: { ...process.env },
    maxBuffer: 20 * 1024 * 1024,
  });
}

try {
  runPortsCatalogueChannel();
  const afterFirst = fs.readFileSync(indexPath, 'utf8');
  assertProductionIndexMarkers(afterFirst, 'ports-only generation pass 1');

  runPortsCatalogueChannel();
  const afterSecond = fs.readFileSync(indexPath, 'utf8');
  assertProductionIndexMarkers(afterSecond, 'ports-only generation pass 2');

  const m1 = readIndexMarkers(afterFirst);
  const m2 = readIndexMarkers(afterSecond);
  assert(m1.verifiedPhotoTiles === m2.verifiedPhotoTiles, 'stable verified tiles across regen');
  assert(m1.batch02 === m2.batch02, 'stable batch02 refs across regen');

  execFileSync('node', ['scripts/rewrite-download-ctas.js'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env: { ...process.env, SEADAYS_HTML_POSTPROCESS_DIRS: 'ports,ships' },
  });
  execFileSync('node', ['scripts/inject-analytics-head.js'], {
    cwd: repoRoot,
    stdio: 'pipe',
    env: { ...process.env, SEADAYS_HTML_POSTPROCESS_DIRS: 'ports,ships' },
  });
  const afterPost = fs.readFileSync(indexPath, 'utf8');
  assertProductionIndexMarkers(afterPost, 'after ports-channel postprocess');

  const dirty = execFileSync('git', ['diff', '--name-only'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const workflow = fs.readFileSync(path.join(repoRoot, '.github/workflows/generate-ports.yml'), 'utf8');
  const pushScript = fs.readFileSync(path.join(repoRoot, 'scripts/ci-safe-push-generated.sh'), 'utf8');
  assert(workflow.includes('COMMIT_PATHS: ports'), 'ports workflow commits only ports/');
  assert(pushScript.includes('COMMIT_PATHS'), 'safe push honors COMMIT_PATHS');
  const committed = dirty.filter((file) => file === 'ports' || file.startsWith('ports/'));
  const wouldPublish = committed;
  const guides = committed.filter((file) => file !== 'ports/index.html');
  assert(guides.length === 0, `ports channel must not leave port-guide diffs (got ${guides.slice(0, 3).join(', ')})`);
  assert(!wouldPublish.includes('ads.txt'), 'ads.txt is outside the ports commit set');
  assert(dirty.filter((file) => file.startsWith('blog/')).every((file) => !wouldPublish.includes(file)), 'blog files stay out of the ports commit set');

  console.log('OK test-ports-catalogue-channel-index-photography', {
    pass1: m1,
    pass2: m2,
    dirtyBlog: dirty.filter((file) => file.startsWith('blog/')).length,
    dirtyAds: dirty.includes('ads.txt'),
    committedPorts: wouldPublish,
  });
} finally {
  execFileSync('git', ['checkout', '--', 'blog', 'ads.txt', 'ports', 'sitemap.xml'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
}

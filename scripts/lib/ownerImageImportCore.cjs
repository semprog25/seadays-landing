'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readDimensions(filePath) {
  try {
    const out = execFileSync('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', filePath], {
      encoding: 'utf8',
    });
    const w = out.match(/pixelWidth:\s*(\d+)/);
    const h = out.match(/pixelHeight:\s*(\d+)/);
    return {
      width: w ? Number(w[1]) : null,
      height: h ? Number(h[1]) : null,
    };
  } catch {
    return { width: null, height: null };
  }
}

function writeWebDerivatives(sourcePath, destBaseWithoutExt, maxWidth) {
  ensureDir(path.dirname(destBaseWithoutExt));
  const jpegOut = `${destBaseWithoutExt}.jpg`;
  execFileSync('sips', ['-Z', String(maxWidth), sourcePath, '--out', jpegOut], { stdio: 'pipe' });
  const webpOut = `${destBaseWithoutExt}.webp`;
  try {
    execFileSync(
      '/opt/homebrew/bin/cwebp',
      ['-q', '82', '-resize', String(maxWidth), '0', jpegOut, '-o', webpOut],
      { stdio: 'pipe' }
    );
  } catch {
    execFileSync('cwebp', ['-q', '82', jpegOut, '-o', webpOut], { stdio: 'pipe' });
  }
  return { jpegOut, webpOut };
}

function parsePexelsBasename(basename) {
  const photoIdMatch = basename.match(/-(\d{5,})\.jpe?g$/i);
  const photoId = photoIdMatch ? Number(photoIdMatch[1]) : null;
  let photographerSlug = '';
  const hamburg = basename.match(/^Hamburg-pexels-(.+)-\d+\.jpe?g$/i);
  if (hamburg) photographerSlug = hamburg[1];
  else {
    const m = basename.match(/^pexels-(.+)-\d+\.jpe?g$/i);
    if (m) photographerSlug = m[1].replace(/-\d+$/, '');
  }
  return { photographerSlug, photoId };
}

function resolveSourcePath({ repoRoot, inboxDir, downloadsDir, basename }) {
  const inbox = path.join(repoRoot, inboxDir, basename);
  if (fs.existsSync(inbox)) return inbox;
  const dl = path.join(downloadsDir, basename);
  if (fs.existsSync(dl)) return dl;
  return '';
}

module.exports = {
  ensureDir,
  readDimensions,
  writeWebDerivatives,
  parsePexelsBasename,
  resolveSourcePath,
};

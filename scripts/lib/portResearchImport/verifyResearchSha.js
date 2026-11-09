'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadResearchIndex } = require('./buildIdentifierManifest');

function sha256File(filePath) {
  const buf = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * @returns {{ ok: boolean, expected: string|null, actual: string|null, reason: string|null }}
 */
function verifyResearchPortSha({ researchRoot, landingSlug, manifestRow }) {
  const mdPath = path.join(researchRoot, 'by-port', `${landingSlug}.md`);
  if (!fs.existsSync(mdPath)) {
    return { ok: false, expected: manifestRow?.sha256 || null, actual: null, reason: 'missing_research_markdown' };
  }
  const actual = sha256File(mdPath);
  const index = loadResearchIndex(researchRoot);
  const fromIndex = index.find((p) => p.slug === landingSlug);
  const expected = manifestRow?.sha256 || fromIndex?.sha256 || null;
  if (!expected) {
    return { ok: false, expected: null, actual, reason: 'missing_expected_sha' };
  }
  if (actual !== expected) {
    return { ok: false, expected, actual, reason: 'sha_mismatch' };
  }
  return { ok: true, expected, actual, reason: null };
}

module.exports = {
  sha256File,
  verifyResearchPortSha,
};

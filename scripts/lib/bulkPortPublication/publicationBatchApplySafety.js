'use strict';

const fs = require('fs');
const path = require('path');
const { loadPublicPortGuidesFile } = require('../publicPortGuideAdapter');
const {
  countPassengerEditorialGuides,
  removeStage65ExcludedGuideEntries,
} = require('./stage65PublicationGuards');

const MARKER = 'APPLY_IN_PROGRESS.json';

function rollbackGuidesPath(rollbackDir) {
  return path.join(rollbackDir, 'public-port-guides.json');
}

function rollbackHtmlPath(rollbackDir, landingSlug) {
  return path.join(rollbackDir, 'ports', landingSlug, 'index.html');
}

function productionGuidesPath(repoRoot) {
  return path.join(repoRoot, 'data/public-port-guides.json');
}

function productionHtmlPath(repoRoot, landingSlug) {
  return path.join(repoRoot, 'ports', landingSlug, 'index.html');
}

function restoreProductionFromSlugRollback(repoRoot, rollbackDir, landingSlug) {
  const guidesSnap = rollbackGuidesPath(rollbackDir);
  if (!fs.existsSync(guidesSnap)) {
    throw new Error(`rollback missing guides snapshot: ${guidesSnap}`);
  }
  fs.copyFileSync(guidesSnap, productionGuidesPath(repoRoot));

  const htmlSnap = rollbackHtmlPath(rollbackDir, landingSlug);
  const htmlLive = productionHtmlPath(repoRoot, landingSlug);
  if (fs.existsSync(htmlSnap)) {
    fs.mkdirSync(path.dirname(htmlLive), { recursive: true });
    fs.copyFileSync(htmlSnap, htmlLive);
  } else if (fs.existsSync(htmlLive)) {
    fs.unlinkSync(htmlLive);
  }
}

function writeApplyInProgressMarker(rollbackDir, landingSlug) {
  const markerPath = path.join(rollbackDir, MARKER);
  fs.writeFileSync(
    markerPath,
    `${JSON.stringify({
      landing_slug: landingSlug,
      started_at_utc: new Date().toISOString(),
      pid: process.pid,
    })}\n`,
    'utf8'
  );
  return markerPath;
}

function clearApplyInProgressMarker(rollbackDir) {
  const markerPath = path.join(rollbackDir, MARKER);
  if (fs.existsSync(markerPath)) fs.unlinkSync(markerPath);
}

function hasInterruptedApply(rollbackDir) {
  return fs.existsSync(path.join(rollbackDir, MARKER));
}

function recoverInterruptedSlugApplies(repoRoot, evidenceRoot) {
  const rollbackRoot = path.join(evidenceRoot, 'rollback-pre-apply');
  if (!fs.existsSync(rollbackRoot)) return { recovered: [] };

  const recovered = [];
  for (const ent of fs.readdirSync(rollbackRoot, { withFileTypes: true })) {
    if (!ent.isDirectory()) continue;
    const slug = ent.name;
    const rollbackDir = path.join(rollbackRoot, slug);
    if (!hasInterruptedApply(rollbackDir)) continue;
    if (!fs.existsSync(rollbackGuidesPath(rollbackDir))) {
      throw new Error(`interrupted apply for ${slug} but rollback guides snapshot missing`);
    }
    restoreProductionFromSlugRollback(repoRoot, rollbackDir, slug);
    clearApplyInProgressMarker(rollbackDir);
    recovered.push(slug);
  }

  if (recovered.length) {
    const guides = loadPublicPortGuidesFile(repoRoot);
    removeStage65ExcludedGuideEntries(guides);
    return { recovered, passenger_editorial: countPassengerEditorialGuides(guides) };
  }
  return { recovered: [] };
}

module.exports = {
  MARKER,
  rollbackGuidesPath,
  rollbackHtmlPath,
  restoreProductionFromSlugRollback,
  writeApplyInProgressMarker,
  clearApplyInProgressMarker,
  hasInterruptedApply,
  recoverInterruptedSlugApplies,
};

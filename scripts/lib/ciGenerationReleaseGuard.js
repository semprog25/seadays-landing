'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_GUARD_REL = '.github/ci-generation-release-guard.json';

function normalizePath(file) {
  return String(file || '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .trim();
}

function loadReleaseGuard(repoRoot = process.cwd()) {
  const guardPath = path.join(repoRoot, DEFAULT_GUARD_REL);
  if (!fs.existsSync(guardPath)) return null;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(guardPath, 'utf8'));
  } catch (err) {
    return { error: `Invalid ${DEFAULT_GUARD_REL}: ${err?.message || err}` };
  }
  if (!raw || typeof raw !== 'object') {
    return { error: `${DEFAULT_GUARD_REL} must be a JSON object` };
  }
  const profile = String(raw.profile || '').trim();
  const exactPaths = Array.isArray(raw.exactPaths)
    ? raw.exactPaths.map(normalizePath).filter(Boolean)
    : [];
  if (!profile) return { error: `${DEFAULT_GUARD_REL} missing profile` };
  if (!exactPaths.length) return { error: `${DEFAULT_GUARD_REL} missing exactPaths` };
  if (!exactPaths.includes(normalizePath(DEFAULT_GUARD_REL))) {
    return { error: `${DEFAULT_GUARD_REL} exactPaths must include the guard file itself` };
  }
  return { profile, exactPaths, guardRel: DEFAULT_GUARD_REL };
}

function samePathSet(a, b) {
  const left = new Set((Array.isArray(a) ? a : []).map(normalizePath).filter(Boolean));
  const right = new Set((Array.isArray(b) ? b : []).map(normalizePath).filter(Boolean));
  if (left.size !== right.size) return false;
  for (const p of left) {
    if (!right.has(p)) return false;
  }
  return true;
}

/**
 * Push-only release guard. Suppresses bulk generation only when changed files
 * exactly match an approved path set declared in the guard file at HEAD.
 */
function evaluatePushReleaseGuard(changedFiles, { repoRoot = process.cwd() } = {}) {
  const loaded = loadReleaseGuard(repoRoot);
  if (!loaded) return null;
  if (loaded.error) {
    return { action: 'reject', reason: loaded.error };
  }

  const normalized = (Array.isArray(changedFiles) ? changedFiles : []).map(normalizePath).filter(Boolean);
  if (!normalized.length) return null;

  if (samePathSet(normalized, loaded.exactPaths)) {
    return {
      action: 'suppress',
      reason: `release-guard:${loaded.profile}:exact-path-match`,
    };
  }

  return null;
}

module.exports = {
  DEFAULT_GUARD_REL,
  loadReleaseGuard,
  evaluatePushReleaseGuard,
  samePathSet,
};

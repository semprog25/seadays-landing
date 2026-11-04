'use strict';

const fs = require('fs');
const path = require('path');

const MANIFEST_BASENAME = 'publish-gate-index-restore-manifest.json';
const EXAMPLE_BASENAME = 'publish-gate-index-restore-manifest.example.json';
const APPLY_ENV = 'PUBLISH_GATE_INDEX_RESTORE_APPLY';

/** Audit classes that may appear in an owner-approved restore manifest. */
const RESTORE_ALLOWED_AUDIT_CLASSES = new Set(['KEEP_INDEX', 'IMPROVE']);

function isRestoreApplyEnabled() {
  return process.env[APPLY_ENV] === '1';
}

function manifestPath(repoRoot) {
  return path.join(repoRoot, 'data', MANIFEST_BASENAME);
}

function loadApprovedRestoreManifest(repoRoot) {
  const p = manifestPath(repoRoot);
  if (!fs.existsSync(p)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const entries = Array.isArray(raw.entries) ? raw.entries : [];
    return { ...raw, entries };
  } catch {
    return null;
  }
}

function findManifestEntry(manifest, kind, slug) {
  if (!manifest || !Array.isArray(manifest.entries)) return null;
  const k = String(kind || '').trim();
  const s = String(slug || '').trim();
  return manifest.entries.find((e) => e && e.kind === k && e.slug === s) || null;
}

/**
 * Fail-closed: no automatic restore from indexability or Oct audit CSV alone.
 */
function isExplicitlyApprovedForIndexRestore(kind, slug, manifest) {
  if (!isRestoreApplyEnabled()) return false;
  if (!manifest) return false;
  const entry = findManifestEntry(manifest, kind, slug);
  if (!entry) return false;
  const auditClass = String(entry.auditClass || '').trim();
  if (!RESTORE_ALLOWED_AUDIT_CLASSES.has(auditClass)) return false;
  return true;
}

function loadOct27AuditClassMap(repoRoot) {
  const candidates = [
    path.join(repoRoot, 'qa-evidence/adsense-indexing-dry-run-2026-10-27/port-ship-classification.csv'),
    path.join(
      repoRoot,
      'qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected/port-ship-classification.csv'
    ),
    path.join(
      repoRoot,
      'qa-evidence/adsense-indexing-dry-run-2026-10-28-marigot-corrected/inputs/oct28-uncorrected-baseline.csv'
    ),
    path.join(repoRoot, '..', '..', 'qa-evidence/adsense-indexing-dry-run-2026-10-27/port-ship-classification.csv'),
  ];
  let csvPath = '';
  for (const p of candidates) {
    if (fs.existsSync(p)) {
      csvPath = p;
      break;
    }
  }
  const map = new Map();
  if (!csvPath) return map;
  const lines = fs.readFileSync(csvPath, 'utf8').trim().split(/\n/).slice(1);
  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length < 4) continue;
    const kind = parts[0] === 'ship' ? 'ship' : 'port';
    const slug = parts[1];
    const auditClass = parts[3];
    if (slug === '(directory)') continue;
    map.set(`${kind}:${slug}`, auditClass);
  }
  return map;
}

function classifySlugForRestoreProposal(kind, slug, auditMap) {
  const key = `${kind}:${slug}`;
  const hit = auditMap.get(key);
  if (hit === 'KEEP_INDEX' || hit === 'IMPROVE' || hit === 'NOINDEX_CANDIDATE') return hit;
  return 'UNCLASSIFIED';
}

module.exports = {
  APPLY_ENV,
  EXAMPLE_BASENAME,
  MANIFEST_BASENAME,
  RESTORE_ALLOWED_AUDIT_CLASSES,
  classifySlugForRestoreProposal,
  findManifestEntry,
  isExplicitlyApprovedForIndexRestore,
  isRestoreApplyEnabled,
  loadApprovedRestoreManifest,
  loadOct27AuditClassMap,
  manifestPath,
};

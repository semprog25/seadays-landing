'use strict';

const fs = require('fs');
const path = require('path');
const { isApprovedDestinationPhotographyUrl } = require('./destinationImageSourcePolicy');
const { loadDestinationOwnerPortEntryBySlug } = require('./portsDirectoryImageResolve');

const VERIFICATION = {
  VERIFIED: 'VERIFIED',
  NEEDS_REVIEW: 'NEEDS_REVIEW',
  REJECTED: 'REJECTED',
  MISSING: 'MISSING',
};

function readJson(repoRoot, relPath) {
  const filePath = path.join(repoRoot, relPath);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    return null;
  }
}

function normalizeRecord(base) {
  return {
    portSlug: base.portSlug || '',
    country: base.country || '',
    region: base.region || '',
    role: base.role || 'port-destination',
    provider: base.provider || '',
    imageId: base.imageId || '',
    sourcePageUrl: base.sourcePageUrl || '',
    photographer: base.photographer || '',
    licenseTerms: base.licenseTerms || '',
    geographicEvidence: base.geographicEvidence || '',
    resolution: base.resolution || '',
    focalPoint: base.focalPoint || null,
    attribution: base.attribution || '',
    displayUrl: base.displayUrl || '',
    verificationStatus: base.verificationStatus || VERIFICATION.MISSING,
    notes: base.notes || '',
  };
}

function pushRecord(map, key, record) {
  if (!key) return;
  if (!map.has(key)) map.set(key, []);
  map.get(key).push(normalizeRecord(record));
}

/**
 * Build destination-image catalogue entries from existing manifests (no network harvest).
 * @param {string} repoRoot
 * @param {{ ports?: Array<{ slug: string, country?: string, region?: string }> }} opts
 */
function buildDestinationImageCatalog(repoRoot, opts = {}) {
  const ports = Array.isArray(opts.ports) ? opts.ports : [];
  const byKey = new Map();

  const reviewState = readJson(repoRoot, 'data/ports-directory-image-review-state.json') || {};
  const humanApproved =
    reviewState.humanApproved && typeof reviewState.humanApproved === 'object'
      ? reviewState.humanApproved
      : {};
  const ownerPorts = loadDestinationOwnerPortEntryBySlug(repoRoot);
  const assignments = readJson(repoRoot, 'data/owner-image-assignments.json');
  const assignmentList = Array.isArray(assignments?.assignments) ? assignments.assignments : [];

  for (const [slug, approved] of Object.entries(humanApproved)) {
    const portMeta = ports.find((p) => p.slug === slug);
    const excluded = approved.excludedFromPublicDirectoryRender === true;
    pushRecord(byKey, `${slug}:port-destination`, {
      portSlug: slug,
      country: portMeta?.country || '',
      region: portMeta?.region || '',
      role: 'port-destination',
      provider: approved.provider || 'owner',
      displayUrl: approved.url || '',
      geographicEvidence: approved.depictedDestination || '',
      verificationStatus: excluded ? VERIFICATION.NEEDS_REVIEW : VERIFICATION.VERIFIED,
      attribution: approved.approvedBy ? `Approved ${approved.approvedAt || ''} by ${approved.approvedBy}` : '',
      notes: excluded
        ? `Owner-approved; withheld from public directory: ${approved.providerGeoContradiction?.summary || 'provider geo contradiction'}`
        : 'Human-approved directory tile (owner visual approval)',
    });
  }

  for (const [slug, entry] of Object.entries(ownerPorts)) {
    if (!entry || typeof entry !== 'object') continue;
    const portMeta = ports.find((p) => p.slug === slug);
    const status =
      String(entry.verificationStatus || '') === 'VERIFIED'
        ? VERIFICATION.VERIFIED
        : VERIFICATION.NEEDS_REVIEW;
    const url = String(entry.directoryImageUrl || entry.heroImageUrl || '').trim();
    if (url) {
      pushRecord(byKey, `${slug}:port-destination`, {
        portSlug: slug,
        country: portMeta?.country || entry.country || '',
        region: portMeta?.region || entry.region || '',
        role: 'port-destination',
        provider: entry.provider || 'owner-import',
        displayUrl: url,
        focalPoint: entry.cropFocal?.directory || entry.cropFocal?.hero || null,
        geographicEvidence: entry.depictedDestination || entry.notes || '',
        verificationStatus: humanApproved[slug] ? VERIFICATION.VERIFIED : status,
        sourcePageUrl: entry.sourcePageUrl || '',
        photographer: entry.photographer || '',
        licenseTerms: entry.license || 'Owner-supplied Pexels/Unsplash import',
        notes: entry.notes || '',
      });
    }
    const editorial = String(entry.editorialImageUrl || '').trim();
    if (editorial) {
      pushRecord(byKey, `${slug}:things-to-do-editorial`, {
        portSlug: slug,
        country: portMeta?.country || '',
        region: portMeta?.region || '',
        role: 'things-to-do-editorial',
        provider: entry.editorialProvider || 'owner-import',
        displayUrl: editorial,
        focalPoint: entry.cropFocal?.editorial || null,
        verificationStatus: status,
        geographicEvidence: entry.editorialDepicted || '',
        notes: 'Editorial figure for Things to do',
      });
    }
  }

  for (const row of assignmentList) {
    if (!row || typeof row !== 'object') continue;
    const slug = row.portSlug || '';
    const regionKey = row.regionKey || '';
    const role = row.role === 'region' ? 'region-thumbnail' : row.role || 'unassigned';
    const key = slug ? `${slug}:${role}` : regionKey ? `region:${regionKey}:${role}` : `assignment:${row.inboxBasename}`;
    pushRecord(byKey, key, {
      portSlug: slug,
      region: regionKey,
      role,
      provider: 'owner-inbox',
      geographicEvidence: row.notes || row.sourceHint || '',
      verificationStatus: row.verificationStatus || VERIFICATION.NEEDS_REVIEW,
      notes: row.inboxBasename || '',
    });
  }

  const regionPexels = readJson(repoRoot, 'data/ports-directory-region-images-pexels.json');
  const regionProvided = readJson(repoRoot, 'data/ports-directory-region-images-provided.json');
  for (const source of [regionPexels, regionProvided]) {
    if (!source || typeof source !== 'object') continue;
    const regions = source.regions && typeof source.regions === 'object' ? source.regions : source;
    for (const [regionKey, meta] of Object.entries(regions)) {
      if (!meta || typeof meta !== 'object') continue;
      const url = String(meta.url || meta.imageUrl || meta.webpPath || '').trim();
      if (!url) continue;
      const displayUrl = url.startsWith('/') ? url : url;
      const approved = isApprovedDestinationPhotographyUrl(displayUrl.startsWith('http') ? displayUrl : `https://local${displayUrl}`);
      pushRecord(byKey, `region:${regionKey}:region-thumbnail`, {
        region: regionKey,
        role: 'region-thumbnail',
        provider: meta.provider || (url.includes('pexels') ? 'pexels' : 'owner'),
        displayUrl,
        sourcePageUrl: meta.sourceUrl || meta.pexelsUrl || '',
        photographer: meta.photographer || meta.credit || '',
        licenseTerms: meta.license || 'Pexels/Unsplash licence via import manifest',
        geographicEvidence: meta.depicted || meta.notes || regionKey,
        verificationStatus: approved ? VERIFICATION.NEEDS_REVIEW : VERIFICATION.REJECTED,
        focalPoint: meta.focalPercent || meta.focal || null,
      });
    }
  }

  const records = [];
  for (const group of byKey.values()) {
    for (const rec of group) records.push(rec);
  }

  const statusCounts = records.reduce((acc, r) => {
    acc[r.verificationStatus] = (acc[r.verificationStatus] || 0) + 1;
    return acc;
  }, {});

  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    policyNote:
      'Machine-selected or imported assets remain NEEDS_REVIEW until owner visual approval. Wikimedia is archived for terminal infra only — not port destination photography.',
    portCatalogueSize: ports.length,
    recordCount: records.length,
    statusCounts,
    records,
  };
}

module.exports = {
  VERIFICATION,
  buildDestinationImageCatalog,
  normalizeRecord,
};

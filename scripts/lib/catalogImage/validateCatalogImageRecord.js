'use strict';

const KNOWN_LICENSE_PREFIXES = [
  'cc0',
  'cc by',
  'cc-by',
  'cc by-sa',
  'cc-by-sa',
  'public domain',
  'pd',
];

function pushIssue(issues, code, message) {
  issues.push({ code, message });
}

function isHttpsUrl(url, maxLen = 2048) {
  if (typeof url !== 'string' || url.length === 0 || url.length > maxLen) return false;
  if (url.startsWith('data:')) return false;
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function looksLikeLicense(value) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return KNOWN_LICENSE_PREFIXES.some((prefix) => normalized.includes(prefix));
}

function isCatalogImageRole(value) {
  return value === 'hero' || value === 'destinationHero' || value === 'portInfrastructure';
}

function isRoleAllowedForEntityKind(role, kind) {
  if (kind === 'ship') return role === 'hero';
  return role === 'destinationHero' || role === 'portInfrastructure';
}

function validateCatalogImageRecordV1(raw, options) {
  const issues = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    pushIssue(issues, 'malformed_record', 'Record must be a JSON object');
    return { ok: false, issues };
  }

  const record = raw;
  if (record.v !== 1) {
    pushIssue(issues, 'invalid_version', 'Unsupported or missing record version');
    return { ok: false, issues };
  }

  const status = record.status;
  if (status !== 'draft' && status !== 'verified' && status !== 'rejected' && status !== 'removed') {
    pushIssue(issues, 'invalid_status', 'status must be draft, verified, rejected, or removed');
  }

  const entity = record.entity;
  if (!entity || typeof entity !== 'object') {
    pushIssue(issues, 'missing_field', 'entity is required');
  } else {
    if (entity.kind !== 'ship' && entity.kind !== 'port') {
      pushIssue(issues, 'missing_field', 'entity.kind must be ship or port');
    }
    if (!isNonEmptyString(entity.canonicalSlug)) {
      pushIssue(issues, 'missing_field', 'entity.canonicalSlug is required');
    } else if (options?.expectedCanonicalSlug && entity.canonicalSlug !== options.expectedCanonicalSlug) {
      pushIssue(issues, 'slug_mismatch', 'entity.canonicalSlug does not match requested key');
    }
    if (options?.expectedKind && entity.kind !== options.expectedKind) {
      pushIssue(issues, 'slug_mismatch', 'entity.kind does not match requested kind');
    }
  }

  const role = record.role;
  if (role !== undefined && !isCatalogImageRole(role)) {
    pushIssue(issues, 'invalid_role', 'role must be hero, destinationHero, or portInfrastructure when present');
  } else if (role !== undefined && entity && entity.kind) {
    if (!isRoleAllowedForEntityKind(role, entity.kind)) {
      pushIssue(issues, 'invalid_role', `role ${role} is not valid for entity.kind ${entity.kind}`);
    }
  }

  if (options?.requireRole && role === undefined) {
    pushIssue(issues, 'invalid_role', 'role is required for this catalogue slot');
  }

  if (options?.expectedRole && role !== undefined && role !== options.expectedRole) {
    pushIssue(issues, 'role_mismatch', `role must be ${options.expectedRole}`);
  }

  const commons = record.commons;
  if (!commons || typeof commons !== 'object') {
    pushIssue(issues, 'missing_field', 'commons is required');
  } else {
    if (!isNonEmptyString(commons.file)) {
      pushIssue(issues, 'missing_field', 'commons.file is required');
    }
    if (!isNonEmptyString(commons.pageUrl) || !isHttpsUrl(commons.pageUrl)) {
      pushIssue(issues, 'invalid_url', 'commons.pageUrl must be a valid https URL');
    }
  }

  const media = record.media;
  if (!media || typeof media !== 'object') {
    pushIssue(issues, 'missing_field', 'media is required');
  } else {
    if (!isNonEmptyString(media.url) || !isHttpsUrl(media.url)) {
      pushIssue(issues, 'invalid_url', 'media.url must be a valid https URL');
    }
    if (media.thumbUrl && !isHttpsUrl(media.thumbUrl)) {
      pushIssue(issues, 'invalid_url', 'media.thumbUrl must be https when present');
    }
    if (!isNonEmptyString(media.alt)) {
      pushIssue(issues, 'missing_field', 'media.alt is required');
    }
  }

  const attribution = record.attribution;
  if (!attribution || typeof attribution !== 'object') {
    pushIssue(issues, 'missing_field', 'attribution is required');
  } else {
    if (!isNonEmptyString(attribution.creator)) {
      pushIssue(issues, 'missing_attribution', 'attribution.creator is required');
    }
    if (!isNonEmptyString(attribution.license)) {
      pushIssue(issues, 'missing_attribution', 'attribution.license is required');
    } else if (!looksLikeLicense(attribution.license)) {
      pushIssue(issues, 'invalid_license', 'attribution.license is not a recognized open license label');
    }
    if (!isNonEmptyString(attribution.licenseUrl) || !isHttpsUrl(attribution.licenseUrl)) {
      pushIssue(issues, 'invalid_license', 'attribution.licenseUrl must be a valid https URL');
    }
    if (attribution.creatorUrl && !isHttpsUrl(attribution.creatorUrl)) {
      pushIssue(issues, 'invalid_url', 'attribution.creatorUrl must be https when present');
    }
  }

  const review = record.review;
  if (!review || typeof review !== 'object') {
    pushIssue(issues, 'missing_field', 'review metadata is required');
  } else {
    if (!isNonEmptyString(review.reviewedAt)) {
      pushIssue(issues, 'missing_field', 'review.reviewedAt is required');
    }
    if (!isNonEmptyString(review.reviewedBy)) {
      pushIssue(issues, 'missing_field', 'review.reviewedBy is required');
    }
  }

  if (issues.length > 0) {
    return { ok: false, issues };
  }

  return { ok: true, record, issues: [] };
}

function isCatalogImageRecordDisplayable(record) {
  return record.status === 'verified';
}

module.exports = {
  validateCatalogImageRecordV1,
  isCatalogImageRecordDisplayable,
  isHttpsUrl,
};

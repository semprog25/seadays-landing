'use strict';

const fs = require('fs');
const path = require('path');
const { isPortDetailIndexable, isShipDetailIndexable } = require('./adsenseIndexability');
const { isAuditNoindexPort } = require('./auditHoldback');
const { isPortSeoRedirectSlug } = require('./portSeoRedirects');
const { loadPublicPortGuidesFile, resolveGuideIdFromSlugTokens } = require('./publicPortGuideAdapter');
const { isExplicitlyApprovedForIndexRestore, loadApprovedRestoreManifest } = require('./publishGateIndexRestoreManifest');

function loadOverrides(repoRoot, kind) {
  const p = path.join(repoRoot, 'data', 'landing-cruise-content-overrides.json');
  if (!fs.existsSync(p)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
    const block = raw[kind];
    return block && typeof block === 'object' ? block : {};
  } catch {
    return {};
  }
}

function portNameFromHtml(html) {
  const m = String(html || '').match(/<h1>([^<]+)<\/h1>/i);
  return m ? m[1].replace(/ Cruise Port Guide$/i, '').trim() : '';
}

function portCountryFromLead(html) {
  const m = String(html || '').match(/class="lead"[^>]*>[^<]* in ([^<]+)</i);
  return m ? m[1].trim() : '';
}

function loadGuidesByAppPortId(repoRoot) {
  const payload = loadPublicPortGuidesFile(repoRoot);
  return (payload && payload.byAppPortId) || {};
}

function shipPassesIndexabilityGate(slug, shipOverrides) {
  const ov = shipOverrides[String(slug || '').trim()] || {};
  return isShipDetailIndexable({
    slug: String(slug || '').trim(),
    description: String(ov.description || '').trim(),
    confidenceScore: ov.confidenceScore,
    hasContentOverride: Boolean(ov.description),
  });
}

function portPassesIndexabilityGate(slug, html, repoRoot, guidesById, portOverrides) {
  const s = String(slug || '').trim();
  const ov = portOverrides[s] || {};
  const country = String(ov.country || portCountryFromLead(html) || '').trim();
  const guideId = resolveGuideIdFromSlugTokens(s, guidesById, country);
  const guide = guideId ? guidesById[guideId] : null;
  return isPortDetailIndexable(
    {
      slug: s,
      name: String(ov.name || portNameFromHtml(html) || s).trim(),
      description: String(ov.description || '').trim(),
      country,
      hasContentOverride: Boolean(ov.description),
    },
    guide
  );
}

/**
 * Fail-closed restore: explicit approved manifest + APPLY env + gate/indexability + holdbacks.
 */
function mayRestorePageToIndex(page, ctx) {
  const { repoRoot, manifest, gateIssues, html, shipOverrides, portOverrides, guidesById } = ctx;
  if (!page || gateIssues.length > 0) return false;
  if (/http-equiv=["']refresh/i.test(String(html || '').slice(0, 2500))) return false;
  if (page.kind === 'port' && isAuditNoindexPort(page.slug)) return false;
  if (page.kind === 'port' && isPortSeoRedirectSlug(page.slug)) return false;
  if (!isExplicitlyApprovedForIndexRestore(page.kind, page.slug, manifest)) return false;
  if (page.kind === 'ship') {
    return shipPassesIndexabilityGate(page.slug, shipOverrides);
  }
  return portPassesIndexabilityGate(page.slug, html, repoRoot, guidesById, portOverrides);
}

function buildRestoreContext(repoRoot) {
  return {
    repoRoot,
    manifest: loadApprovedRestoreManifest(repoRoot),
    shipOverrides: loadOverrides(repoRoot, 'ships'),
    portOverrides: loadOverrides(repoRoot, 'ports'),
    guidesById: loadGuidesByAppPortId(repoRoot),
  };
}

module.exports = {
  buildRestoreContext,
  loadOverrides,
  loadGuidesByAppPortId,
  mayRestorePageToIndex,
  portPassesIndexabilityGate,
  shipPassesIndexabilityGate,
};

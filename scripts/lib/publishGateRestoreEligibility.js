'use strict';

const fs = require('fs');
const path = require('path');
const { isPortDetailIndexable, isShipDetailIndexable } = require('./adsenseIndexability');
const { loadPublicPortGuidesFile, resolveGuideIdFromSlugTokens } = require('./publicPortGuideAdapter');

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

function shipEligibleForIndexRestore(slug, shipOverrides) {
  const ov = shipOverrides[String(slug || '').trim()] || {};
  return isShipDetailIndexable({
    slug: String(slug || '').trim(),
    description: String(ov.description || '').trim(),
    confidenceScore: ov.confidenceScore,
    hasContentOverride: Boolean(ov.description),
  });
}

function portEligibleForIndexRestore(slug, html, repoRoot, guidesById, portOverrides) {
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

module.exports = {
  loadOverrides,
  loadGuidesByAppPortId,
  shipEligibleForIndexRestore,
  portEligibleForIndexRestore,
};

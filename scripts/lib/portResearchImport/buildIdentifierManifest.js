'use strict';

const fs = require('fs');
const path = require('path');
const { allPorts } = require('../../lib/appCruiseDataset');
const {
  buildSlugToAppPortIdMap,
  loadPublicPortGuidesFile,
  resolveGuideId,
  resolveGuideIdFromSlugTokens,
  acceptGuideId,
} = require('../../lib/publicPortGuideAdapter');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('../../lib/reviewAggregateMerge');
const { getAliasRedirectTarget } = require('../../lib/portSeoRedirects');
const { buildPortIdToCountryIdMap } = require('./buildCountryIdIndex');
const {
  DUPLICATE_GATEWAY_PAIRS,
  KNOWN_MULTI_SLUG_APP_IDS,
  collisionGroupForSlug,
} = require('./collisionGroups');

function loadResearchIndex(researchRoot) {
  const p = path.join(researchRoot, 'final', 'PORTS_MASTER_INDEX.json');
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  return Array.isArray(data.ports) ? data.ports : [];
}

function invertSlugMap(slugToApp) {
  const inv = new Map();
  for (const [slug, appId] of Object.entries(slugToApp || {})) {
    if (!appId) continue;
    if (!inv.has(appId)) inv.set(appId, []);
    inv.get(appId).push(slug);
  }
  return inv;
}

/**
 * @param {{ landingRepoRoot: string, researchRoot: string }} opts
 */
function buildPortIdentifierManifest(opts) {
  const landingRoot = opts.landingRepoRoot;
  const researchRoot = opts.researchRoot;
  const appRoot = getAppRepoRoot();
  const guides = loadPublicPortGuidesFile(landingRoot);
  const guidesById = guides.byAppPortId || {};
  const reviewMap = buildPortSlugToReviewKeyMap(appRoot, allPorts);
  const slugToApp = buildSlugToAppPortIdMap(allPorts, reviewMap, guidesById);
  const portIdToCountry = buildPortIdToCountryIdMap(appRoot);
  const appSlugSet = new Set(allPorts.map((p) => p.slug));
  const inverted = invertSlugMap(slugToApp);

  const rows = [];
  const index = loadResearchIndex(researchRoot);

  for (const entry of index) {
    const landingSlug = String(entry.slug || '').trim();
    const seoPort = allPorts.find((p) => p.slug === landingSlug) || {
      slug: landingSlug,
      name: entry.name,
      country: entry.country,
      region: entry.region,
    };

    const evidence = [];
    let appPortId = '';
    let method = '';

    const reviewKey = reviewMap.get(landingSlug) || '';
    if (reviewKey) {
      evidence.push({ type: 'review_key_map', value: reviewKey });
    }

    const fromSlugMap = slugToApp[landingSlug] || '';
    if (fromSlugMap) {
      appPortId = fromSlugMap;
      method = 'slug_to_app_port_id';
      evidence.push({ type: 'slug_to_app_port_id', value: fromSlugMap });
    }

    if (!appPortId && reviewKey) {
      const fromReview = acceptGuideId(resolveGuideId(reviewKey, guidesById), guidesById, seoPort.country);
      if (fromReview) {
        appPortId = fromReview;
        method = 'review_key_map';
        evidence.push({ type: 'review_key_resolved', value: fromReview });
      } else if (portIdToCountry.has(reviewKey)) {
        appPortId = reviewKey;
        method = 'review_key_picker_id';
        evidence.push({
          type: 'cruise_data_picker_id',
          value: reviewKey,
          note: 'App picker id from src/utils/cruise-data/ports/data; no public-port-guides entry',
        });
      }
    }

    if (!appPortId) {
      const fromSlugId = acceptGuideId(resolveGuideId(landingSlug, guidesById), guidesById, seoPort.country);
      if (fromSlugId) {
        appPortId = fromSlugId;
        method = 'direct_slug_guide_id';
        evidence.push({ type: 'direct_slug_guide_id', value: fromSlugId });
      }
    }

    if (!appPortId) {
      const fromTokens = resolveGuideIdFromSlugTokens(landingSlug, guidesById, seoPort.country);
      if (fromTokens) {
        appPortId = fromTokens;
        method = 'slug_token_unique';
        evidence.push({ type: 'slug_token_unique', value: fromTokens });
      }
    }

    const redirectTarget = getAliasRedirectTarget(landingSlug);
    const inAppDataset = appSlugSet.has(landingSlug);
    const countryId = appPortId ? portIdToCountry.get(appPortId) || null : null;

    const hasPublicGuide = Boolean(appPortId && guidesById[appPortId]);

    let status = 'unresolved';
    if (appPortId) {
      const slugsForId = inverted.get(appPortId) || [];
      const ambiguous = slugsForId.length > 1 && !KNOWN_MULTI_SLUG_APP_IDS.includes(appPortId);
      if (!hasPublicGuide) {
        status = 'inferred';
      } else if (ambiguous && !slugsForId.includes(landingSlug)) {
        status = 'inferred';
      } else if (method === 'review_key_map' || method === 'slug_to_app_port_id') {
        status = 'resolved';
      } else if (method === 'review_key_picker_id') {
        status = 'inferred';
      } else if (method === 'slug_token_unique' || method === 'direct_slug_guide_id') {
        status = 'inferred';
      } else {
        status = 'resolved';
      }
    }

    const multiSlugPeers =
      appPortId && (inverted.get(appPortId) || []).length > 1
        ? (inverted.get(appPortId) || []).filter((s) => s !== landingSlug)
        : [];

    rows.push({
      landing_slug: landingSlug,
      name: entry.name,
      country: entry.country,
      region: entry.region,
      qa_verdict: entry.qa_verdict,
      research_status: entry.research_status || null,
      sha256: entry.sha256,
      in_app_cruise_dataset: inAppDataset,
      seo_redirect_target: redirectTarget,
      collision_group: collisionGroupForSlug(landingSlug),
      app_port_id: appPortId || null,
      country_id: countryId,
      review_key: reviewKey || null,
      identifier_status: status,
      resolution_method: method || null,
      resolution_evidence: evidence,
      multi_slug_app_port_id_peers: multiSlugPeers,
      has_public_port_guide: hasPublicGuide,
      publishable_research_import:
        entry.qa_verdict === 'PASS' &&
        Boolean(appPortId) &&
        status !== 'unresolved' &&
        hasPublicGuide,
      import_blockers: [
        ...(entry.qa_verdict === 'BLOCKED' ? ['qa_blocked'] : []),
        ...(!appPortId ? ['missing_app_port_id'] : []),
        ...(status === 'unresolved' ? ['identifier_unresolved'] : []),
        ...(appPortId && !hasPublicGuide ? ['missing_public_guide_entry'] : []),
        ...(entry.research_status === 'needs_review' ? ['research_status_needs_review'] : []),
      ],
    });
  }

  const summary = {
    generated_at: new Date().toISOString(),
    research_root: researchRoot,
    landing_repo: landingRoot,
    app_repo: appRoot,
    total: rows.length,
    resolved: rows.filter((r) => r.identifier_status === 'resolved').length,
    inferred: rows.filter((r) => r.identifier_status === 'inferred').length,
    unresolved: rows.filter((r) => r.identifier_status === 'unresolved').length,
    qa_pass: rows.filter((r) => r.qa_verdict === 'PASS').length,
    qa_blocked: rows.filter((r) => r.qa_verdict === 'BLOCKED').length,
    publishable_flag_true: rows.filter((r) => r.publishable_research_import).length,
  };

  const collisions = {
    duplicate_gateway_pairs: DUPLICATE_GATEWAY_PAIRS,
    multi_slug_app_port_ids: KNOWN_MULTI_SLUG_APP_IDS.map((id) => ({
      app_port_id: id,
      landing_slugs: inverted.get(id) || [],
    })),
    ambiguous_inferred: rows.filter(
      (r) => r.identifier_status === 'inferred' && (r.multi_slug_app_port_id_peers || []).length > 0
    ),
  };

  return { meta: summary, collisions, ports: rows };
}

function writeManifest(landingRoot, payload) {
  const outPath = path.join(landingRoot, 'data', 'port-identifier-manifest.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return outPath;
}

module.exports = {
  buildPortIdentifierManifest,
  writeManifest,
  loadResearchIndex,
};

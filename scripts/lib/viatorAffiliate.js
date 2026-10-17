'use strict';

const fs = require('fs');
const path = require('path');
const { resolveAppRepoRoot } = require('./resolveAppRepoRoot');

/**
 * Mirrors app `src/utils/affiliate/providers.ts` destination URL builder.
 * Website uses the same Viator search deep-link shape; credentials come from
 * build/server env (never invent a second affiliate system).
 */

function sanitizeCampaignToken(value, maxLen) {
  return (
    String(value || '')
      .toLowerCase()
      .replace(/[^a-z0-9-]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, maxLen) || 'x'
  );
}

function destinationLabelFromPortId(portId) {
  return String(portId || '')
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function loadKnownAffiliatePortIds(appRoot) {
  const root = appRoot || resolveAppRepoRoot();
  const candidates = [
    // Website-vendored copy — required for GitHub Actions (no mobile app checkout)
    path.join(process.cwd(), 'data', 'known-affiliate-port-ids.json'),
    path.join(__dirname, '..', '..', 'data', 'known-affiliate-port-ids.json'),
    path.join(root, 'src', 'utils', 'affiliate', 'knownPortIds.json'),
  ];
  for (const jsonPath of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (Array.isArray(raw) && raw.length) {
        return new Set(raw.map((x) => String(x).toLowerCase()));
      }
    } catch {
      // try next
    }
  }
  return new Set();
}

function isKnownAffiliatePortId(portId, knownSet) {
  return knownSet.has(String(portId || '').trim().toLowerCase());
}

function getViatorConfigFromEnv() {
  const pid = String(process.env.VIATOR_AFFILIATE_PID || '').trim();
  const mcid = String(process.env.VIATOR_AFFILIATE_MCID || '').trim();
  const medium = String(process.env.VIATOR_AFFILIATE_MEDIUM || 'link').trim() || 'link';
  const configured =
    pid.length >= 3 &&
    mcid.length >= 1 &&
    !pid.includes('YOUR_') &&
    !mcid.includes('YOUR_');
  return { pid, mcid, medium, configured };
}

function buildViatorDestinationUrl(params) {
  const pid = String(params.pid || '').trim();
  const mcid = String(params.mcid || '').trim();
  const medium = String(params.medium || 'link').trim() || 'link';
  const campaign = String(params.campaign || '').trim();
  const destinationLabel = String(params.destinationLabel || '').trim();
  if (!pid || !mcid || pid.includes('YOUR_') || mcid.includes('YOUR_')) {
    return { ok: false, code: 'not_configured' };
  }
  if (!/^[a-zA-Z0-9-]+$/.test(campaign)) {
    return { ok: false, code: 'invalid_input' };
  }
  if (!destinationLabel) return { ok: false, code: 'invalid_input' };
  const q = new URLSearchParams();
  q.set('text', destinationLabel);
  q.set('pid', pid);
  q.set('mcid', mcid);
  q.set('medium', medium);
  q.set('campaign', campaign);
  return { ok: true, url: `https://www.viator.com/searchResults/all?${q.toString()}` };
}

/**
 * Map website slug / port name → app affiliate portId when possible.
 */
function resolveAffiliatePortId(port, slugToAppPortId) {
  const slug = String(port?.slug || '').trim().toLowerCase();
  if (slugToAppPortId && slugToAppPortId[slug]) return String(slugToAppPortId[slug]).toLowerCase();
  const id = String(port?.appPortId || port?.id || '').trim().toLowerCase();
  if (id && !id.includes('--')) return id.split('-germany')[0] || id;
  const name = String(port?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return name;
}

function buildWebAffiliateCampaign(portId) {
  const port = sanitizeCampaignToken(portId, 40);
  return `seadays-web-p${port}`.slice(0, 200);
}

function buildWebSearchCampaign(portId) {
  const port = sanitizeCampaignToken(portId, 40);
  return `seadays-web-s${port}`.slice(0, 200);
}

const PRIVATE_ISLAND_NAME_RE =
  /\b(perfect day at cococay|castaway cay|half moon cay|great stirrup cay|ocean cay|labadee)\b/i;

function loadViatorSearchOverrides() {
  const candidates = [
    path.join(process.cwd(), 'data', 'viator-search-overrides.json'),
    path.join(__dirname, '..', '..', 'data', 'viator-search-overrides.json'),
  ];
  for (const jsonPath of candidates) {
    try {
      const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
    } catch {
      // try next
    }
  }
  return {};
}

/**
 * Search text for a Viator deep link.
 * "City (Port)" keeps the tourist city outside the brackets.
 * "A/B (C)" keeps the first city. State codes and a few port-name suffixes drop.
 */
function cleanViatorSearchTerm(name) {
  let s = String(name || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return '';
  const wrapped = s.match(/^(.+?)\s*\([^)]*\)\s*$/);
  if (wrapped) s = wrapped[1].trim();
  else s = s.replace(/\s*\([^)]*\)/g, ' ').trim();
  if (s.includes('/')) s = s.split('/')[0].trim();
  s = s.replace(/,\s*[A-Z]{2}\s*$/g, '').trim();
  s = s.replace(
    /,\s*(United States|United Kingdom|United Arab Emirates|USA|Canada|Spain|Italy|France|Greece|Turkey|Norway|Germany|Portugal|Japan|Australia|New Zealand|Mexico|Bahamas|Jamaica|Croatia|Denmark|Sweden|Finland|Iceland|Netherlands|Ireland|Brazil|Argentina|Egypt|Israel|Thailand|Vietnam|Singapore|Hong Kong)\s*$/i,
    ''
  ).trim();
  s = s
    .replace(/\bCruise Terminal\b/gi, '')
    .replace(/\bIslamic Port\b/gi, '')
    .replace(/\bReserve\b/gi, '')
    .replace(/\bMSC\b/g, '');
  return s.replace(/\s+/g, ' ').replace(/^[,.\s]+|[,.\s]+$/g, '').trim();
}

function lookupSearchOverride(port, overrides) {
  const slug = String(port?.slug || '')
    .trim()
    .toLowerCase();
  if (slug && Object.prototype.hasOwnProperty.call(overrides, slug)) return overrides[slug];
  return undefined;
}

/**
 * @returns {{ show: boolean, url: string|null, destinationLabel: string, portId: string, reason: string, mode?: string, privateIsland?: boolean }}
 */
function resolvePortAffiliateCta(port, opts = {}) {
  const known = opts.knownPortIds || loadKnownAffiliatePortIds(opts.appRoot);
  const portId = resolveAffiliatePortId(port, opts.slugToAppPortId);
  const overrides = opts.searchOverrides || loadViatorSearchOverrides();
  const override = lookupSearchOverride(port, overrides);
  const rawLabel =
    opts.destinationLabel ||
    (port?.name ? String(port.name).trim() : '') ||
    destinationLabelFromPortId(portId);
  const privateByName = PRIVATE_ISLAND_NAME_RE.test(rawLabel) || PRIVATE_ISLAND_NAME_RE.test(port?.name || '');
  if (override === null || (override === undefined && privateByName)) {
    return {
      show: false,
      url: null,
      destinationLabel: '',
      portId,
      reason: 'private_island',
      privateIsland: true,
      mode: 'private_island',
    };
  }
  const destinationLabel =
    (typeof override === 'string' && override.trim()) || cleanViatorSearchTerm(rawLabel) || cleanViatorSearchTerm(port?.name);
  if (!destinationLabel) {
    return { show: false, url: null, destinationLabel: '', portId, reason: 'invalid_input' };
  }
  const knownPort = isKnownAffiliatePortId(portId, known);
  const mode = knownPort ? 'known' : 'search';
  const config = opts.config || getViatorConfigFromEnv();
  if (!config.configured) {
    return { show: true, url: null, destinationLabel, portId, reason: 'not_configured', mode };
  }
  const campaign = knownPort ? buildWebAffiliateCampaign(portId) : buildWebSearchCampaign(portId);
  const built = buildViatorDestinationUrl({
    pid: config.pid,
    mcid: config.mcid,
    medium: config.medium,
    destinationLabel,
    campaign,
  });
  if (!built.ok) {
    return { show: true, url: null, destinationLabel, portId, reason: built.code, mode };
  }
  return { show: true, url: built.url, destinationLabel, portId, reason: 'ok', mode };
}

module.exports = {
  sanitizeCampaignToken,
  destinationLabelFromPortId,
  loadKnownAffiliatePortIds,
  isKnownAffiliatePortId,
  getViatorConfigFromEnv,
  buildViatorDestinationUrl,
  resolveAffiliatePortId,
  buildWebAffiliateCampaign,
  buildWebSearchCampaign,
  cleanViatorSearchTerm,
  loadViatorSearchOverrides,
  resolvePortAffiliateCta,
};

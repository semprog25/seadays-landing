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
  const jsonPath = path.join(root, 'src/utils/affiliate/knownPortIds.json');
  try {
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    if (Array.isArray(raw)) return new Set(raw.map((x) => String(x).toLowerCase()));
  } catch {
    // fall through
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

/**
 * @returns {{ show: boolean, url: string|null, destinationLabel: string, portId: string, reason: string }}
 */
function resolvePortAffiliateCta(port, opts = {}) {
  const known = opts.knownPortIds || loadKnownAffiliatePortIds(opts.appRoot);
  const portId = resolveAffiliatePortId(port, opts.slugToAppPortId);
  const destinationLabel =
    opts.destinationLabel ||
    (port?.name ? String(port.name).trim() : '') ||
    destinationLabelFromPortId(portId);
  if (!isKnownAffiliatePortId(portId, known)) {
    return { show: false, url: null, destinationLabel, portId, reason: 'unknown_port' };
  }
  const config = opts.config || getViatorConfigFromEnv();
  if (!config.configured) {
    return { show: true, url: null, destinationLabel, portId, reason: 'not_configured' };
  }
  const campaign = buildWebAffiliateCampaign(portId);
  const built = buildViatorDestinationUrl({
    pid: config.pid,
    mcid: config.mcid,
    medium: config.medium,
    destinationLabel,
    campaign,
  });
  if (!built.ok) {
    return { show: true, url: null, destinationLabel, portId, reason: built.code };
  }
  return { show: true, url: built.url, destinationLabel, portId, reason: 'ok' };
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
  resolvePortAffiliateCta,
};

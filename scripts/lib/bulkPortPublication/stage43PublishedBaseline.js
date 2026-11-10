'use strict';

const fs = require('fs');
const path = require('path');

const PRODUCTION_BASELINE_SHA = 'f3b05d0bf4dcf2ab7b77ebdcb5900c99ec328618';
const STAGE28_BUNDLE = '50f0af8831cb3a709bc325d896e7e54fdb34efa7afc4820ff76ebefaa6b759ad';

const STAGE25_PUBLISHED = [
  'abu-dhabi-united-arab-emirates',
  'argostoli-greece',
  'ashdod-israel',
  'bergen-norway',
  'bremerhaven-germany',
  'brest-france',
  'doha-qatar',
  'dubai-united-arab-emirates',
  'falmouth-united-kingdom',
  'flam-norway',
  'gran-canaria-spain',
  'kochi-india',
  'leknes-norway',
  'los-angeles-ca-united-states',
  'stavanger-norway',
  'zadar-croatia',
];

/** Immutable historical ledger — includes all Stage 33/43 policy holds. */
const STAGE43_HARD_EXCLUDE_HISTORICAL = new Set([
  'eilat-israel',
  'haifa-israel',
  'colombo-sri-lanka',
  'bod-norway',
  'venice-ravenna-trieste-italy',
  'ravenna-italy',
  'trieste-italy',
  'doha-cruise-terminal-qatar',
  'dubai-cruise-terminal-united-arab-emirates',
  'port-of-haifa-israel',
  'port-of-ashdod-israel',
  'port-zayed-abu-dhabi-united-arab-emirates',
  'mormugao-port-goa-india',
  'mumbai-india',
  'goa-india',
]);

/**
 * Stage 60 owner exception: trieste-italy only (APPROVE WITH CONDITIONS).
 * See STAGE60_TRIESTE_POLICY_CLEARANCE.json — not a global policy wipe.
 */
const STAGE60_OWNER_POLICY_EXCEPTION_SLUGS = new Set(['trieste-italy']);

/**
 * Stage 89 Bodø conditional candidate — local prep/tests only when
 * `SEADAYS_STAGE89_BODO_CANDIDATE=1`. Not publication authorization; historical ledger unchanged.
 * See qa-evidence/stage89-bodo-candidate/STAGE89_POLICY_CLEARANCE.json
 */
const STAGE89_CONDITIONAL_CANDIDATE_SLUGS = new Set(['bod-norway']);

function buildStage89ConditionalActiveSlugs() {
  if (process.env.SEADAYS_STAGE89_BODO_CANDIDATE !== '1') return new Set();
  return STAGE89_CONDITIONAL_CANDIDATE_SLUGS;
}

function buildActiveHardExclude() {
  const active = new Set(STAGE43_HARD_EXCLUDE_HISTORICAL);
  for (const slug of STAGE60_OWNER_POLICY_EXCEPTION_SLUGS) active.delete(slug);
  for (const slug of buildStage89ConditionalActiveSlugs()) active.delete(slug);
  return active;
}

const STAGE43_HARD_EXCLUDE = buildActiveHardExclude();

function loadJson(repoRoot, rel) {
  const p = path.join(repoRoot, rel);
  if (!fs.existsSync(p)) return null;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function loadProductionGuides(repoRoot) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, 'data', 'public-port-guides.json'), 'utf8'));
}

function buildPublishedSlugSet(repoRoot) {
  const slugs = new Set(STAGE25_PUBLISHED);
  const s29 = loadJson(repoRoot, 'qa-evidence/stage29-25-port-release/STAGE29_LOCKED_COHORT.json');
  if (s29?.picked) s29.picked.forEach((r) => slugs.add(r.landing_slug));
  const s34 = loadJson(repoRoot, 'qa-evidence/stage34-14-port-release/STAGE34_LOCKED_COHORT.json');
  if (s34?.locked_slugs) s34.locked_slugs.forEach((s) => slugs.add(s));
  const guides = loadProductionGuides(repoRoot);
  const { usesPassengerEditorialLead } = require('../publicGuideCopySanitize');
  for (const g of Object.values(guides.byAppPortId || {})) {
    const slug = g.researchImport?.landing_slug;
    if (slug && usesPassengerEditorialLead(g)) slugs.add(slug);
  }
  return slugs;
}

function exclusionReasonForSlug(slug, publishedSet) {
  if (publishedSet.has(slug)) return 'already_published_passenger_editorial';
  if (STAGE43_HARD_EXCLUDE.has(slug)) return 'stage43_hard_exclude';
  if (
    STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug) &&
    STAGE60_OWNER_POLICY_EXCEPTION_SLUGS.has(slug)
  ) {
    return 'stage60_owner_policy_exception';
  }
  if (
    STAGE43_HARD_EXCLUDE_HISTORICAL.has(slug) &&
    buildStage89ConditionalActiveSlugs().has(slug)
  ) {
    return 'stage89_conditional_candidate_only';
  }
  return null;
}

module.exports = {
  PRODUCTION_BASELINE_SHA,
  STAGE28_BUNDLE,
  STAGE25_PUBLISHED,
  STAGE43_HARD_EXCLUDE,
  STAGE43_HARD_EXCLUDE_HISTORICAL,
  STAGE60_OWNER_POLICY_EXCEPTION_SLUGS,
  STAGE89_CONDITIONAL_CANDIDATE_SLUGS,
  buildPublishedSlugSet,
  exclusionReasonForSlug,
  loadProductionGuides,
};

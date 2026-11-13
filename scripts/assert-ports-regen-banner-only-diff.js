#!/usr/bin/env node
'use strict';

/**
 * Fail-closed guard: after ports generation, ensure working-tree port HTML differs
 * from SOURCE_SHA only inside #bookable-experiences, with stable Viator attribution.
 *
 * Activation (SEADAYS_PORTS_REGEN_DIFF_GATE):
 *   off         — no-op (default)
 *   auto        — banner-only when push diff is within the Viator copy-release allowlist
 *   banner-only — always enforce
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const {
  BOOKABLE_SECTION_RE,
  extractBookableExperiencesSection,
  sectionHasViatorAffiliate,
} = require('./lib/publishedPortHtmlPreserve');

const FAQ_PAGE_LD_SCRIPT_RE =
  /<script type="application\/ld\+json">[\s\S]*?"@type"\s*:\s*"FAQPage"[\s\S]*?<\/script>/gi;
const TRAVELER_QUESTIONS_SECTION_RE =
  /<section class="pg-section" id="traveler-questions"[\s\S]*?<\/section>/i;

const SENTINEL = '<!-- SEADAYS_BOOKABLE_EXPERIENCES_SENTINEL -->';
const PORT_GUIDE_SECTIONS_FILE = 'scripts/lib/portGuideSections.js';
/** PR #124 and equivalent copy-only releases (must include portGuideSections.js). */
const BANNER_COPY_RELEASE_ALLOWLIST = new Set([
  PORT_GUIDE_SECTIONS_FILE,
  'scripts/lib/publishGate.js',
  'scripts/test-ports-phase1.js',
]);
/** Post–PR #124 recovery: scope-fix push when neutral banner is already on main. */
const VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST = new Set([
  'scripts/generateBlogs.js',
  'scripts/ci-run-channel.sh',
  'scripts/apply-publish-gate.js',
  'scripts/lib/portsRegenScope.js',
  'scripts/lib/ciClassifyGeneration.js',
  'scripts/lib/publishedPortHtmlPreserve.js',
  'scripts/assert-ports-regen-banner-only-diff.js',
  '.github/workflows/generate-ports.yml',
  'scripts/test-ports-regen-banner-only-diff.js',
  'scripts/test-ports-regen-banner-scope.js',
  'scripts/test-ci-classify-generation.js',
  'scripts/test-mormugao-approved-meta-regen.js',
  'scripts/test-batch02-mormugao-publication-release.js',
  'scripts/test-published-port-html-preserve.js',
  '.github/workflows/generate-ports.yml',
]);

function isViatorRegenRecoveryScopeFile(filePath) {
  return VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST.has(filePath);
}

function viatorNeutralBannerCopyOnHead() {
  try {
    const headRoot = path.resolve(process.env.PORTS_REGEN_GATE_REPO_ROOT || path.join(__dirname, '..'));
    const content = execFileSync('git', ['show', `HEAD:${PORT_GUIDE_SECTIONS_FILE}`], {
      cwd: headRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return content.includes('Explore Shore Experiences');
  } catch {
    return false;
  }
}
const VIATOR_QUERY_KEYS = ['text', 'pid', 'mcid', 'medium', 'campaign'];
const PRIVATE_ISLAND_MARKERS = [
  /Excursions are sold by your cruise line/i,
  /id="bookable-experiences"[\s\S]*Shore excursions/i,
];

const root = path.resolve(process.env.PORTS_REGEN_GATE_REPO_ROOT || path.join(__dirname, '..'));

function gateError(message) {
  const err = new Error(message);
  err.code = 'PORTS_REGEN_GATE';
  return err;
}

function fail(message) {
  console.error(`[ports-regen-gate] ${message}`);
  process.exit(1);
}

function runGit(args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

function decodeHtmlAttrUrl(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"');
}

function extractViatorHrefs(sectionHtml) {
  return [...String(sectionHtml || '').matchAll(/href="(https:\/\/www\.viator\.com[^"]+)"/gi)].map((m) =>
    decodeHtmlAttrUrl(m[1])
  );
}

function viatorSearchParams(href) {
  try {
    const url = new URL(href);
    const out = {};
    for (const key of VIATOR_QUERY_KEYS) {
      out[key] = url.searchParams.get(key) || '';
    }
    return out;
  } catch {
    return null;
  }
}

function assertViatorParamsUnchanged(beforeSection, afterSection, slug) {
  const beforeHrefs = extractViatorHrefs(beforeSection);
  const afterHrefs = extractViatorHrefs(afterSection);
  if (beforeHrefs.length === 0 && afterHrefs.length === 0) return;
  if (beforeHrefs.length !== afterHrefs.length) {
    throw gateError(`${slug}: Viator link count changed (${beforeHrefs.length} → ${afterHrefs.length})`);
  }
  for (let i = 0; i < beforeHrefs.length; i++) {
    const b = viatorSearchParams(beforeHrefs[i]);
    const a = viatorSearchParams(afterHrefs[i]);
    if (!b || !a) throw gateError(`${slug}: invalid Viator URL`);
    for (const key of VIATOR_QUERY_KEYS) {
      if (b[key] !== a[key]) {
        throw gateError(`${slug}: Viator param "${key}" changed (${b[key]} → ${a[key]})`);
      }
    }
    const bUrl = new URL(beforeHrefs[i]);
    const aUrl = new URL(afterHrefs[i]);
    if (bUrl.origin !== aUrl.origin || bUrl.pathname !== aUrl.pathname) {
      throw gateError(`${slug}: Viator host/path changed`);
    }
  }
}

function countBookableSections(html) {
  const re = new RegExp(BOOKABLE_SECTION_RE.source, BOOKABLE_SECTION_RE.flags);
  return (String(html || '').match(re) || []).length;
}

function stripBookableSection(html) {
  const text = String(html || '');
  const count = countBookableSections(text);
  if (count > 1) {
    return { ok: false, reason: 'duplicate bookable-experiences sections' };
  }
  if (count === 0) {
    return { ok: true, stripped: text, section: '', hadSection: false };
  }
  const section = extractBookableExperiencesSection(text);
  if (!section) {
    return { ok: false, reason: 'ambiguous bookable-experiences boundary' };
  }
  const stripped = text.replace(BOOKABLE_SECTION_RE, SENTINEL);
  if (stripped.includes('id="bookable-experiences"')) {
    return { ok: false, reason: 'bookable section replacement incomplete' };
  }
  return { ok: true, stripped, section, hadSection: true };
}

function isPrivateIslandBookableSection(sectionHtml) {
  const s = String(sectionHtml || '');
  if (sectionHasViatorAffiliate(s)) return false;
  return PRIVATE_ISLAND_MARKERS.some((re) => re.test(s));
}

function assertPrivateIslandPolicy(beforeSection, afterSection, slug) {
  const beforePrivate = isPrivateIslandBookableSection(beforeSection);
  const afterPrivate = isPrivateIslandBookableSection(afterSection);
  if (beforePrivate !== afterPrivate) {
    throw gateError(`${slug}: private-island bookable policy changed`);
  }
  if (beforePrivate && afterSection !== beforeSection) {
    throw gateError(`${slug}: private-island bookable section must not change during banner-only regen`);
  }
}

function assertApprovedBannerCopy(beforeSection, afterSection, slug) {
  if (afterSection.includes('Top Rated Experiences')) {
    throw gateError(`${slug}: unsupported "Top Rated Experiences" remains in generated banner`);
  }
  assertPrivateIslandPolicy(beforeSection, afterSection, slug);
  assertViatorParamsUnchanged(beforeSection, afterSection, slug);
}

function isFaqCohortPortIndexPath(filePath) {
  return /^ports\/[^/]+\/index\.html$/.test(String(filePath || ''));
}

function htmlWithFaqPublicationBlocksStripped(html) {
  let h = String(html || '');
  h = h.replace(FAQ_PAGE_LD_SCRIPT_RE, '');
  h = h.replace(TRAVELER_QUESTIONS_SECTION_RE, '');
  return h;
}

function isFaqCohortPortGuideSectionsDiffLine(body) {
  const line = String(body || '').trim();
  if (!line) return true;
  if (/^const BATCH\d+_FAQ_DISTANCE_COPY = \{/.test(line)) return true;
  if (line === '};') return true;
  if (/^'[a-z0-9]+(?:-[a-z0-9]+)*':$/.test(line)) return true;
  if (/^'[^']*',?$/.test(line)) return true;
  if (/^\(portSlug && BATCH\d+_FAQ_DISTANCE_COPY\[portSlug\]\) \|\|$/.test(line)) return true;
  if (/^\(BATCH\d+_FAQ_DISTANCE_COPY\[portSlug\] \|\|$/.test(line)) return true;
  if (/^BATCH\d+_FAQ_DISTANCE_COPY\[portSlug\] \|\|$/.test(line)) return true;
  return false;
}

function assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly(unifiedDiff) {
  const lines = String(unifiedDiff || '')
    .split('\n')
    .filter((l) => (l.startsWith('+') || l.startsWith('-')) && !l.startsWith('+++') && !l.startsWith('---'));
  for (const raw of lines) {
    const body = raw.slice(1);
    if (isFaqCohortPortGuideSectionsDiffLine(body)) continue;
    throw new Error(
      `[ci-classify] FAQ cohort push changed portGuideSections.js outside FAQ overrides: ${body.trim().slice(0, 96)}`,
    );
  }
}

function assertPortGuideSectionsFaqCohortDiffOnly(beforeSha, headSha) {
  const rootDir = path.resolve(process.env.PORTS_REGEN_GATE_REPO_ROOT || path.join(__dirname, '..'));
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', beforeSha, headSha, '--', PORT_GUIDE_SECTIONS_FILE], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    throw new Error(
      `[ci-classify] FAQ cohort portGuideSections.js diff unavailable (fail closed): ${err.message || err}`,
    );
  }
  assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly(diff);
}

function gitShowPortFileAtRef(rootDir, ref, filePath) {
  try {
    return execFileSync('git', ['show', `${ref}:${filePath}`], {
      cwd: rootDir,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return null;
  }
}

/** Fail closed when a FAQ-cohort push edits hero, robots, attribution, or other non-FAQ HTML. */
function assertFaqCohortPushTouchesFaqBlocksOnly(portIndexFiles, beforeSha, headSha) {
  const rootDir = path.resolve(process.env.PORTS_REGEN_GATE_REPO_ROOT || path.join(__dirname, '..'));
  for (const rel of portIndexFiles) {
    if (!isFaqCohortPortIndexPath(rel)) continue;
    const before = gitShowPortFileAtRef(rootDir, beforeSha, rel);
    const after = gitShowPortFileAtRef(rootDir, headSha, rel);
    if (!before || !after) {
      throw new Error(
        `[ci-classify] FAQ cohort push cannot read ${rel} at before/after SHAs (fail closed)`,
      );
    }
    if (htmlWithFaqPublicationBlocksStripped(before) !== htmlWithFaqPublicationBlocksStripped(after)) {
      throw new Error(
        `[ci-classify] FAQ cohort push must not change port HTML outside FAQ blocks: ${rel}`,
      );
    }
  }
}

function resolveGateModeFromPushFiles(files) {
  const list = Array.isArray(files) ? files.map(String).filter(Boolean) : [];
  if (!list.length) return 'off';
  const hasPortGuideSections = list.includes(PORT_GUIDE_SECTIONS_FILE);
  const unexpectedCopy = list.filter((f) => !BANNER_COPY_RELEASE_ALLOWLIST.has(f));
  if (hasPortGuideSections && unexpectedCopy.length > 0) {
    if (unexpectedCopy.every(isFaqCohortPortIndexPath)) return 'faq-cohort';
    return 'block';
  }
  if (hasPortGuideSections && unexpectedCopy.length === 0) return 'banner-only';
  if (!hasPortGuideSections && viatorNeutralBannerCopyOnHead()) {
    if (list.every(isViatorRegenRecoveryScopeFile)) return 'banner-only';
    const hasRecoveryFile = list.some(isViatorRegenRecoveryScopeFile);
    const outsideRecovery = list.filter((f) => !isViatorRegenRecoveryScopeFile(f));
    if (hasRecoveryFile && outsideRecovery.length > 0) return 'block';
  }
  return 'off';
}

function resolveGateMode() {
  const raw = String(process.env.SEADAYS_PORTS_REGEN_DIFF_GATE || 'off')
    .trim()
    .toLowerCase();
  if (raw === 'banner-only') return 'banner-only';
  if (raw === 'off') return 'off';
  if (raw !== 'auto') {
    fail(`invalid SEADAYS_PORTS_REGEN_DIFF_GATE="${raw}"`);
  }
  const eventName = String(process.env.GITHUB_EVENT_NAME || 'push').trim();
  if (eventName === 'workflow_dispatch') {
    console.log('[ports-regen-gate] auto mode: workflow_dispatch — gate off');
    return 'off';
  }
  const before = String(process.env.GITHUB_EVENT_BEFORE || '').trim();
  const sha = String(process.env.SOURCE_SHA || '').trim();
  if (!before || /^0+$/.test(before)) {
    fail('auto mode on push: missing or zero GITHUB_EVENT_BEFORE (fail closed)');
  }
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
    fail('auto mode on push: missing or invalid SOURCE_SHA (fail closed)');
  }
  let files = [];
  try {
    files = runGit(['diff', '--name-only', `${before}...${sha}`])
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (err) {
    fail(`auto mode: cannot diff push range: ${err.message || err}`);
  }
  const mode = resolveGateModeFromPushFiles(files);
  if (mode === 'block') {
    const unexpected = files.filter((f) => !BANNER_COPY_RELEASE_ALLOWLIST.has(f));
    fail(
      `auto mode: portGuideSections.js in push with unexpected files (fail closed): ${unexpected.join(', ')}`
    );
  }
  if (mode === 'banner-only') {
    console.log(`[ports-regen-gate] auto mode: banner-only (${files.join(', ')})`);
  } else if (files.length) {
    console.log(`[ports-regen-gate] auto mode: off (push files: ${files.join(', ')})`);
  } else {
    console.log('[ports-regen-gate] auto mode: empty push diff — gate off');
  }
  return mode;
}

function gitShowAtRef(ref, filePath) {
  try {
    return runGit(['show', `${ref}:${filePath}`]);
  } catch {
    return null;
  }
}

function listChangedPortIndexFiles(baseSha) {
  const names = runGit(['diff', '--name-only', baseSha, '--', 'ports/'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  return names;
}

function assertNoChangesOutsidePorts(baseSha) {
  const all = runGit(['diff', '--name-only', baseSha, '--'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const outside = all.filter((f) => !f.startsWith('ports/') && f !== 'ports');
  if (outside.length) {
    throw gateError(
      `changes outside ports/: ${outside.slice(0, 8).join(', ')}${outside.length > 8 ? '…' : ''}`
    );
  }
}

function runBannerOnlyGate(baseSha) {
  assertNoChangesOutsidePorts(baseSha);

  const deleted = runGit(['diff', '--name-only', '--diff-filter=D', baseSha, '--', 'ports/'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (deleted.length) {
    throw gateError(`deleted port paths: ${deleted.slice(0, 5).join(', ')}`);
  }

  const added = runGit(['diff', '--name-only', '--diff-filter=A', baseSha, '--', 'ports/'])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const addedHtml = added.filter((p) => /\/index\.html$/.test(p));
  if (addedHtml.length) {
    throw gateError(`new port HTML: ${addedHtml.slice(0, 5).join(', ')}`);
  }

  const changed = listChangedPortIndexFiles(baseSha).filter((p) => /ports\/[^/]+\/index\.html$/.test(p));
  if (!changed.length) {
    console.log('[ports-regen-gate] no port index.html changes — OK');
    return;
  }

  for (const rel of changed) {
    const beforeHtml = gitShowAtRef(baseSha, rel);
    if (beforeHtml == null) {
      throw gateError(`${rel}: missing at SOURCE_SHA (new file)`);
    }
    const afterPath = path.join(root, rel);
    if (!fs.existsSync(afterPath)) {
      throw gateError(`${rel}: missing in working tree after generation`);
    }
    const afterHtml = fs.readFileSync(afterPath, 'utf8');
    const slug = path.basename(path.dirname(rel));

    const beforeStrip = stripBookableSection(beforeHtml);
    const afterStrip = stripBookableSection(afterHtml);
    if (!beforeStrip.ok) throw gateError(`${slug}: ${beforeStrip.reason}`);
    if (!afterStrip.ok) throw gateError(`${slug}: ${afterStrip.reason}`);

    if (beforeStrip.hadSection !== afterStrip.hadSection) {
      throw gateError(`${slug}: bookable section presence changed`);
    }

    if (beforeStrip.stripped !== afterStrip.stripped) {
      throw gateError(`${slug}: HTML changed outside #bookable-experiences`);
    }

    if (beforeStrip.section !== afterStrip.section) {
      assertApprovedBannerCopy(beforeStrip.section, afterStrip.section, slug);
    }
  }

  console.log(`[ports-regen-gate] banner-only OK (${changed.length} port page(s))`);
}

function main() {
  const baseSha = String(process.env.SOURCE_SHA || '').trim();
  if (!baseSha || !/^[0-9a-f]{7,40}$/i.test(baseSha)) {
    fail('SOURCE_SHA missing or invalid (fail closed)');
  }
  try {
    runGit(['cat-file', '-e', `${baseSha}^{commit}`]);
  } catch {
    fail(`SOURCE_SHA not found in repository: ${baseSha}`);
  }

  const mode = resolveGateMode();
  if (mode === 'off') {
    console.log('[ports-regen-gate] skipped (mode=off)');
    return;
  }
  try {
    runBannerOnlyGate(baseSha);
  } catch (err) {
    fail(err.message || String(err));
  }
}

module.exports = {
  SENTINEL,
  stripBookableSection,
  assertApprovedBannerCopy,
  assertViatorParamsUnchanged,
  resolveGateMode,
  resolveGateModeFromPushFiles,
  isFaqCohortPortIndexPath,
  assertFaqCohortPushTouchesFaqBlocksOnly,
  assertPortGuideSectionsFaqCohortDiffOnly,
  assertPortGuideSectionsUnifiedDiffIsFaqCohortOnly,
  htmlWithFaqPublicationBlocksStripped,
  BANNER_COPY_RELEASE_ALLOWLIST,
  VIATOR_REGEN_RECOVERY_PUSH_ALLOWLIST,
  viatorNeutralBannerCopyOnHead,
  PORT_GUIDE_SECTIONS_FILE,
  runBannerOnlyGate,
  decodeHtmlAttrUrl,
  viatorSearchParams,
};

if (require.main === module) main();

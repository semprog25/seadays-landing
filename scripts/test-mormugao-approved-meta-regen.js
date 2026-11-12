#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { buildPortDetailHtml, buildSeoPortRecords } = require('./lib/seoShipPortPages');
const { loadPublicPortGuidesFile } = require('./lib/publicPortGuideAdapter');
const {
  loadLandingCruiseContentOverrides,
  applyPortContentOverride,
} = require('./lib/landingCruiseContentOverrides');
const {
  mergePublishedPortHtmlPreservation,
  dedupePortDetailHeadJsonLd,
  extractSiteShellHeadStyleBlock,
} = require('./lib/publishedPortHtmlPreserve');
const { stripBookableSection } = require('./assert-ports-regen-banner-only-diff');

const REPO = path.join(__dirname, '..');
const SLUG = 'mormugao-port-goa-india';
const APP_ID = 'mormugao';
const APPROVED_META =
  'Mormugao Port (Goa), India: cruise port overview and shore-day tips.';
const ENRICHED_SNIPPET = 'terminals, getting there, weather, and shore-day ideas';

function extractMetaDescription(html) {
  const m = String(html).match(/<meta name="description" content="([^"]+)"/i);
  return m ? m[1] : '';
}

function buildMormugaoPortRecord() {
  const overrides = loadLandingCruiseContentOverrides();
  const raw = {
    id: SLUG,
    slug: SLUG,
    portName: 'Mormugao Port (Goa)',
    country: 'India',
    region: '',
    description: '',
    highlights: [],
  };
  const [base] = buildSeoPortRecords([raw]);
  return applyPortContentOverride(base, overrides.ports[SLUG]);
}

function main() {
  const guides = loadPublicPortGuidesFile(REPO);
  const guide = guides.byAppPortId[APP_ID];
  assert.ok(guide, 'mormugao public port guide');
  assert.strictEqual(
    overridesMetaDescription(),
    APPROVED_META,
    'override file metaDescription'
  );

  const port = buildMormugaoPortRecord();
  assert.ok(port.hasContentOverride, 'content override applied');
  assert.strictEqual(port.metaDescription, APPROVED_META);

  const html = buildPortDetailHtml(port, [], [], [], {
    baseUrl: 'https://seadays.app',
    defaultImage: 'https://seadays.app/logo.png',
    indexStyles: '',
    runtimeGuardScript: '',
    repoRoot: REPO,
    portGuide: guide,
    portTerminals: [],
    affiliate: { show: false },
  });

  const meta = extractMetaDescription(html);
  assert.strictEqual(meta, APPROVED_META, 'meta name=description');
  assert.match(html, new RegExp(`property="og:description" content="${escapeRegex(APPROVED_META)}"`));
  assert.match(
    html,
    new RegExp(`property="twitter:description" content="${escapeRegex(APPROVED_META)}"`)
  );
  assert.doesNotMatch(html, new RegExp(ENRICHED_SNIPPET));

  const committedPath = path.join(REPO, 'ports', SLUG, 'index.html');
  const committedHtml = fs.readFileSync(committedPath, 'utf8');
  assert.strictEqual(extractMetaDescription(committedHtml), APPROVED_META, 'committed meta');

  const merged = dedupePortDetailHeadJsonLd(
    mergePublishedPortHtmlPreservation(html, committedHtml, {
      affiliate: { url: 'https://www.viator.com/searchResults/all?text=test' },
      portGuide: guide,
    })
  );
  assert.strictEqual(
    extractSiteShellHeadStyleBlock(merged),
    extractSiteShellHeadStyleBlock(committedHtml),
    'merge preserves published inline head styles through JSON-LD dedupe'
  );

  const rel = `ports/${SLUG}/index.html`;
  const beforeHtml = execFileSync('git', ['show', `HEAD:${rel}`], { cwd: REPO, encoding: 'utf8' });
  process.env.VIATOR_AFFILIATE_PID = process.env.VIATOR_AFFILIATE_PID || 'P00000000';
  process.env.VIATOR_AFFILIATE_MCID = process.env.VIATOR_AFFILIATE_MCID || 'M00000000';
  process.env.VIATOR_AFFILIATE_MEDIUM = process.env.VIATOR_AFFILIATE_MEDIUM || 'link';
  process.env.SEADAYS_APP_ROOT =
    process.env.SEADAYS_APP_ROOT || path.join(REPO, '..', 'Seadays-main');
  execFileSync('node', ['scripts/generateBlogs.js', '--ports-only', `--only=${SLUG}`], {
    cwd: REPO,
    env: process.env,
    stdio: 'pipe',
  });
  process.env.SEADAYS_HTML_POSTPROCESS_DIRS = 'ports';
  execFileSync('node', ['scripts/rewrite-download-ctas.js'], { cwd: REPO, env: process.env, stdio: 'pipe' });
  execFileSync('node', ['scripts/inject-analytics-head.js'], { cwd: REPO, env: process.env, stdio: 'pipe' });
  execFileSync('node', ['scripts/apply-publish-gate.js'], { cwd: REPO, env: process.env, stdio: 'pipe' });
  const regenHtml = fs.readFileSync(committedPath, 'utf8');
  const beforeStrip = stripBookableSection(beforeHtml);
  const afterStrip = stripBookableSection(regenHtml);
  assert.ok(beforeStrip.ok && afterStrip.ok, 'bookable strip ok');
  assert.strictEqual(
    beforeStrip.stripped,
    afterStrip.stripped,
    'CI-like regen non-banner byte parity'
  );
  execFileSync('git', ['checkout', '--', rel], { cwd: REPO });

  const istanbulPort = {
    slug: 'example-no-override',
    name: 'Example',
    country: 'Nowhere',
    region: '',
    highlights: [],
    description: 'A cruise port.',
  };
  const genericHtml = buildPortDetailHtml(istanbulPort, [], [], [], {
    baseUrl: 'https://seadays.app',
    defaultImage: 'https://seadays.app/logo.png',
    indexStyles: '',
    runtimeGuardScript: '',
    portGuide: { portInfo: { description: 'A working cruise port with berths and taxis.' } },
    portTerminals: [],
    affiliate: { show: false },
  });
  assert.match(genericHtml, new RegExp(ENRICHED_SNIPPET), 'generic enriched meta without override');

  assert.strictEqual(extractMetaDescription(beforeHtml), APPROVED_META, 'SOURCE_SHA committed meta');

  console.log('test-mormugao-approved-meta-regen PASS', { slug: SLUG, meta: APPROVED_META });
}

function overridesMetaDescription() {
  const overrides = loadLandingCruiseContentOverrides();
  return overrides.ports[SLUG]?.metaDescription || '';
}

function escapeRegex(text) {
  return String(text).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

main();

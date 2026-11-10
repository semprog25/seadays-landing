'use strict';

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { dedupePortDetailHeadJsonLd } = require('./lib/publishedPortHtmlPreserve');

const root = path.join(__dirname, '..');
const SLUGS = [
  'perfect-day-at-cococay-bahamas',
  'st-croix-frederiksted-us-virgin-islands',
  'st-kitts-basseterre-st-kitts',
  'svolv-r-norway',
];

function headJsonLdTypeCounts(html) {
  const head = (String(html).match(/<head\b[^>]*>[\s\S]*?<\/head>/i) || [''])[0];
  const counts = { TouristDestination: 0, BreadcrumbList: 0, FAQPage: 0 };
  const re = /<script\s+type=["']application\/ld\+json["']>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(head))) {
    try {
      const data = JSON.parse(m[1].trim());
      const type = data && data['@type'];
      if (type && Object.prototype.hasOwnProperty.call(counts, type)) counts[type] += 1;
    } catch {
      /* skip malformed */
    }
  }
  return counts;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

const regenEnv = {
  ...process.env,
  VIATOR_AFFILIATE_PID: process.env.VIATOR_AFFILIATE_PID || 'P00000000',
  VIATOR_AFFILIATE_MCID: process.env.VIATOR_AFFILIATE_MCID || 'M00000000',
  VIATOR_AFFILIATE_MEDIUM: process.env.VIATOR_AFFILIATE_MEDIUM || 'link',
};

for (const slug of SLUGS) {
  const portPath = path.join(root, 'ports', slug, 'index.html');
  assert.ok(fs.existsSync(portPath), `${slug} html exists`);

  const beforeDedupe = fs.readFileSync(portPath, 'utf8');
  const deduped = dedupePortDetailHeadJsonLd(beforeDedupe);
  const counts = headJsonLdTypeCounts(deduped);
  assert.ok(counts.TouristDestination <= 1, `${slug} TouristDestination count ${counts.TouristDestination}`);
  assert.ok(counts.BreadcrumbList <= 1, `${slug} BreadcrumbList count ${counts.BreadcrumbList}`);
  assert.ok(counts.FAQPage <= 1, `${slug} FAQPage count ${counts.FAQPage}`);

  const backup = beforeDedupe;
  try {
    execSync(`node scripts/generateBlogs.js --catalogue-only --only=${slug}`, {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 180000,
      env: regenEnv,
    });
    const afterFirst = fs.readFileSync(portPath, 'utf8');
    const afterFirstCounts = headJsonLdTypeCounts(afterFirst);
    assert.strictEqual(afterFirstCounts.TouristDestination, 1, `${slug} after regen 1 TouristDestination`);
    assert.strictEqual(afterFirstCounts.BreadcrumbList, 1, `${slug} after regen 1 BreadcrumbList`);

    const hashAfterFirst = sha256File(portPath);
    execSync(`node scripts/generateBlogs.js --catalogue-only --only=${slug}`, {
      cwd: root,
      stdio: 'pipe',
      encoding: 'utf8',
      timeout: 180000,
      env: regenEnv,
    });
    const hashAfterSecond = sha256File(portPath);
    assert.strictEqual(hashAfterSecond, hashAfterFirst, `${slug} second regen must not change HTML`);
  } finally {
    /* leave regen output; test runs in CI on clean tree */
  }
}

console.log('test-catalogue-regen-jsonld-idempotency: OK', { slugs: SLUGS.length });

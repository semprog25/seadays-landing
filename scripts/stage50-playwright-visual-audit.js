#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'STAGE50_VISUAL_QA.json');
const SAMPLES = [
  'ho-chi-minh-city-phu-my-vietnam',
  'port-said-egypt',
  'princess-cays-bahamas',
  'boston-ma-united-states',
  'dublin-ireland',
];

async function main() {
  let chromium;
  try {
    ({ chromium } = require('playwright'));
  } catch (e) {
    const payload = {
      generated_at: new Date().toISOString(),
      status: 'VISUAL_QA_INCOMPLETE',
      reason: 'playwright_module_unavailable',
      detail: String(e.message || e),
      browser_visual_pass_claimed: false,
    };
    fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(payload, null, 2));
    process.exit(52);
  }

  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO, 'qa-evidence/stage49-33-port-release/STAGE49_RELEASE_MANIFEST.json'), 'utf8')
  );
  const slugs = manifest.slugs_locked.slice().sort();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  const ports = [];
  const screenshotDir = path.join(REPO, 'qa-evidence/stage50-visual');
  fs.mkdirSync(screenshotDir, { recursive: true });

  for (const slug of slugs) {
    const fileUrl = `file://${path.join(REPO, 'ports', slug, 'index.html')}`;
    const entry = { landing_slug: slug, viewports: [] };
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
      const check = await page.evaluate(() => {
        const cards = document.querySelectorAll('.pg-call-plan-card').length;
        const gettingThere = !!document.getElementById('getting-there');
        const nav = !!document.querySelector('.header-nav, nav, header a[href*="seadays"]');
        const overflow =
          document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
        const body = document.body?.innerText || '';
        const markers = /\[(S\d+|C\d+)\]/.test(body);
        const rawMd = /\*\*[^*]{3,}\*\*/.test(body);
        return { cards, gettingThere, nav, overflow, markers, rawMd };
      });
      const pass =
        check.cards >= 3 &&
        check.gettingThere &&
        check.nav &&
        !check.overflow &&
        !check.markers &&
        !check.rawMd;
      entry.viewports.push({ viewport: vp.name, pass, check });
      if (SAMPLES.includes(slug) && vp.name === 'mobile') {
        const shot = path.join(screenshotDir, `${slug}-mobile.png`);
        await page.screenshot({ path: shot, fullPage: false });
        entry.screenshot_mobile = `qa-evidence/stage50-visual/${slug}-mobile.png`;
      }
      await page.close();
    }
    entry.pass = entry.viewports.every((v) => v.pass);
    ports.push(entry);
  }
  await browser.close();

  const passCount = ports.filter((p) => p.pass).length;
  const payload = {
    generated_at: new Date().toISOString(),
    status: passCount === slugs.length ? 'COMPLETE' : 'COMPLETE_WITH_FAILURES',
    method: 'playwright_file_urls',
    browser_visual_pass_claimed: passCount === slugs.length,
    total: slugs.length,
    pass_count: passCount,
    fail_count: slugs.length - passCount,
    sample_screenshots: SAMPLES.map((s) => `qa-evidence/stage50-visual/${s}-mobile.png`),
    ports,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: passCount === slugs.length, passCount, total: slugs.length }, null, 2));
  if (passCount !== slugs.length) process.exit(47);
}

main().catch((e) => {
  const payload = {
    generated_at: new Date().toISOString(),
    status: 'VISUAL_QA_INCOMPLETE',
    reason: 'playwright_runtime_error',
    detail: String(e.message || e),
    browser_visual_pass_claimed: false,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.error(e);
  process.exit(52);
});

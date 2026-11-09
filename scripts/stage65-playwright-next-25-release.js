#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const OUT = path.join(REPO, 'qa-evidence/stage65-next-25-recovery/BROWSER_QA.json');

async function main() {
  const { chromium } = require('playwright');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(REPO, 'qa-evidence/stage65-next-25-recovery/STAGE65_NEXT_25_MANIFEST.json'), 'utf8')
  );
  const slugs = (manifest.slugs_approved || []).slice().sort();
  const browser = await chromium.launch({ headless: true });
  const viewports = [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844 },
  ];
  const ports = [];

  for (const slug of slugs) {
    const fileUrl = `file://${path.join(REPO, 'ports', slug, 'index.html')}`;
    const entry = { landing_slug: slug, viewports: [] };
    for (const vp of viewports) {
      const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
      await page.goto(fileUrl, { waitUntil: 'domcontentloaded' });
      const check = await page.evaluate(() => {
        const cards = document.querySelectorAll('.pg-call-plan-card').length;
        const gettingThere = !!document.getElementById('getting-there');
        const nav = !!document.querySelector('header, nav, a[href*="seadays"]');
        const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 2;
        const body = document.body?.innerText || '';
        const markers = /\[(S\d+|C\d+)\]/.test(body);
        const rawMd = /\*\*[^*]{3,}\*\*/.test(body);
        return { cards, gettingThere, nav, overflow, markers, rawMd };
      });
      const pass =
        check.cards >= 3 && check.gettingThere && check.nav && !check.overflow && !check.markers && !check.rawMd;
      entry.viewports.push({ viewport: vp.name, pass, check });
      await page.close();
    }
    entry.pass = entry.viewports.every((v) => v.pass);
    ports.push(entry);
  }

  await browser.close();
  const passing = ports.filter((p) => p.pass).length;
  const payload = {
    generated_at_utc: new Date().toISOString(),
    slugs,
    passing,
    total: slugs.length,
    ports,
    ok: passing === slugs.length,
  };
  fs.writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ok: payload.ok, passing, total: slugs.length }, null, 2));
  if (!payload.ok) process.exit(47);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

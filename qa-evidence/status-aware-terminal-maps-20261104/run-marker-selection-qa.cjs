#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const PW_ROOT = process.env.SEADAYS_PLAYWRIGHT_ROOT || '/Users/sharanestone/Semprog/Seadays-trust-boundary';
const { chromium } = require(path.join(PW_ROOT, 'node_modules/playwright'));

const CASES = [
  { label: 'barcelona-spain', rel: 'ports/barcelona-spain/index.html', expectedPins: 4 },
  { label: 'miami-fl-united-states', rel: 'ports/miami-fl-united-states/index.html', expectedPins: 7 },
];
const VIEWPORTS = [
  { tag: '390', width: 390, height: 844 },
  { tag: '1280', width: 1280, height: 800 },
];

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const rel = decodeURIComponent((req.url || '/').split('?')[0].replace(/^\//, ''));
    const filePath = path.join(ROOT, rel);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
      res.statusCode = 404;
      return res.end('not found');
    }
    res.end(fs.readFileSync(filePath));
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` });
    });
  });
}

async function dismissCmp(page) {
  await page.getByRole('button', { name: 'Decline all' }).click({ timeout: 3000 }).catch(() => {});
}

async function popupsFromMarkers(page) {
  const markers = page.locator('.leaflet-marker-pane .leaflet-marker-icon');
  const n = await markers.count();
  const popups = new Set();
  for (let i = 0; i < n; i += 1) {
    await markers.nth(i).click({ force: true });
    await page.waitForTimeout(350);
    const popup = page.locator('.leaflet-popup-content');
    if ((await popup.count()) > 0) popups.add((await popup.first().innerText()).trim());
  }
  return popups;
}

async function popupsFromCardButtons(page) {
  const buttons = page.locator('[data-terminal-map-slug]');
  const n = await buttons.count();
  const popups = new Set();
  for (let i = 0; i < n; i += 1) {
    await buttons.nth(i).click();
    await page.waitForTimeout(400);
    const popup = page.locator('.leaflet-popup-content');
    if ((await popup.count()) > 0) popups.add((await popup.first().innerText()).trim());
  }
  return popups;
}

async function runCase(page, baseUrl, c, vp) {
  await page.setViewportSize({ width: vp.width, height: vp.height });
  await page.goto(`${baseUrl}/${c.rel}`, { waitUntil: 'networkidle', timeout: 90000 });
  await dismissCmp(page);
  await page.locator('#getting-there').scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);

  const overflowX = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2);
  const markerPopups = await popupsFromMarkers(page);
  const cardPopups = await popupsFromCardButtons(page);
  const allPopups = new Set([...markerPopups, ...cardPopups]);

  return {
    page: c.label,
    viewport: vp.tag,
    overflowX,
    markerDistinct: markerPopups.size,
    cardDistinct: cardPopups.size,
    combinedDistinct: allPopups.size,
    expectedPins: c.expectedPins,
    pass: !overflowX && cardPopups.size === c.expectedPins && allPopups.size === c.expectedPins,
    popupTitles: [...allPopups].map((t) => t.split('\n')[0]),
  };
}

async function main() {
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const results = [];

  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    for (const c of CASES) {
      for (const vp of VIEWPORTS) {
        results.push(await runCase(page, baseUrl, c, vp));
      }
    }
    await context.close();
  } finally {
    await browser.close();
    server.close();
  }

  const out = path.join(__dirname, 'marker-selection-qa.json');
  fs.writeFileSync(out, `${JSON.stringify(results, null, 2)}\n`);
  const failed = results.filter((r) => !r.pass);
  console.log(JSON.stringify({ ok: failed.length === 0, results }, null, 2));
  process.exit(failed.length ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

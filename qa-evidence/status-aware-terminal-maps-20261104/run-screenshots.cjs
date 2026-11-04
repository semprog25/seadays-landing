#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT = __dirname;
const PW_ROOT = process.env.SEADAYS_PLAYWRIGHT_ROOT || '/Users/sharanestone/Semprog/Seadays-trust-boundary';
const { chromium } = require(path.join(PW_ROOT, 'node_modules/playwright'));

const PAGES = [
  { label: 'barcelona-spain', rel: 'ports/barcelona-spain/index.html' },
  { label: 'miami-fl-united-states', rel: 'ports/miami-fl-united-states/index.html' },
  { label: 'hamburg-germany', rel: 'ports/hamburg-germany/index.html' },
];
const VIEWPORTS = [
  { tag: '390x844', width: 390, height: 844 },
  { tag: '1280x800', width: 1280, height: 800 },
];

function contentType(filePath) {
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css';
  if (filePath.endsWith('.js')) return 'application/javascript';
  if (filePath.endsWith('.png')) return 'image/png';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath.replace(/^\//, '');
    const filePath = path.join(ROOT, rel);
    if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.statusCode = 404;
      res.end('not found');
      return;
    }
    res.setHeader('Content-Type', contentType(filePath));
    fs.createReadStream(filePath).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { server, baseUrl } = await startStaticServer();
  const browser = await chromium.launch({ headless: true });
  const manifest = [];

  try {
    for (const pageDef of PAGES) {
      for (const vp of VIEWPORTS) {
        const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
        const page = await context.newPage();
        const url = `${baseUrl}/${pageDef.rel}`;
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
        await page.locator('#getting-there').scrollIntoViewIfNeeded();
        await page.waitForTimeout(1200);
        const pinCount = await page.evaluate(() => {
          for (const s of document.querySelectorAll('script')) {
            const t = s.textContent || '';
            const m = t.match(/var pins=(\[[\s\S]*?\]);/);
            if (m) return JSON.parse(m[1]).length;
          }
          return 0;
        });
        const shot = path.join(OUT, `${pageDef.label}-${vp.tag}.png`);
        await page.screenshot({ path: shot, fullPage: false });
        manifest.push({ page: pageDef.label, viewport: vp.tag, url, pinCount, screenshot: shot });
        await context.close();
      }
    }
  } finally {
    await browser.close();
    server.close();
  }

  fs.writeFileSync(path.join(OUT, 'screenshots.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log('wrote', manifest.length, 'screenshots');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

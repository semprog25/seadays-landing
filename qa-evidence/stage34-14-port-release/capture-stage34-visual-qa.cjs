#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const OUT = path.join(__dirname, 'screenshots');
const PORT = Number(process.env.STAGE34_PREVIEW_PORT || 8798);
const PW_ROOT = process.env.SEADAYS_PLAYWRIGHT_ROOT || '/Users/sharanestone/Semprog/Seadays-trust-boundary';
const { chromium } = require(path.join(PW_ROOT, 'node_modules/playwright'));
const { validateGeneratedPortHtml } = require('../../scripts/lib/bulkPortPublication/validatePortHtml');

const slugs = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'STAGE34_APPLY_REPORT.json'), 'utf8')
).slugs;
const ROLLBACK = path.join(__dirname, 'rollback-pre-apply', 'ports');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const m = url.match(/^\/ports\/([^/]+)\/index\.html$/);
      if (!m) {
        res.statusCode = 404;
        res.end();
        return;
      }
      const file = path.join(ROOT, 'ports', m[1], 'index.html');
      if (!fs.existsSync(file)) {
        res.statusCode = 404;
        res.end();
        return;
      }
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end(fs.readFileSync(file));
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const audit = [];
  const extras = ['hamburg-germany', 'aalborg-denmark'];
  const targets = [...slugs, ...extras];
  for (const slug of targets) {
    for (const vp of [
      { tag: 'desktop', w: 1280, h: 900 },
      { tag: 'mobile', w: 390, h: 844 },
    ]) {
      const page = await browser.newPage();
      await page.setViewportSize({ width: vp.w, height: vp.h });
      await page.goto(`http://127.0.0.1:${PORT}/ports/${slug}/index.html`, { waitUntil: 'networkidle' });
      await page.locator('.pg-call-plan-card').first().waitFor({ timeout: 20000 }).catch(() => {});
      const file = path.join(OUT, `${slug}-${vp.tag}.png`);
      await page.screenshot({ path: file, fullPage: true });
      const metrics = await page.evaluate(() => ({
        cards: document.querySelectorAll('.pg-call-plan-card').length,
        tip: !!document.querySelector('.pg-cruise-tip'),
        getting: !!document.querySelector('#getting-there'),
        overflow: document.documentElement.scrollWidth > window.innerWidth + 2,
        scrollWidth: document.documentElement.scrollWidth,
      }));
      const rbPath = path.join(ROLLBACK, slug, 'index.html');
      let baselineScroll = 0;
      if (fs.existsSync(rbPath)) {
        const rbPage = await browser.newPage();
        await rbPage.setViewportSize({ width: vp.w, height: vp.h });
        await rbPage.setContent(fs.readFileSync(rbPath, 'utf8'), { waitUntil: 'networkidle' });
        baselineScroll = await rbPage.evaluate(() => document.documentElement.scrollWidth);
        await rbPage.close();
      }
      const overflowRegression =
        vp.tag === 'mobile' && metrics.overflow && baselineScroll <= vp.w + 2;
      const htmlPath = path.join(ROOT, 'ports', slug, 'index.html');
      const v = validateGeneratedPortHtml(fs.readFileSync(htmlPath, 'utf8'), {
        slug,
        previewFragment: false,
      });
      const isRegressionControl = extras.includes(slug);
      const htmlOk =
        v.ok ||
        (isRegressionControl && v.issues.length === 1 && v.issues[0] === 'unexpected_terminal_map');
      const cardsOk = isRegressionControl || metrics.cards >= 3;
      audit.push({
        landing_slug: slug,
        viewport: vp.tag,
        screenshot: path.relative(ROOT, file),
        metrics,
        cards_ok: cardsOk,
        overflow_regression: overflowRegression,
        html_validation_ok: htmlOk,
        html_issues: v.issues,
        regression_control: isRegressionControl,
      });
      await page.close();
    }
  }
  await browser.close();
  server.close();
  const blocked = audit.filter(
    (a) =>
      a.overflow_regression ||
      (!a.cards_ok && !a.regression_control) ||
      (!a.html_validation_ok && !a.regression_control)
  );
  const report = {
    generated_at: new Date().toISOString(),
    port: PORT,
    slug_count: slugs.length,
    screenshots: audit.length,
    blocked_count: blocked.length,
    blocked,
    audit,
    verdict: blocked.length === 0 ? 'PASS' : 'FAIL',
  };
  fs.writeFileSync(
    path.join(__dirname, 'STAGE34_VISUAL_QA_REPORT.json'),
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8'
  );
  console.log(JSON.stringify({ verdict: report.verdict, blocked: blocked.length }, null, 2));
  if (blocked.length) process.exit(2);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

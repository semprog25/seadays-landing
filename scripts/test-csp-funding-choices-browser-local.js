#!/usr/bin/env node
'use strict';

/**
 * Local Playwright check: PR CSP is enforced when homepage canonical redirect is neutralized.
 * Does not hit production. Does not prove live CMP UI.
 */

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { getContentSecurityPolicyMetaDirectives } = require('./lib/contentSecurityPolicy');

const ROOT = path.join(__dirname, '..');
const PORT = 9940;

/** Inline canonical redirect uses location.replace (not patchable via Location.prototype in Chromium). */
function readHtmlForLocalTest(relativePath) {
  let html = fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
  if (relativePath === 'index.html') {
    html = html.replace(
      /<script>\s*\(function \(\) \{\s*var canonicalHost = "seadays\.app";[\s\S]*?\}\)\(\);\s*<\/script>/,
      '<!-- canonical redirect omitted for local CSP browser test -->'
    );
  }
  return html;
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let p = req.url.split('?')[0];
      if (p === '/') p = '/index.html';
      const rel = p.replace(/^\//, '');
      const filePath = path.join(ROOT, rel);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      if (rel === 'index.html') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(readHtmlForLocalTest('index.html'));
        return;
      }
      const ct = filePath.endsWith('.js') ? 'application/javascript' : 'text/html';
      res.writeHead(200, { 'Content-Type': ct });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function runBrowserCheck() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch {
    console.log('SKIP browser local CSP test (playwright not installed in this environment)');
    process.exit(0);
  }

  const expectedPolicy = getContentSecurityPolicyMetaDirectives();
  const server = await startStaticServer();

  const browser = await playwright.chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.addInitScript(() => {
    window.__SEADAYS_GOOGLE_CMP_INTEGRATION__ = true;
  });

  const page = await context.newPage();
  const cspViolations = [];
  page.on('console', (msg) => {
    const text = msg.text();
    if (/Content Security Policy/i.test(text) && /fundingchoicesmessages/i.test(text)) {
      cspViolations.push(text);
    }
  });

  const response = await page.goto(`http://127.0.0.1:${PORT}/?fc=alwaysshow&fctype=gdpr`, {
    waitUntil: 'networkidle',
    timeout: 120000,
  });

  assert.strictEqual(page.url(), `http://127.0.0.1:${PORT}/?fc=alwaysshow&fctype=gdpr`);

  const snapshot = await page.evaluate((expected) => {
    const meta = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
    return {
      metaContent: meta ? meta.content : '',
      metaLen: meta ? meta.content.length : 0,
      matchesExpected: meta ? meta.content === expected : false,
      fcScriptFailed: performance
        .getEntriesByType('resource')
        .some((e) => e.name.includes('fundingchoicesmessages') && e.transferSize === 0),
    };
  }, expectedPolicy);

  assert.strictEqual(response.status(), 200);
  assert.strictEqual(snapshot.matchesExpected, true, 'DOM meta CSP must match generator output');
  assert.ok(snapshot.metaContent.includes('fundingchoicesmessages.google.com'));
  assert.ok(snapshot.metaContent.includes('upgrade-insecure-requests'));
  assert.strictEqual(cspViolations.length, 0, cspViolations[0] || 'FC script CSP violation');

  const iframeProbe = await page.evaluate(() => {
    const violations = [];
    document.addEventListener('securitypolicyviolation', (e) => {
      violations.push({ eff: e.effectiveDirective, blocked: e.blockedURI });
    });
    return new Promise((resolve) => {
      const fc = document.createElement('iframe');
      fc.src = 'https://fundingchoicesmessages.google.com/';
      fc.style.display = 'none';
      const evil = document.createElement('iframe');
      evil.src = 'https://evil.example/';
      evil.style.display = 'none';
      let done = 0;
      const finish = () => {
        done += 1;
        if (done < 2) return;
        resolve({ violations });
      };
      fc.onload = finish;
      evil.onload = finish;
      document.body.appendChild(fc);
      document.body.appendChild(evil);
      setTimeout(() => resolve({ violations, timedOut: true }), 3000);
    });
  });

  const fcBlocked = iframeProbe.violations.some(
    (v) => v.eff === 'frame-src' && v.blocked.includes('fundingchoicesmessages.google.com')
  );
  const evilBlocked = iframeProbe.violations.some(
    (v) => v.eff === 'frame-src' && v.blocked.includes('evil.example')
  );
  assert.strictEqual(fcBlocked, false, 'Funding Choices iframe must not be frame-src blocked');
  assert.strictEqual(evilBlocked, true, 'unrelated iframe origin must remain blocked');

  await browser.close();
  server.close();
  console.log('PASS local browser CSP allows FC frames and blocks unrelated iframe origins');
}

runBrowserCheck().catch((err) => {
  console.error(err);
  process.exit(1);
});

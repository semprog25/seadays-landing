#!/usr/bin/env node
/**
 * Inject (or strip) mid-article AdSense slots into existing blog article index.html files
 * without a full Supabase regenerate. Idempotent.
 *
 * Usage:
 *   node scripts/inject-blog-ad-slots.js
 *   SEADAYS_ADSENSE_CLIENT_ID=ca-pub-… SEADAYS_ADSENSE_ARTICLE_MID_SLOT=… node scripts/inject-blog-ad-slots.js
 *
 * When AdSense is not configured, existing slots are stripped (fail closed).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const {
  insertArticleMidAdSlot,
  stripExistingAdSlots,
  getAdSlotCss,
  AD_SLOT_CLASS,
} = require('./lib/adsenseArticleSlot');
const { isAdSenseConfigured } = require('./lib/adsenseConfig');

const repoRoot = path.join(__dirname, '..');
const blogDir = path.join(repoRoot, 'blog');

function ensureAdSlotCssInStyle(html) {
  const hasCssMarker = html.includes('/* seadays-ad-slot-css */');
  const hasSlot = html.includes(`class="${AD_SLOT_CLASS}"`) || html.includes(`class='${AD_SLOT_CLASS}'`);

  // Keep CSS only on articles that contain a slot.
  if (!hasSlot) {
    if (!hasCssMarker) return html;
    return html.replace(/\/\* seadays-ad-slot-css \*\/[\s\S]*?\/\* end-seadays-ad-slot-css \*\/\n?/g, '');
  }

  if (hasCssMarker) {
    return html.replace(
      /\/\* seadays-ad-slot-css \*\/[\s\S]*?\/\* end-seadays-ad-slot-css \*\//,
      `/* seadays-ad-slot-css */\n${getAdSlotCss()}\n/* end-seadays-ad-slot-css */`
    );
  }

  const styleClose = html.indexOf('</style>');
  if (styleClose < 0) return html;
  const block = `/* seadays-ad-slot-css */\n${getAdSlotCss()}\n/* end-seadays-ad-slot-css */\n`;
  return html.slice(0, styleClose) + block + html.slice(styleClose);
}

function processArticleHtml(html) {
  const bodyRe =
    /(<div class="article-body">)([\s\S]*?)(<\/div>\s*(?=<section class="same-topic-section"|<section class="app-download-cta"|<section class="explore-seadays"|<nav class="article-nav"|<section class="more-to-read"|<\/article>))/;

  if (!bodyRe.test(html)) return { html, changed: false, slots: 0, reason: 'no-article-body' };
  bodyRe.lastIndex = 0;

  const nextHtmlBody = html.replace(bodyRe, function (_m, open, body, close) {
    let nextBody;
    if (isAdSenseConfigured()) nextBody = insertArticleMidAdSlot(body);
    else nextBody = stripExistingAdSlots(body);
    return open + nextBody + close;
  });

  const withCss = ensureAdSlotCssInStyle(nextHtmlBody);
  const slots = (withCss.match(/class="seadays-ad-slot"/g) || []).length;
  return {
    html: withCss,
    changed: withCss !== html,
    slots,
  };
}

function main() {
  if (!fs.existsSync(blogDir)) {
    console.error('blog/ not found');
    process.exit(1);
  }

  console.log(
    isAdSenseConfigured()
      ? '[adsense] Configured — injecting mid-article slots where eligible'
      : '[adsense] NOT configured — stripping any existing slots (fail closed)'
  );

  let files = 0;
  let changed = 0;
  let withSlots = 0;
  const entries = fs.readdirSync(blogDir, { withFileTypes: true });
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const indexPath = path.join(blogDir, ent.name, 'index.html');
    if (!fs.existsSync(indexPath)) continue;
    files += 1;
    const raw = fs.readFileSync(indexPath, 'utf8');
    const result = processArticleHtml(raw);
    if (result.changed) {
      fs.writeFileSync(indexPath, result.html, 'utf8');
      changed += 1;
    }
    if (result.slots > 0) withSlots += 1;
  }

  console.log(`Processed ${files} articles; wrote ${changed}; articles with slots: ${withSlots}`);
}

main();

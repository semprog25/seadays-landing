#!/usr/bin/env node
/**
 * Generate campaign-specific SVG QR codes for /download/qr/{campaign}.svg
 * Each code points at the measurable SeaDays download URL for that campaign.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { downloadPageUrl } = require('./lib/storeLinks');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'download', 'qr');
const campaigns = require('../data/acquisition-campaigns.json');

function generateSvg(url, dest) {
  const result = spawnSync(
    'npx',
    ['--yes', 'qrcode', '--type', 'svg', '--error-correction-level', 'M', '-o', dest, url],
    { cwd: ROOT, encoding: 'utf8' }
  );
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || 'qrcode failed');
  }
}

function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const list = Array.isArray(campaigns.campaigns) ? campaigns.campaigns : [];
  const seen = new Set();
  for (const row of list) {
    const id = String(row.id || '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const url = downloadPageUrl({
      campaign: id,
      compact: true,
    });
    const dest = path.join(OUT_DIR, `${id}.svg`);
    generateSvg(url, dest);
    console.log('qr', id, url);
  }
  console.log('wrote', seen.size, 'QR codes to download/qr/');
}

main();

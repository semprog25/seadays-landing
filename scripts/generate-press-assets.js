#!/usr/bin/env node
'use strict';

/**
 * Downloads press kit assets and builds ZIP packages (store-only, no recompression).
 * Run: npm run generate-press
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRESS = path.join(ROOT, 'press');
const STORAGE_BASE = 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic';

const REMOTE_ASSETS = [
  {
    url: `${STORAGE_BASE}/seadays.png`,
    dest: path.join(PRESS, 'logos', 'seadays-logo-light.png'),
    copies: [
      path.join(PRESS, 'logos', 'seadays-logo-dark.png'),
      path.join(PRESS, 'logos', 'seadays-logo-transparent.png'),
      path.join(PRESS, 'mockups', 'seadays-hero-logo.png'),
    ],
  },
  {
    url: `${STORAGE_BASE}/seadaysfav.png`,
    dest: path.join(PRESS, 'icons', 'seadays-favicon.png'),
    copies: [path.join(PRESS, 'icons', 'seadays-app-icon-1024.png')],
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-share-packing-list.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-share-packing-list.png'),
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-carbon-footprint-tracker.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-carbon-footprint-tracker.png'),
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-cruise-roll-calls.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-cruise-roll-calls.png'),
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-drink-package-calculator.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-drink-package-calculator.png'),
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-discover-ships-ports.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-discover-ships-ports.png'),
  },
  {
    url: `${STORAGE_BASE}/press-screenshots/seadays-feature-voyage-analytics-dashboard.png`,
    dest: path.join(PRESS, 'screenshots', 'seadays-feature-voyage-analytics-dashboard.png'),
  },
  ...[
    'seadays-marketing-hero-plan-cruise-better-blue-sky-wide.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-wide.png',
    'seadays-marketing-hero-download-now-charcoal-wide.png',
    'seadays-marketing-hero-all-in-one-charcoal-grid-wide.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-centered-wide.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-wave-wide.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-cta-wide.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-story.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-nautical-story.png',
    'seadays-marketing-hero-plan-cruise-better-ocean-blue-story.png',
    'seadays-marketing-hero-plan-cruise-better-sky-blue-story.png',
    'seadays-marketing-hero-plan-cruise-better-charcoal-story.png',
    'seadays-marketing-hero-plan-cruise-better-deep-crimson-story.png',
    'seadays-marketing-hero-plan-cruise-better-crimson-fan-story.png',
  ].map((filename) => ({
    url: `${STORAGE_BASE}/press-marketing/${filename}`,
    dest: path.join(PRESS, 'marketing', filename),
  })),
];

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    ensureDir(dest);
    const client = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    client
      .get(url, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          file.close();
          fs.unlinkSync(dest);
          downloadFile(response.headers.location, dest).then(resolve).catch(reject);
          return;
        }
        if (response.statusCode !== 200) {
          file.close();
          reject(new Error(`Failed ${url}: ${response.statusCode}`));
          return;
        }
        response.pipe(file);
        file.on('finish', () => file.close(() => resolve(dest)));
      })
      .on('error', reject);
  });
}

function zipDirectory(name, files, outputZip) {
  const downloadsDir = path.join(PRESS, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const existing = files.filter((file) => fs.existsSync(file));
  if (!existing.length) {
    console.warn(`Skipping ${name}: no files`);
    return;
  }
  try {
    execSync(`cd "${ROOT}" && zip -0 -q -j "${outputZip}" ${existing.map((f) => `"${f}"`).join(' ')}`, {
      stdio: 'inherit',
    });
  } catch (error) {
    throw error;
  }
}

function createZips() {
  const logos = [
    path.join(PRESS, 'logos', 'seadays-logo.svg'),
    path.join(PRESS, 'logos', 'seadays-logo-light.png'),
    path.join(PRESS, 'logos', 'seadays-logo-dark.png'),
    path.join(PRESS, 'logos', 'seadays-logo-transparent.png'),
    path.join(PRESS, 'icons', 'seadays-app-icon-1024.png'),
    path.join(PRESS, 'icons', 'seadays-favicon.png'),
  ];

  const screenshots = fs
    .readdirSync(path.join(PRESS, 'screenshots'))
    .filter((file) => file.endsWith('.png'))
    .map((file) => path.join(PRESS, 'screenshots', file));

  const marketingDir = path.join(PRESS, 'marketing');
  const marketing = fs.existsSync(marketingDir)
    ? fs.readdirSync(marketingDir).filter((file) => file.endsWith('.png')).map((file) => path.join(marketingDir, file))
    : [];
  const heroLogo = path.join(PRESS, 'mockups', 'seadays-hero-logo.png');
  const marketingBundle = fs.existsSync(heroLogo) ? [heroLogo, ...marketing] : marketing;

  zipDirectory('SeaDays-Logos', logos, path.join(PRESS, 'downloads', 'SeaDays-Logos.zip'));
  zipDirectory('SeaDays-Screenshots', screenshots, path.join(PRESS, 'downloads', 'SeaDays-Screenshots.zip'));
  zipDirectory('SeaDays-Marketing', marketingBundle, path.join(PRESS, 'downloads', 'SeaDays-Marketing.zip'));

  const complete = [...logos, ...screenshots, ...marketingBundle];
  zipDirectory('SeaDays-PressKit', complete, path.join(PRESS, 'downloads', 'SeaDays-PressKit.zip'));
}

async function main() {
  console.log('Downloading press assets...');
  for (const asset of REMOTE_ASSETS) {
    await downloadFile(asset.url, asset.dest);
    console.log('Downloaded', path.basename(asset.dest));
    for (const copyDest of asset.copies || []) {
      ensureDir(copyDest);
      fs.copyFileSync(asset.dest, copyDest);
    }
  }

  if (!fs.existsSync(path.join(PRESS, 'logos', 'seadays-logo.svg'))) {
    fs.copyFileSync(path.join(ROOT, 'Seadays.svg'), path.join(PRESS, 'logos', 'seadays-logo.svg'));
  }

  console.log('Building ZIP packages (store-only, no recompression)...');
  createZips();

  console.log('Press asset generation complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

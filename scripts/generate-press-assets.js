#!/usr/bin/env node
'use strict';

/**
 * Downloads press kit assets, generates PDF guides, and builds ZIP packages.
 * Run: npm run generate-press
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PRESS = path.join(ROOT, 'press');

const REMOTE_ASSETS = [
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadays.png',
    dest: path.join(PRESS, 'logos', 'seadays-logo-light.png'),
    copies: [
      path.join(PRESS, 'logos', 'seadays-logo-dark.png'),
      path.join(PRESS, 'logos', 'seadays-logo-transparent.png'),
      path.join(PRESS, 'mockups', 'seadays-hero-logo.png'),
    ],
  },
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/seadaysfav.png',
    dest: path.join(PRESS, 'icons', 'seadays-favicon.png'),
    copies: [
      path.join(PRESS, 'icons', 'seadays-app-icon-1024.png'),
      path.join(PRESS, 'mockups', 'seadays-social-app-icon.png'),
    ],
  },
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20planner.jpg',
    dest: path.join(PRESS, 'screenshots', 'seadays-screenshot-cruise-planner.jpg'),
    copies: [path.join(PRESS, 'mockups', 'seadays-mockup-cruise-planner.jpg')],
  },
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Voyage%20Analytics.jpg',
    dest: path.join(PRESS, 'screenshots', 'seadays-screenshot-voyage-analytics.jpg'),
    copies: [path.join(PRESS, 'mockups', 'seadays-mockup-voyage-analytics.jpg')],
  },
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Discover%20Ships%20%20Ports.jpg',
    dest: path.join(PRESS, 'screenshots', 'seadays-screenshot-discover-ships-ports.jpg'),
    copies: [path.join(PRESS, 'mockups', 'seadays-banner-discover.jpg')],
  },
  {
    url: 'https://auth.seadays.app/storage/v1/object/public/SeadaysPublic/Websitehomebucket/Cruise%20Community.jpg',
    dest: path.join(PRESS, 'screenshots', 'seadays-screenshot-cruise-community.jpg'),
    copies: [path.join(PRESS, 'mockups', 'seadays-lifestyle-community.jpg')],
  },
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

function writeSimplePdf(outputPath, title, paragraphs) {
  const text = [title, '', ...paragraphs].join('\\n');
  const escaped = text.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const content = `BT /F1 12 Tf 50 780 Td (${escaped}) Tj ET`;
  const objects = [
    '1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj',
    '2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj',
    '3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>endobj',
    `4 0 obj<< /Length ${Buffer.byteLength(content, 'utf8')} >>stream\n${content}\nendstream endobj`,
    '5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj',
  ];
  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += obj + '\n';
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  }
  pdf += `trailer<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  ensureDir(outputPath);
  fs.writeFileSync(outputPath, pdf);
}

function createPdfs() {
  const press = JSON.parse(fs.readFileSync(path.join(PRESS, 'data', 'press.json'), 'utf8'));
  const guide = press.brandGuidelines;

  writeSimplePdf(path.join(PRESS, 'pdf', 'SeaDays-Brand-Guidelines.pdf'), 'SeaDays Brand Guidelines', [
    guide.logoSpacing,
    'Allowed versions:',
    ...(guide.allowedVersions || []),
    'Misuse:',
    ...(guide.misuseExamples || []),
    guide.trademark,
    guide.copyright,
  ]);

  writeSimplePdf(path.join(PRESS, 'pdf', 'SeaDays-Color-Palette.pdf'), 'SeaDays Color Palette', [
    ...(guide.primaryColors || []).map((color) => `${color.name}: ${color.hex} — ${color.usage}`),
    ...(guide.secondaryColors || []).map((color) => `${color.name}: ${color.hex} — ${color.usage}`),
  ]);

  writeSimplePdf(path.join(PRESS, 'pdf', 'SeaDays-Typography-Guide.pdf'), 'SeaDays Typography Guide', [
    `Primary: ${guide.typography.primary}`,
    `Headings: ${guide.typography.headings}`,
    `Body: ${guide.typography.body}`,
  ]);

  writeSimplePdf(path.join(PRESS, 'pdf', 'SeaDays-Press-Release-Launch.pdf'), 'SeaDays Press Release', [
    'SeaDays Launches Next-Generation Cruise Planning App for Android and iOS',
    'SeaDays, a Hamburg-based travel technology company, announced its cruise planning and travel companion app.',
    'Media contact: press@seadays.app',
    'https://seadays.app/press/',
  ]);
}

function zipDirectory(name, files, outputZip) {
  const downloadsDir = path.join(PRESS, 'downloads');
  fs.mkdirSync(downloadsDir, { recursive: true });
  const listFile = path.join(downloadsDir, `${name}.files.txt`);
  const existing = files.filter((file) => fs.existsSync(file));
  if (!existing.length) {
    console.warn(`Skipping ${name}: no files`);
    return;
  }
  fs.writeFileSync(listFile, existing.map((file) => `@${file}`).join('\n'));
  try {
    execSync(`cd "${ROOT}" && zip -q -j "${outputZip}" ${existing.map((f) => `"${f}"`).join(' ')}`, {
      stdio: 'inherit',
    });
  } finally {
    fs.unlinkSync(listFile);
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
    path.join(PRESS, 'pdf', 'SeaDays-Brand-Guidelines.pdf'),
    path.join(PRESS, 'pdf', 'SeaDays-Color-Palette.pdf'),
    path.join(PRESS, 'pdf', 'SeaDays-Typography-Guide.pdf'),
  ];

  const screenshots = fs
    .readdirSync(path.join(PRESS, 'screenshots'))
    .map((file) => path.join(PRESS, 'screenshots', file));

  const marketing = fs
    .readdirSync(path.join(PRESS, 'mockups'))
    .filter((file) => file.endsWith('.jpg') || file.endsWith('.png'))
    .map((file) => path.join(PRESS, 'mockups', file));

  zipDirectory('SeaDays-Logos', logos, path.join(PRESS, 'downloads', 'SeaDays-Logos.zip'));
  zipDirectory('SeaDays-Screenshots', screenshots, path.join(PRESS, 'downloads', 'SeaDays-Screenshots.zip'));
  zipDirectory('SeaDays-Marketing', marketing, path.join(PRESS, 'downloads', 'SeaDays-Marketing.zip'));

  const complete = [...logos, ...screenshots, ...marketing, path.join(PRESS, 'pdf', 'SeaDays-Press-Release-Launch.pdf')];
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

  console.log('Creating PDF guides...');
  createPdfs();

  console.log('Building ZIP packages...');
  createZips();

  console.log('Press asset generation complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

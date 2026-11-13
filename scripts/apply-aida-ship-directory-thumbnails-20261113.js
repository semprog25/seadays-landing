#!/usr/bin/env node
'use strict';

/**
 * Owner-approved AIDA ship directory thumbnails (11 ships).
 * Downloads Wikimedia originals, crops to 16:10, emits WebP, updates harvest manifest.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');
const { readDimensions } = require('./lib/ownerImageImportCore.cjs');
const { validateCatalogImageRecordV1 } = require('./lib/catalogImage/validateCatalogImageRecord');

const REPO = path.join(__dirname, '..');
const BATCH_ID = 'aida-owner-20261113';
const PUBLIC_BASE = 'https://seadays.app';
const REVIEWED_AT = '2026-11-13T20:00:00Z';

const SHIPS = [
  {
    slug: 'aidadiva',
    appId: 'diva',
    commonsFile: 'AIDAdiva_at_Pier_26_in_Port_of_Tallinn_14_May_2024.jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/AIDAdiva_at_Pier_26_in_Port_of_Tallinn_14_May_2024.jpg',
  },
  {
    slug: 'aidabella',
    appId: 'bella',
    commonsFile: 'AIDAbella_at_Pier_25_in_Port_of_Tallinn_26_July_2017.jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/a/ab/AIDAbella_at_Pier_25_in_Port_of_Tallinn_26_July_2017.jpg',
  },
  {
    slug: 'aidaluna',
    appId: 'luna',
    commonsFile: 'AIDAluna_leaving_Kiel_16.jpg',
    sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/f/f5/AIDAluna_leaving_Kiel_16.jpg',
  },
  {
    slug: 'aidablu',
    appId: 'blu',
    commonsFile: 'AIDAblu_(ship,_2010)_007.jpg',
    sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/b/b6/AIDAblu_%28ship%2C_2010%29_007.jpg',
  },
  {
    slug: 'aidasol',
    appId: 'sol',
    commonsFile: 'AIDAsol_moored_at_Pier_27_in_Tallinn_4_October_2021.jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c5/AIDAsol_moored_at_Pier_27_in_Tallinn_4_October_2021.jpg',
  },
  {
    slug: 'aidamar',
    appId: 'mar',
    commonsFile: 'AIDAmar_at_Pier_24_in_Tallinn_19_September_2016.jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/f/f9/AIDAmar_at_Pier_24_in_Tallinn_19_September_2016.jpg',
  },
  {
    slug: 'aidastella',
    appId: 'stella',
    commonsFile: 'AIDAstella,_6.jpg',
    sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/8/8b/AIDAstella%2C_6.jpg',
  },
  {
    slug: 'aidaprima',
    appId: 'prima',
    commonsFile: 'AIDAprima_IMO_9636955_P_Hamburg_19-10-2025_(2).jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/0/05/AIDAprima_IMO_9636955_P_Hamburg_19-10-2025_%282%29.jpg',
  },
  {
    slug: 'aidaperla',
    appId: 'perla',
    commonsFile: 'Cruiseschip_AIDAPerla_te_Maassluis_(43256550705).jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/b/b0/Cruiseschip_AIDAPerla_te_Maassluis_%2843256550705%29.jpg',
  },
  {
    slug: 'aidanova',
    appId: 'nova',
    commonsFile: 'AIDAnova_IMO_9781865_P_Hamburg_21-03-2026_(1).jpg',
    sourceUrl:
      'https://upload.wikimedia.org/wikipedia/commons/c/c1/AIDAnova_IMO_9781865_P_Hamburg_21-03-2026_%281%29.jpg',
  },
  {
    slug: 'aidacosma',
    appId: 'cosma',
    commonsFile: 'AIDAcosma_05.jpg',
    sourceUrl: 'https://upload.wikimedia.org/wikipedia/commons/6/63/AIDAcosma_05.jpg',
  },
];

function commonsPageUrl(file) {
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(file.replace(/ /g, '_'))}`;
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'SeaDaysBot/1.0 (seadays.app; thumbnail pipeline)' } }, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(err);
          }
        });
      })
      .on('error', reject);
  });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function downloadFile(url) {
  const clean = url.split('?')[0];
  const dest = path.join(
    fs.mkdtempSync(path.join(require('os').tmpdir(), 'aida-dl-')),
    path.basename(clean).split('%').pop()
  );
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      execFileSync(
        'curl',
        ['-fsSL', '-A', 'SeaDaysBot/1.0 (seadays.app)', '-o', dest, clean],
        { stdio: 'pipe' }
      );
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) return dest;
    } catch {
      await sleep(2000 * (attempt + 1));
    }
  }
  throw new Error(`Download failed for ${clean}`);
}

function stripHtml(text) {
  return String(text || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeHttpsUrl(url) {
  const s = stripHtml(url);
  if (!s) return '';
  if (s.startsWith('//')) return `https:${s}`;
  if (s.startsWith('http://')) return `https://${s.slice('http://'.length)}`;
  return s;
}

async function fetchCommonsMeta(fileTitle) {
  const q = new URLSearchParams({
    action: 'query',
    prop: 'imageinfo',
    iiprop: 'url|size|extmetadata|thumburl',
    iiurlwidth: '1920',
    titles: `File:${fileTitle}`,
    format: 'json',
  });
  const json = await fetchJson(`https://commons.wikimedia.org/w/api.php?${q.toString()}`);
  const pages = json?.query?.pages || {};
  const page = Object.values(pages)[0];
  const ii = page?.imageinfo?.[0];
  if (!ii) throw new Error(`Commons metadata missing for ${fileTitle}`);
  const em = ii.extmetadata || {};
  return {
    width: ii.width,
    height: ii.height,
    sourceUrl: String(ii.url || '').split('?')[0],
    thumbUrl: String(ii.thumburl || '').split('?')[0],
    artist: stripHtml(em.Artist?.value),
    license: stripHtml(em.LicenseShortName?.value),
    licenseUrl: normalizeHttpsUrl(em.LicenseUrl?.value),
    imageDescription: stripHtml(em.ImageDescription?.value),
  };
}

function cropCenter16x10(inputPath, outPath) {
  const { width, height } = readDimensions(inputPath);
  if (!width || !height) throw new Error(`Could not read dimensions for ${inputPath}`);
  const target = 16 / 10;
  const current = width / height;
  let cropW = width;
  let cropH = height;
  if (current > target) cropW = Math.round(height * target);
  else cropH = Math.round(width / target);
  execFileSync('sips', ['-c', String(cropH), String(cropW), inputPath, '--out', outPath], { stdio: 'pipe' });
}

function exportWebp16x10(croppedJpeg, webpPath, maxWidth = 960) {
  const targetH = Math.round(maxWidth / (16 / 10));
  const resizeJpeg = `${croppedJpeg}.resized.jpg`;
  execFileSync('sips', ['-z', String(targetH), String(maxWidth), croppedJpeg, '--out', resizeJpeg], {
    stdio: 'pipe',
  });
  const cwebpBins = ['/opt/homebrew/bin/cwebp', 'cwebp'];
  let ok = false;
  for (const bin of cwebpBins) {
    try {
      execFileSync(bin, ['-q', '82', resizeJpeg, '-o', webpPath], { stdio: 'pipe' });
      ok = true;
      break;
    } catch {
      /* try next */
    }
  }
  fs.unlinkSync(resizeJpeg);
  if (!ok) throw new Error('cwebp failed');
  return readDimensions(webpPath);
}

function shipDisplayName(slug) {
  const row = SHIPS.find((s) => s.slug === slug);
  if (!row) return slug;
  const name = row.slug.replace(/^aida/, 'AIDA');
  if (row.slug === 'aidacosma') return 'AIDACosma';
  if (row.slug === 'aidanova') return 'AIDANova';
  if (row.slug === 'aidaperla') return 'AIDAPerla';
  if (row.slug === 'aidaprima') return 'AIDAPrima';
  if (row.slug === 'aidastella') return 'AIDAstella';
  if (row.slug === 'aidamar') return 'AIDAmar';
  if (row.slug === 'aidasol') return 'AIDAsol';
  if (row.slug === 'aidablu') return 'AIDAblu';
  if (row.slug === 'aidaluna') return 'AIDAluna';
  if (row.slug === 'aidabella') return 'AIDAbella';
  if (row.slug === 'aidadiva') return 'AIDAdiva';
  return name;
}

async function main() {
  const tmpDir = path.join(REPO, 'qa-evidence/aida-ship-thumbnails-20261113/tmp-downloads');
  fs.mkdirSync(tmpDir, { recursive: true });
  const manifestRows = [];
  const harvestPath = path.join(REPO, 'data/wikimedia-harvest/local-verified-records.json');
  const harvest = JSON.parse(fs.readFileSync(harvestPath, 'utf8'));
  if (!harvest.recordsByKey) harvest.recordsByKey = {};

  for (const ship of SHIPS) {
    await sleep(6000);
    const meta = await fetchCommonsMeta(ship.commonsFile);
    const assetDir = path.join(REPO, 'assets/img/ships-directory/ships', ship.slug);
    fs.mkdirSync(assetDir, { recursive: true });
    const webpRel = `/assets/img/ships-directory/ships/${ship.slug}/hero-directory-${BATCH_ID}.webp`;
    const webpAbs = path.join(REPO, webpRel.replace(/^\//, ''));
    let dims = { width: 960, height: 600 };
    if (!fs.existsSync(webpAbs) || fs.statSync(webpAbs).size < 500) {
      const downloadPath = await downloadFile(meta.thumbUrl || meta.sourceUrl || ship.sourceUrl);
      const cropped = path.join(tmpDir, `${ship.slug}-cropped.jpg`);
      cropCenter16x10(downloadPath, cropped);
      dims = exportWebp16x10(cropped, webpAbs);
    } else {
      dims = readDimensions(webpAbs);
    }
    const publicUrl = `${PUBLIC_BASE}${webpRel}`;
    const displayName = shipDisplayName(ship.slug);
    const alt =
      meta.imageDescription && meta.imageDescription.length > 12
        ? meta.imageDescription.slice(0, 240)
        : `${displayName} cruise ship (AIDA Cruises)`;

    const record = {
      v: 1,
      status: 'verified',
      entity: {
        kind: 'ship',
        canonicalSlug: ship.slug,
        appIds: [ship.appId],
      },
      commons: {
        file: ship.commonsFile,
        pageUrl: commonsPageUrl(ship.commonsFile),
      },
      media: {
        url: publicUrl,
        thumbUrl: publicUrl,
        width: dims.width || 960,
        height: dims.height || 600,
        alt,
      },
      attribution: {
        creator: meta.artist || 'Wikimedia Commons contributor',
        license: meta.license || 'CC BY-SA 4.0',
        licenseUrl:
          normalizeHttpsUrl(meta.licenseUrl) ||
          (String(meta.license || '').toLowerCase().includes('cc0')
            ? 'https://creativecommons.org/publicdomain/zero/1.0/'
            : 'https://creativecommons.org/licenses/by-sa/4.0'),
        adaptationKind: 'presentationCrop',
        adaptationNote:
          '16:10 WebP directory thumbnail derived from the unchanged Wikimedia file (center crop and resize).',
      },
      review: {
        reviewedAt: REVIEWED_AT,
        reviewedBy: 'owner-authorized-aida-ship-thumbnails-20261113',
        notes: `Owner-supplied Wikimedia photograph for ${displayName} ships directory thumbnail.`,
      },
      role: 'hero',
    };

    const validation = validateCatalogImageRecordV1(record, { expectedCanonicalSlug: ship.slug, expectedKind: 'ship' });
    if (!validation.ok) {
      throw new Error(`Invalid record ${ship.slug}: ${JSON.stringify(validation.issues)}`);
    }

    harvest.recordsByKey[`ship:image:hero:${ship.slug}`] = record;
    manifestRows.push({
      slug: ship.slug,
      commonsFile: ship.commonsFile,
      sourceUrl: meta.sourceUrl || ship.sourceUrl,
      directoryWebp: webpRel,
      publicUrl,
      creator: record.attribution.creator,
      license: record.attribution.license,
      licenseUrl: record.attribution.licenseUrl,
    });
    console.log(`[aida-thumbs] ${ship.slug} -> ${webpRel} (${record.attribution.license})`);
  }

  fs.writeFileSync(harvestPath, JSON.stringify(harvest, null, 2) + '\n', 'utf8');
  const manifestPath = path.join(REPO, 'data/aida-ship-directory-thumbnails-20261113.json');
  fs.writeFileSync(
    manifestPath,
    JSON.stringify(
      {
        batchId: BATCH_ID,
        reviewedAt: REVIEWED_AT,
        shipCount: manifestRows.length,
        ships: manifestRows,
      },
      null,
      2
    ) + '\n',
    'utf8'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

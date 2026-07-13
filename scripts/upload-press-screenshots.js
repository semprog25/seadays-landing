#!/usr/bin/env node
'use strict';

/**
 * Upload official press-kit screenshots to Supabase SeadaysPublic/press-screenshots/
 * Requires SUPABASE_SERVICE_ROLE_KEY (loads ../Seadays-main/.env or local .env).
 *
 * Run: node scripts/upload-press-screenshots.js [sourceDir]
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://soqkgrfzluewpuiguypm.supabase.co';
const BUCKET = 'SeadaysPublic';
const PREFIX = 'press-screenshots';
const STORAGE_PUBLIC_URL = 'https://auth.seadays.app/storage/v1/object/public';

const DEFAULT_SOURCE = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '.cursor',
  'projects',
  'Users-sharanestone-Semprog-Seadays-main',
  'assets'
);

const SCREENSHOTS = [
  {
    source: 'Seadays_Screen_Packing_list-220963bf-0d1a-46d8-8ad3-c7349c0b0cc9.png',
    storageName: 'seadays-feature-share-packing-list.png',
    localName: 'seadays-feature-share-packing-list.png',
  },
  {
    source: 'Seadays_Screen_carbon_footprint-d2721526-d892-4c89-bc31-78a61d26de21.png',
    storageName: 'seadays-feature-carbon-footprint-tracker.png',
    localName: 'seadays-feature-carbon-footprint-tracker.png',
  },
  {
    source: 'Seadays_Screen_RollCalls-4483673c-a128-47b5-83d5-27390e934b4d.png',
    storageName: 'seadays-feature-cruise-roll-calls.png',
    localName: 'seadays-feature-cruise-roll-calls.png',
  },
  {
    source: 'Seadays_Screen_Drink_Package_calculator-26f14c9d-6c77-4555-bda7-5e62e84e5ca0.png',
    storageName: 'seadays-feature-drink-package-calculator.png',
    localName: 'seadays-feature-drink-package-calculator.png',
  },
  {
    source: 'Seadays_Screen_Discover-49eac324-ac95-4f62-b951-2d7c261da7be.png',
    storageName: 'seadays-feature-discover-ships-ports.png',
    localName: 'seadays-feature-discover-ships-ports.png',
  },
  {
    source: 'Seadays_Screen_Voyage_Analytics-b6e8a2eb-3d7e-4f47-9f9a-7c307d0d941f.png',
    storageName: 'seadays-feature-voyage-analytics-dashboard.png',
    localName: 'seadays-feature-voyage-analytics-dashboard.png',
  },
];

function publicUrl(storageName) {
  return `${STORAGE_PUBLIC_URL}/${BUCKET}/${PREFIX}/${storageName}`;
}

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
    process.exit(1);
  }

  const sourceDir = process.argv[2] || DEFAULT_SOURCE;
  const pressScreenshotsDir = path.join(__dirname, '..', 'press', 'screenshots');
  fs.mkdirSync(pressScreenshotsDir, { recursive: true });

  const supabase = createClient(SUPABASE_URL, serviceKey);
  const results = [];

  for (const item of SCREENSHOTS) {
    const sourcePath = path.join(sourceDir, item.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source file: ${sourcePath}`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const storagePath = `${PREFIX}/${item.storageName}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

    if (error) {
      throw new Error(`Upload failed for ${item.storageName}: ${error.message}`);
    }

    const localDest = path.join(pressScreenshotsDir, item.localName);
    fs.copyFileSync(sourcePath, localDest);

    const url = publicUrl(item.storageName);
    results.push({
      storageName: item.storageName,
      localName: item.localName,
      url,
      fileSize: buffer.length,
    });

    console.log('Uploaded', item.storageName, '→', url);
  }

  console.log('\nUpload complete. Public URLs:');
  console.log(JSON.stringify(results, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

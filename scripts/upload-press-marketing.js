#!/usr/bin/env node
'use strict';

/**
 * Upload official press-kit marketing banners to Supabase SeadaysPublic/press-marketing/
 * Requires SUPABASE_SERVICE_ROLE_KEY (loads ../Seadays-main/.env or local .env).
 *
 * Run: node scripts/upload-press-marketing.js [sourceDir]
 */

const fs = require('fs');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://soqkgrfzluewpuiguypm.supabase.co';
const BUCKET = 'SeadaysPublic';
const PREFIX = 'press-marketing';
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

const MARKETING_BANNERS = [
  {
    source: 'Seadays_Banner43-fe9e88c3-958c-4a8e-bbb1-974c3f3370a9.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-blue-sky-wide.png',
  },
  {
    source: 'Seadays_Banner32-eba5740d-bf05-4de7-bdcd-4d8ea7dba2fb.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-wide.png',
  },
  {
    source: 'Seadays_Banner44-6e3991b6-64b2-4534-b31e-b465a8cbdf2f.png',
    filename: 'seadays-marketing-hero-download-now-charcoal-wide.png',
  },
  {
    source: 'Seadays_Banner49-0f67feed-aea2-43cb-ad88-d6be79f7b99a.png',
    filename: 'seadays-marketing-hero-all-in-one-charcoal-grid-wide.png',
  },
  {
    source: 'Seadays_Banner51-d212ecd6-df37-4096-83ea-6e65cc9cd527.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-centered-wide.png',
  },
  {
    source: 'Seadays_Banner57-d0649210-56b7-44b4-80ae-abc4dccbeb24.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-wave-wide.png',
  },
  {
    source: 'Seadays_Banner63-fbbda248-f605-419b-adac-a9e3cbaebc1f.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-cta-wide.png',
  },
  {
    source: 'Seadays_Banner34-23644605-51e1-4c2f-bd07-d8f70cf99bea.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-story.png',
  },
  {
    source: 'Seadays_Banner37-57118e75-d2d0-4a65-94f3-0824c4082173.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-nautical-story.png',
  },
  {
    source: 'Seadays_Banner38-912a3ee5-f933-4f04-aebd-47ac43e499d9.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-ocean-blue-story.png',
  },
  {
    source: 'Seadays_Banner40-c065e875-6288-468b-b854-1eb3d22ad067.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-sky-blue-story.png',
  },
  {
    source: 'Seadays_Banner53-d8090a22-d6b7-4336-8b06-6907c17a6cfe.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-charcoal-story.png',
  },
  {
    source: 'Seadays_Banner59-e3ae4b6f-0417-4d1a-ab92-7f8c6d462fa9.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-deep-crimson-story.png',
  },
  {
    source: 'Seadays_Banner60-c20c1987-ac5a-46df-b149-5b2bafc4af45.png',
    filename: 'seadays-marketing-hero-plan-cruise-better-crimson-fan-story.png',
  },
];

function publicUrl(filename) {
  return `${STORAGE_PUBLIC_URL}/${BUCKET}/${PREFIX}/${filename}`;
}

async function main() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required.');
    process.exit(1);
  }

  const sourceDir = process.argv[2] || DEFAULT_SOURCE;
  const marketingDir = path.join(__dirname, '..', 'press', 'marketing');
  fs.mkdirSync(marketingDir, { recursive: true });

  const supabase = createClient(SUPABASE_URL, serviceKey);
  const results = [];

  for (const item of MARKETING_BANNERS) {
    const sourcePath = path.join(sourceDir, item.source);
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Missing source file: ${sourcePath}`);
    }

    const buffer = fs.readFileSync(sourcePath);
    const storagePath = `${PREFIX}/${item.filename}`;

    const { error } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: 'image/png',
      upsert: true,
    });

    if (error) {
      throw new Error(`Upload failed for ${item.filename}: ${error.message}`);
    }

    const localDest = path.join(marketingDir, item.filename);
    fs.copyFileSync(sourcePath, localDest);

    results.push({
      filename: item.filename,
      url: publicUrl(item.filename),
      fileSize: buffer.length,
    });

    console.log('Uploaded', item.filename);
  }

  console.log('\nUpload complete:', results.length, 'marketing banners');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

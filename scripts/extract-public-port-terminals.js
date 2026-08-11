#!/usr/bin/env node
'use strict';

/**
 * Fetch public port_terminals rows (anon RLS: select true) into
 * data/public-port-terminals.json for static port pages.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
require('dotenv').config({ path: path.join(__dirname, '..', '..', 'Seadays-main', '.env') });

const SUPABASE_URL = 'https://soqkgrfzluewpuiguypm.supabase.co';
// Publishable anon key (also shipped in the mobile app client). Prefer env override.
const FALLBACK_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvcWtncmZ6bHVld3B1aWd1eXBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2MjM3MDMsImV4cCI6MjA3NzE5OTcwM30.PJOgXC4sXdjcGuQ99uw38eXwD9Jss-6tggHeUemXqZI';

function fetchJson(url, headers) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode && res.statusCode >= 400) {
          reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.setTimeout(60000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function main() {
  const key = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || FALLBACK_ANON;
  const select =
    'country_id,port_id,slug,name,description,terminal_type,terminal_status,facilities,distance_to_city_center_km,transport_options,is_primary,sort_order';
  const url = `${SUPABASE_URL}/rest/v1/port_terminals?select=${encodeURIComponent(select)}&order=port_id.asc,is_primary.desc,sort_order.asc`;
  const rows = await fetchJson(url, {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: 'application/json',
  });
  if (!Array.isArray(rows)) throw new Error('Unexpected response');

  const byPortId = {};
  for (const row of rows) {
    const portId = String(row.port_id || '').toLowerCase();
    if (!portId) continue;
    if (!byPortId[portId]) byPortId[portId] = [];
    byPortId[portId].push({
      name: row.name || '',
      slug: row.slug || '',
      description: row.description || '',
      terminal_type: row.terminal_type || '',
      terminal_status: row.terminal_status || '',
      facilities: row.facilities,
      distance_to_city_center_km:
        row.distance_to_city_center_km != null ? Number(row.distance_to_city_center_km) : null,
      transport_options: row.transport_options,
      is_primary: Boolean(row.is_primary),
      sort_order: Number(row.sort_order) || 0,
      country_id: row.country_id || '',
    });
  }

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      count: rows.length,
      portCount: Object.keys(byPortId).length,
      source: 'public.port_terminals (anon select)',
    },
    byPortId,
  };

  const out = path.join(__dirname, '..', 'data', 'public-port-terminals.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  console.log(`[extract-public-port-terminals] ${rows.length} terminals → ${out}`);
}

main().catch((e) => {
  console.error('[extract-public-port-terminals]', e.message || e);
  process.exit(1);
});

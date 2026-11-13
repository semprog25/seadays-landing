#!/usr/bin/env node
'use strict';
// Read-only cleanup inventory. JSON pointers refer to the committed guide dataset.
const fs = require('node:fs');
const path = require('node:path');
const { containsInternalResearchLeak } = require('./lib/publicGuideCopySanitize');
const { buildSlugToAppPortIdMap } = require('./lib/publicPortGuideAdapter');
const { allPorts } = require('./lib/appCruiseDataset');
const { getAppRepoRoot, buildPortSlugToReviewKeyMap } = require('./lib/reviewAggregateMerge');
const root = path.join(__dirname, '..');
const guides = JSON.parse(fs.readFileSync(path.join(root, 'data/public-port-guides.json'), 'utf8')).byAppPortId;
const map = buildSlugToAppPortIdMap(allPorts, buildPortSlugToReviewKeyMap(getAppRepoRoot(), allPorts), guides);
const slugsById = {};
for (const [slug, id] of Object.entries(map)) (slugsById[id] ||= []).push(slug);
const entries = [];
for (const [id, guide] of Object.entries(guides)) {
  const slugs = slugsById[id]?.length ? slugsById[id] : [guide.researchImport?.landing_slug || id];
  function visit(value, parts) {
    if (typeof value === 'string' && containsInternalResearchLeak(value)) {
      for (const slug of slugs) {
        entries.push({
          slug,
          appPortId: id,
          field: parts.join('.'),
          jsonPointer: `/byAppPortId/${id}/${parts.join('/')}`,
          text: value,
          mapped: Boolean(slugsById[id]?.length),
        });
      }
    } else if (value && typeof value === 'object') {
      for (const [key, item] of Object.entries(value)) visit(item, [...parts, key]);
    }
  }
  for (const key of ['portInfo', 'gettingThere', 'thingsToDo', 'climate', 'politics']) visit(guide[key], [key]);
}
console.log(JSON.stringify(entries.sort((a, b) => a.slug.localeCompare(b.slug) || a.field.localeCompare(b.field)), null, 2));

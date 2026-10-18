#!/usr/bin/env node
'use strict';

/** Swap generated port/ship bodies for data/editorial-pages/* (idempotent). */

const path = require('path');
const { applyAllEditorialPages } = require('./lib/editorialPages');

const results = applyAllEditorialPages(path.join(__dirname, '..'));
for (const row of results) {
  console.log(`[editorial-pages] ${row.status} ${path.relative(path.join(__dirname, '..'), row.file)}`);
}
if (results.some((row) => row.status === 'missing')) process.exitCode = 1;

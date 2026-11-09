'use strict';

const fs = require('fs');
const path = require('path');

function extractPortIdNamePairs(text) {
  const out = [];
  const re = /\bid:\s*['"]([^'"]+)['"][\s\S]*?\bname:\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({ id: m[1], name: m[2] });
  }
  return out;
}

/**
 * @returns {Map<string, string>} appPortId → country_id (file stem)
 */
function buildPortIdToCountryIdMap(appRoot) {
  const dir = path.join(appRoot, 'src', 'utils', 'cruise-data', 'ports', 'data');
  const map = new Map();
  let files = [];
  try {
    files = fs.readdirSync(dir).filter((f) => f.endsWith('.ts'));
  } catch {
    return map;
  }
  for (const file of files) {
    const countryId = file.replace(/\.ts$/, '');
    let text = '';
    try {
      text = fs.readFileSync(path.join(dir, file), 'utf8');
    } catch {
      continue;
    }
    for (const { id } of extractPortIdNamePairs(text)) {
      if (id && !map.has(id)) map.set(id, countryId);
    }
  }
  return map;
}

module.exports = { buildPortIdToCountryIdMap, extractPortIdNamePairs };

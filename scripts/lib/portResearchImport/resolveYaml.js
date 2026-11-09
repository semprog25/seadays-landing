'use strict';

const fs = require('fs');
const path = require('path');

function tryRequireYaml(startDir) {
  const candidates = [
    path.join(startDir, 'node_modules', 'yaml'),
    path.join(startDir, '..', '..', '..', '..', '..', 'Seadays-trust-boundary', 'node_modules', 'yaml'),
    path.join(startDir, '..', '..', '..', 'Seadays-trust-boundary', 'node_modules', 'yaml'),
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(path.join(p, 'package.json'))) {
        return require(p);
      }
    } catch {
      // continue
    }
  }
  throw new Error('yaml package not found; install deps or set NODE_PATH');
}

let yamlMod;
function getYaml() {
  if (!yamlMod) yamlMod = tryRequireYaml(path.join(__dirname, '..', '..', '..'));
  return yamlMod;
}

function parseFrontmatter(mdText) {
  const text = String(mdText || '');
  if (!text.startsWith('---')) {
    return { meta: {}, body: text };
  }
  const end = text.indexOf('\n---', 3);
  if (end < 0) {
    return { meta: {}, body: text };
  }
  const raw = text.slice(3, end).trim();
  const body = text.slice(end + 4).trimStart();
  const YAML = getYaml();
  const meta = YAML.parse(raw) || {};
  return { meta, body };
}

module.exports = { parseFrontmatter, getYaml };

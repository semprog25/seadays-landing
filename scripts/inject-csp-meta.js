#!/usr/bin/env node
'use strict';

/**
 * Updates CSP meta on pages that already define one (root legal/home templates).
 * Does not walk blog/port/ship trees — those pages have no meta CSP today.
 */

const fs = require('fs');
const path = require('path');
const { injectContentSecurityPolicyMeta } = require('./lib/contentSecurityPolicy');

const ROOT = path.join(__dirname, '..');
const TARGETS = ['index.html', 'gdpr.html', 'impressum.html', 'security.html'];

let changed = 0;
for (const rel of TARGETS) {
  const filePath = path.join(ROOT, rel);
  if (!fs.existsSync(filePath)) {
    console.warn('skip missing', rel);
    continue;
  }
  const before = fs.readFileSync(filePath, 'utf8');
  const after = injectContentSecurityPolicyMeta(before);
  if (after !== before) {
    fs.writeFileSync(filePath, after, 'utf8');
    changed += 1;
    console.log('updated', rel);
  } else {
    console.log('unchanged', rel);
  }
}

console.log(`inject-csp-meta: ${changed} file(s) updated`);

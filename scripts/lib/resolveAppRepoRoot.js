'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Resolve the SeaDays mobile-app repo root (directory that contains `src/`).
 * Landing may live as a sibling (`../Seadays-main`) or nested inside the app.
 * Never invent paths that lack `src/utils/port-details`.
 */
function resolveAppRepoRoot(fromDir) {
  const env =
    process.env.SEADAYS_APP_ROOT ||
    process.env.APP_REPO_ROOT ||
    process.env.SEADAYS_APP_REPO ||
    '';
  const candidates = [];
  if (env.trim()) candidates.push(path.resolve(env.trim()));

  const base = fromDir || __dirname;
  candidates.push(
    path.resolve(base, '..', '..', '..', 'Seadays-main'),
    path.resolve(base, '..', '..', '..'),
    path.resolve(base, '..', '..', 'Seadays-main'),
    path.resolve(base, '..', '..'),
    path.resolve(process.cwd(), '..', 'Seadays-main'),
    path.resolve(process.cwd())
  );

  for (const root of candidates) {
    if (
      fs.existsSync(path.join(root, 'src', 'utils', 'port-details', 'types.ts')) ||
      fs.existsSync(path.join(root, 'src', 'utils', 'port-details', 'index.ts'))
    ) {
      return root;
    }
  }
  return candidates[0] || path.resolve(base, '..', '..', '..', 'Seadays-main');
}

module.exports = { resolveAppRepoRoot };

'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { buildCompositeResearchRoot } = require('./researchRootComposite');

const DEFAULT_PATCH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  'qa-evidence/stage67-yaml-repair-48/PORTS_MASTER_INDEX_SHA_PATCH.json'
);

/**
 * @returns {{ compositeRoot: string, patchMeta: object, cleanup: () => void }}
 */
function resolveCompositeResearchRoot(opts = {}) {
  const repoRoot = opts.landingRepoRoot || path.join(__dirname, '..', '..', '..');
  const patchPath = opts.patchPath || process.env.PORT_RESEARCH_SHA_PATCH || DEFAULT_PATCH;
  const patchMeta = JSON.parse(fs.readFileSync(patchPath, 'utf8'));
  const byPortRoot =
    opts.byPortRoot ||
    process.env.PORT_RESEARCH_BY_PORT_ROOT ||
    patchMeta.by_port_root;
  const indexSource =
    opts.indexSourcePath ||
    process.env.PORT_RESEARCH_INDEX_SOURCE ||
    patchMeta.index_source_path;
  if (!byPortRoot || !fs.existsSync(path.join(byPortRoot, 'by-port'))) {
    throw new Error(`missing by-port tree at ${byPortRoot}`);
  }
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'seadays-research-composite-'));
  const { compositeRoot } = buildCompositeResearchRoot({
    byPortRoot,
    indexSourcePath: indexSource,
    shaPatchBySlug: patchMeta.sha_patch || {},
    workDir,
  });
  return {
    compositeRoot,
    patchMeta,
    cleanup: () => {
      try {
        fs.rmSync(workDir, { recursive: true, force: true });
      } catch {
        // best effort
      }
    },
  };
}

module.exports = { resolveCompositeResearchRoot };
